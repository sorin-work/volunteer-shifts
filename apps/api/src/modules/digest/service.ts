import type { AppContext } from '../../context.js';
import { escapeHtml } from '../../lib/html.js';
import { sendSafely } from '../../mail/mailer.js';
import { formatShiftWhen } from '../../mail/templates.js';

const JOB = 'coordinator-digest';
const LOOKAHEAD_DAYS = 3;

/** Shifts in the next few days that still have open spots. */
async function understaffed(ctx: AppContext) {
  const now = ctx.now();
  const rows = await ctx.db
    .selectFrom('shifts')
    .innerJoin('events', 'events.id', 'shifts.event_id')
    .innerJoin('roles', 'roles.id', 'shifts.role_id')
    .select((eb) => [
      'shifts.id',
      'shifts.starts_at',
      'shifts.ends_at',
      'shifts.capacity',
      'events.name as event_name',
      'events.timezone',
      'roles.name as role_name',
      eb
        .selectFrom('signups')
        .select((sub) => sub.fn.countAll<number>().as('n'))
        .whereRef('signups.shift_id', '=', 'shifts.id')
        .where('signups.status', '=', 'confirmed')
        .as('confirmed'),
    ])
    .where('events.status', '=', 'published')
    .where('shifts.starts_at', '>', now)
    .where('shifts.starts_at', '<=', new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000))
    .orderBy('shifts.starts_at')
    .execute();
  return rows.filter((r) => Number(r.confirmed ?? 0) < r.capacity);
}

/**
 * Emails every coordinator a list of shifts that still need people. Runs at
 * most once per day; returns how many emails went out.
 */
export async function sendCoordinatorDigest(ctx: AppContext): Promise<number> {
  const now = ctx.now();
  if (now.getUTCHours() < ctx.config.DIGEST_HOUR_UTC) return 0;
  const today = now.toISOString().slice(0, 10);
  const claimed = await ctx.db
    .insertInto('job_runs')
    .values({ name: JOB, run_on: today })
    .onConflict((oc) => oc.doNothing())
    .returning('name')
    .executeTakeFirst();
  if (!claimed) return 0;

  const shifts = await understaffed(ctx);
  if (!shifts.length) return 0;

  const lines = shifts.map(
    (s) =>
      `${s.event_name}: ${s.role_name}, ${formatShiftWhen(s.starts_at, s.ends_at, s.timezone)}, ` +
      `${Number(s.confirmed ?? 0)}/${s.capacity} filled`,
  );
  const url = new URL('/', ctx.config.APP_URL).toString();
  const coordinators = await ctx.db
    .selectFrom('users')
    .select(['name', 'email'])
    .where('role', '=', 'coordinator')
    .execute();
  for (const c of coordinators) {
    await sendSafely(ctx.mailer, ctx.logger, {
      to: c.email,
      subject:
        shifts.length === 1
          ? '1 shift still needs volunteers'
          : `${shifts.length} shifts still need volunteers`,
      text: [
        `Hi ${c.name},`,
        '',
        'These shifts in the next few days are not full yet:',
        '',
        ...lines,
        '',
        url,
      ].join('\n'),
      html: `<p>Hi ${escapeHtml(c.name)},</p><p>These shifts in the next few days are not full yet:</p><ul>${lines
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join('')}</ul><p><a href="${escapeHtml(url)}">Open Volunteer Shifts</a></p>`,
    });
  }
  return coordinators.length;
}
