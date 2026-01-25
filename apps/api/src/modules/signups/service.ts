import type { AppContext } from '../../context.js';
import type { User } from '../../db/types.js';
import { conflict, notFound } from '../../lib/errors.js';

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
      'roles.name as role_name',
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
    .where('shifts.starts_at', '>=', range.startsAt)
    .where('shifts.starts_at', '<', range.endsAt);
  if (range.excludeShiftId) query = query.where('shifts.id', '<>', range.excludeShiftId);
  return query.orderBy('shifts.starts_at').execute();
}

/** Signs the user up for a shift, checking everything a coordinator would. */
export async function signUp(ctx: AppContext, user: User, shiftId: number) {
  const shift = await getShiftWithEvent(ctx, shiftId);
  if (shift.event_status === 'draft') throw notFound('Shift');
  if (shift.event_status === 'cancelled') {
    throw conflict('event_cancelled', 'This event has been cancelled.');
  }
  if (shift.starts_at <= ctx.now()) {
    throw conflict('shift_started', 'This shift has already started.');
  }

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

  const confirmed = await countConfirmed(ctx, shift.id);
  if (confirmed >= shift.capacity) {
    throw conflict('shift_full', 'This shift is full.');
  }

  const signup = await ctx.db
    .insertInto('signups')
    .values({ shift_id: shift.id, user_id: user.id, status: 'confirmed' })
    .returningAll()
    .executeTakeFirstOrThrow();
  return { signup, shift };
}
