import type { AppContext } from '../../context.js';
import type { Signup, User } from '../../db/types.js';
import { conflict, notFound } from '../../lib/errors.js';
import { sendSafely } from '../../mail/mailer.js';
import { shiftMailInfo } from '../../mail/shift-info.js';
import { templates } from '../../mail/templates.js';
import { assertEligible } from './eligibility.js';

export async function getShiftWithEvent(ctx: AppContext, shiftId: number) {
  const row = await ctx.db
    .selectFrom('shifts')
    .innerJoin('events', 'events.id', 'shifts.event_id')
    .innerJoin('roles', 'roles.id', 'shifts.role_id')
    .selectAll('shifts')
    .select([
      'events.name as event_name',
      'events.status as event_status',
      'events.timezone as event_timezone',
      'events.location as event_location',
      'roles.name as role_name',
      'roles.description as role_description',
      'roles.min_age as role_min_age',
    ])
    .where('shifts.id', '=', shiftId)
    .executeTakeFirst();
  if (!row) throw notFound('Shift');
  return row;
}

export async function countConfirmed(ctx: AppContext, shiftId: number): Promise<number> {
  const { count } = await ctx.db
    .selectFrom('signups')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('shift_id', '=', shiftId)
    .where('status', '=', 'confirmed')
    .executeTakeFirstOrThrow();
  return Number(count);
}

/** The user's active signups on other shifts that clash with the given time range. */
export async function findConflicts(
  ctx: AppContext,
  userId: number,
  range: { startsAt: Date; endsAt: Date; excludeShiftId?: number },
) {
  let query = ctx.db
    .selectFrom('signups')
    .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
    .innerJoin('events', 'events.id', 'shifts.event_id')
    .select([
      'shifts.id as shift_id',
      'shifts.starts_at',
      'shifts.ends_at',
      'events.name as event_name',
    ])
    .where('signups.user_id', '=', userId)
    .where('signups.status', 'in', ['confirmed', 'waitlisted'])
    // Two ranges overlap when each one starts before the other ends.
    .where('shifts.starts_at', '<', range.endsAt)
    .where('shifts.ends_at', '>', range.startsAt);
  if (range.excludeShiftId) query = query.where('shifts.id', '<>', range.excludeShiftId);
  return query.orderBy('shifts.starts_at').execute();
}

/** Signs the user up for a shift, checking everything a coordinator would. */
export async function signUp(ctx: AppContext, user: User, shiftId: number) {
  // Lock the shift row so two people can't both take the last spot: the
  // second transaction waits here until the first has inserted its signup.
  return ctx.db.transaction().execute(async (trx) => {
    await lockShift(trx, shiftId);
    return signUpLocked({ ...ctx, db: trx }, user, shiftId);
  });
}

async function lockShift(db: AppContext['db'], shiftId: number) {
  await db.selectFrom('shifts').select('id').where('id', '=', shiftId).forUpdate().execute();
}

async function signUpLocked(ctx: AppContext, user: User, shiftId: number) {
  const shift = await getShiftWithEvent(ctx, shiftId);
  if (shift.event_status === 'draft') throw notFound('Shift');
  if (shift.event_status === 'cancelled') {
    throw conflict('event_cancelled', 'This event has been cancelled.');
  }
  if (shift.starts_at <= ctx.now()) {
    throw conflict('shift_started', 'This shift has already started.');
  }

  await assertEligible(ctx, user, shift);

  const existing = await ctx.db
    .selectFrom('signups')
    .select('id')
    .where('shift_id', '=', shift.id)
    .where('user_id', '=', user.id)
    .where('status', '<>', 'cancelled')
    .executeTakeFirst();
  if (existing) throw conflict('already_signed_up', 'You are already signed up for this shift.');

  const conflicts = await findConflicts(ctx, user.id, {
    startsAt: shift.starts_at,
    endsAt: shift.ends_at,
    excludeShiftId: shift.id,
  });
  if (conflicts.length) {
    throw conflict('schedule_conflict', 'You already have a shift at this time.', {
      shifts: conflicts.map((c) => ({
        shiftId: c.shift_id,
        eventName: c.event_name,
        startsAt: c.starts_at.toISOString(),
        endsAt: c.ends_at.toISOString(),
      })),
    });
  }

  // A full shift doesn't turn people away: they join the waitlist and move up
  // when someone cancels.
  const confirmed = await countConfirmed(ctx, shift.id);
  const status = confirmed >= shift.capacity ? 'waitlisted' : 'confirmed';

  const signup = await ctx.db
    .insertInto('signups')
    .values({ shift_id: shift.id, user_id: user.id, status })
    .returningAll()
    .executeTakeFirstOrThrow();
  return { signup, shift };
}

