import type { AppContext } from '../../context.js';
import type { Attendance } from '../../db/types.js';
import { conflict, notFound } from '../../lib/errors.js';
import { creditShiftHours, removeShiftHours } from '../hours/credit.js';

/**
 * Records attendance and keeps the credited hours in step. The signup row is
 * locked so a double-tapped "Check in" can't credit the shift twice.
 */
export async function markAttendance(
  ctx: AppContext,
  signupId: number,
  attendance: Attendance,
  markedBy: number,
) {
  return ctx.db.transaction().execute(async (trx) => {
    const tctx = { ...ctx, db: trx };
    await trx.selectFrom('signups').select('id').where('id', '=', signupId).forUpdate().execute();
    const signup = await trx
      .selectFrom('signups')
      .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
      .innerJoin('events', 'events.id', 'shifts.event_id')
      .innerJoin('roles', 'roles.id', 'shifts.role_id')
      .selectAll('signups')
      .select([
        'shifts.starts_at',
        'shifts.ends_at',
        'events.name as event_name',
        'events.timezone as event_timezone',
        'roles.name as role_name',
      ])
      .where('signups.id', '=', signupId)
      .executeTakeFirst();
    if (!signup) throw notFound('Signup');
    if (signup.status !== 'confirmed') {
      throw conflict('not_confirmed', 'Only confirmed volunteers can be checked in.');
    }
    const now = ctx.now();
    if (
      attendance === 'present' &&
      now.getTime() < signup.starts_at.getTime() - ctx.config.CHECK_IN_OPENS_MINUTES * 60_000
    ) {
      throw conflict(
        'too_early',
        `Check-in opens ${ctx.config.CHECK_IN_OPENS_MINUTES} minutes before the shift starts.`,
      );
    }
    if (attendance === 'no_show' && now < signup.starts_at) {
      throw conflict('shift_not_started', "You can't mark a no-show before the shift starts.");
    }

    const updated = await trx
      .updateTable('signups')
      .set({
        attendance,
        checked_in_at: attendance === 'present' ? (signup.checked_in_at ?? now) : null,
        attendance_marked_by: markedBy,
      })
      .where('id', '=', signup.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (attendance === 'present' && signup.attendance !== 'present') {
      await creditShiftHours(tctx, signup, markedBy);
    } else if (attendance !== 'present' && signup.attendance === 'present') {
      await removeShiftHours(tctx, signup.id);
    }
    return updated;
  });
}
