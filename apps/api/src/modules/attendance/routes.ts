import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { toCsv } from '../../lib/csv.js';
import { conflict, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { validate } from '../../lib/validate.js';
import { currentUser, requireCoordinator } from '../../middleware/auth.js';
import { creditShiftHours, removeShiftHours } from '../hours/credit.js';
import { requiredSkillsByRole, toRoleDto } from '../roles/dto.js';
import { toShiftDto } from '../shifts/dto.js';
import { toSignupDto } from '../signups/dto.js';
import { getShiftWithEvent } from '../signups/service.js';

/** Volunteers can be checked in this long before their shift starts. */
export const EARLY_CHECK_IN_MINUTES = 60;

const attendanceSchema = z.object({
  attendance: z.enum(['present', 'no_show', 'pending']),
});

export function attendanceRoutes(ctx: AppContext): Router {
  const router = Router();

  /** Everyone signed up for a shift, with contact details for the coordinator. */
  router.get('/shifts/:id/roster', requireCoordinator, async (req, res) => {
    const shift = await getShiftWithEvent(ctx, idParam(req.params.id, 'Shift'));
    const [rows, role, skills] = await Promise.all([
      ctx.db
        .selectFrom('signups')
        .innerJoin('users', 'users.id', 'signups.user_id')
        .select([
          'signups.id',
          'signups.status',
          'signups.attendance',
          'signups.checked_in_at',
          'signups.created_at',
          'users.id as user_id',
          'users.name',
          'users.email',
          'users.phone',
          (eb) =>
            eb
              .selectFrom('signups as past')
              .innerJoin('shifts as ps', 'ps.id', 'past.shift_id')
              .select((sub) => sub.fn.countAll<number>().as('n'))
              .whereRef('past.user_id', '=', 'users.id')
              .where('past.attendance', '=', 'no_show')
              .where('ps.starts_at', '>', new Date(ctx.now().getTime() - 365 * 86_400_000))
              .as('recent_no_shows'),
        ])
        .where('signups.shift_id', '=', shift.id)
        .where('signups.status', '<>', 'cancelled')
        .orderBy('signups.status')
        .orderBy('signups.created_at')
        .execute(),
      ctx.db
        .selectFrom('roles')
        .selectAll()
        .where('id', '=', shift.role_id)
        .executeTakeFirstOrThrow(),
      requiredSkillsByRole(ctx.db, [shift.role_id]),
    ]);

    const toEntry = (r: (typeof rows)[number]) => ({
      signupId: r.id,
      status: r.status,
      attendance: r.attendance,
      checkedInAt: r.checked_in_at?.toISOString() ?? null,
      signedUpAt: r.created_at.toISOString(),
      volunteer: {
        id: r.user_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        recentNoShows: Number(r.recent_no_shows ?? 0),
      },
    });

    res.json({
      shift: toShiftDto(shift, shift.event_timezone),
      event: { id: shift.event_id, name: shift.event_name, timezone: shift.event_timezone },
      role: toRoleDto(role, skills.get(role.id)),
      confirmed: rows.filter((r) => r.status === 'confirmed').map(toEntry),
      waitlist: rows.filter((r) => r.status === 'waitlisted').map(toEntry),
    });
  });

  router.get('/shifts/:id/roster.csv', requireCoordinator, async (req, res) => {
    const shift = await getShiftWithEvent(ctx, idParam(req.params.id, 'Shift'));
    const rows = await ctx.db
      .selectFrom('signups')
      .innerJoin('users', 'users.id', 'signups.user_id')
      .select([
        'users.name',
        'users.email',
        'users.phone',
        'signups.status',
        'signups.attendance',
        'signups.checked_in_at',
      ])
      .where('signups.shift_id', '=', shift.id)
      .where('signups.status', '<>', 'cancelled')
      .orderBy('signups.status')
      .orderBy('signups.created_at')
      .execute();
    const csv = toCsv(
      ['Name', 'Email', 'Phone', 'Status', 'Attendance', 'Checked in at'],
      rows.map((r) => [
        r.name,
        r.email,
        r.phone,
        r.status,
        r.attendance,
        r.checked_in_at?.toISOString() ?? '',
      ]),
    );
    const { date } = toShiftDto(shift, shift.event_timezone);
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="roster-${date}-shift-${shift.id}.csv"`)
      .send(csv);
  });

  router.post('/signups/:id/attendance', requireCoordinator, async (req, res) => {
    const { attendance } = validate(attendanceSchema, req.body);
    const signup = await ctx.db
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
      .where('signups.id', '=', idParam(req.params.id, 'Signup'))
      .executeTakeFirst();
    if (!signup) throw notFound('Signup');
    if (signup.status !== 'confirmed') {
      throw conflict('not_confirmed', 'Only confirmed volunteers can be checked in.');
    }
    const now = ctx.now();
    if (
      attendance === 'present' &&
      now.getTime() < signup.starts_at.getTime() - EARLY_CHECK_IN_MINUTES * 60_000
    ) {
      throw conflict('too_early', 'Check-in opens an hour before the shift starts.');
    }
    if (attendance === 'no_show' && now < signup.starts_at) {
      throw conflict('shift_not_started', "You can't mark a no-show before the shift starts.");
    }

    const updated = await ctx.db
      .updateTable('signups')
      .set({
        attendance,
        checked_in_at: attendance === 'present' ? (signup.checked_in_at ?? now) : null,
        attendance_marked_by: currentUser(req).id,
      })
      .where('id', '=', signup.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (attendance === 'present' && signup.attendance !== 'present') {
      await creditShiftHours(ctx, signup, currentUser(req).id);
    } else if (attendance !== 'present' && signup.attendance === 'present') {
      await removeShiftHours(ctx, signup.id);
    }
    res.json({ signup: toSignupDto(updated) });
  });

  return router;
}
