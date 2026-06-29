import type { AppContext } from '../../context.js';
import { localDate } from '../../lib/time.js';
import { durationHours } from '../shifts/schedule.js';

interface CheckedInSignup {
  id: number;
  user_id: number;
  starts_at: Date;
  ends_at: Date;
  event_name: string;
  event_timezone: string;
  role_name: string;
}

/** Hours are credited for the scheduled length of the shift, to two decimals. */
export function creditedHours(startsAt: Date, endsAt: Date): number {
  return Math.round(durationHours(startsAt, endsAt) * 100) / 100;
}

export async function creditShiftHours(ctx: AppContext, signup: CheckedInSignup, by: number) {
  await ctx.db
    .insertInto('hour_entries')
    .values({
      user_id: signup.user_id,
      signup_id: signup.id,
      // The day the volunteer worked, as the people on site saw it.
      worked_on: localDate(signup.starts_at, signup.event_timezone),
      hours: creditedHours(signup.starts_at, signup.ends_at),
      description: `${signup.event_name}: ${signup.role_name}`,
      created_by: by,
    })
    .execute();
}

export async function removeShiftHours(ctx: AppContext, signupId: number) {
  await ctx.db.deleteFrom('hour_entries').where('signup_id', '=', signupId).execute();
}