/** 1-based position on the waitlist, or null when the signup isn't waitlisted. */
export async function waitlistPosition(
  ctx: AppContext,
  signup: { id: number; shift_id: number; status: string; created_at: Date },
): Promise<number | null> {
  if (signup.status !== 'waitlisted') return null;
  const { ahead } = await ctx.db
    .selectFrom('signups')
    .select((eb) => eb.fn.countAll<number>().as('ahead'))
    .where('shift_id', '=', signup.shift_id)
    .where('status', '=', 'waitlisted')
    .where('created_at', '<', signup.created_at)
    .executeTakeFirstOrThrow();
  return Number(ahead) + 1;
}

/** Waitlist positions for every waitlisted signup on the given shifts, by signup id. */
export async function waitlistPositions(
  ctx: AppContext,
  shiftIds: number[],
): Promise<Map<number, number>> {
  if (!shiftIds.length) return new Map();
  const rows = await ctx.db
    .selectFrom('signups')
    .select((eb) => [
      'id',
      eb.fn
        .agg<number>('row_number')
        .over((ob) => ob.partitionBy('shift_id').orderBy('created_at').orderBy('id'))
        .as('position'),
    ])
    .where('shift_id', 'in', [...new Set(shiftIds)])
    .where('status', '=', 'waitlisted')
    .execute();
  return new Map(rows.map((r) => [r.id, Number(r.position)]));
}

/**
 * Fills open spots on a shift from its waitlist, first come first served.
 * Returns the signups that were promoted.
 */
export async function promoteFromWaitlist(ctx: AppContext, shiftId: number) {
  return ctx.db.transaction().execute(async (trx) => {
    await lockShift(trx, shiftId);
    return promoteLocked({ ...ctx, db: trx }, shiftId);
  });
}

async function promoteLocked(ctx: AppContext, shiftId: number) {
  const shift = await ctx.db
    .selectFrom('shifts')
    .select(['id', 'capacity'])
    .where('id', '=', shiftId)
    .executeTakeFirstOrThrow();
  const open = shift.capacity - (await countConfirmed(ctx, shiftId));
  if (open <= 0) return [];

  const next = await ctx.db
    .selectFrom('signups')
    .select('id')
    .where('shift_id', '=', shiftId)
    .where('status', '=', 'waitlisted')
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc')
    .limit(open)
    .execute();
  if (!next.length) return [];

  return ctx.db
    .updateTable('signups')
    .set({ status: 'confirmed' })
    .where(
      'id',
      'in',
      next.map((n) => n.id),
    )
    .returningAll()
    .execute();
}

/** Lets people who moved up from the waitlist know they're on the shift. */
export async function notifyPromoted(ctx: AppContext, promoted: Signup[]) {
  if (!promoted.length) return;
  const shift = await getShiftWithEvent(ctx, promoted[0]!.shift_id);
  const users = await ctx.db
    .selectFrom('users')
    .select(['id', 'name', 'email'])
    .where(
      'id',
      'in',
      promoted.map((p) => p.user_id),
    )
    .execute();
  for (const user of users) {
    await sendSafely(
      ctx.mailer,
      ctx.logger,
      templates.promoted(user.email, shiftMailInfo(ctx, shift, user)),
    );
  }
}
