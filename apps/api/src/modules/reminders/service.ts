import type { AppContext } from '../../context.js';
import { sendSafely } from '../../mail/mailer.js';
import { shiftMailInfo } from '../../mail/shift-info.js';
import { templates } from '../../mail/templates.js';

/**
 * Emails everyone with a shift starting within the reminder window who hasn't
 * been reminded yet. Safe to run as often as you like.
 */
export async function sendDueReminders(ctx: AppContext): Promise<number> {
  const now = ctx.now();
  const until = new Date(now.getTime() + ctx.config.REMINDER_LEAD_HOURS * 3_600_000);

  const due = await ctx.db
    .selectFrom('signups')
    .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
    .innerJoin('events', 'events.id', 'shifts.event_id')
    .innerJoin('roles', 'roles.id', 'shifts.role_id')
    .innerJoin('users', 'users.id', 'signups.user_id')
    .select([
      'signups.id as signup_id',
      'shifts.event_id',
      'shifts.starts_at',
      'shifts.ends_at',
      'shifts.notes',
      'events.name as event_name',
      'events.timezone as event_timezone',
      'events.location as event_location',
      'roles.name as role_name',
      'users.name',
      'users.email',
    ])
    .where('signups.status', '<>', 'cancelled')
    .where('signups.reminder_sent_at', 'is', null)
    .where('events.status', '=', 'published')
    .where('shifts.starts_at', '>', now)
    .where('shifts.starts_at', '<=', until)
    .orderBy('shifts.starts_at')
    .execute();

  for (const row of due) {
    await sendSafely(
      ctx.mailer,
      ctx.logger,
      templates.reminder(row.email, shiftMailInfo(ctx, row, row)),
    );
    await ctx.db
      .updateTable('signups')
      .set({ reminder_sent_at: now })
      .where('id', '=', row.signup_id)
      .execute();
  }
  return due.length;
}
