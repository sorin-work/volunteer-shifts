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
