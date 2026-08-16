import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { toCsv } from '../../lib/csv.js';
import { idParam } from '../../lib/params.js';
import { validate } from '../../lib/validate.js';
import { currentUser, requireCoordinator } from '../../middleware/auth.js';
import { requiredSkillsByRole, toRoleDto } from '../roles/dto.js';
import { toShiftDto } from '../shifts/dto.js';
import { toSignupDto } from '../signups/dto.js';
import { getShiftWithEvent } from '../signups/service.js';
import { markAttendance } from './service.js';

/** Cancelling within this many hours of the start counts as late. */
export const LATE_CANCELLATION_HOURS = 24;

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

    // Cancellations in the last 24 hours before the start are worth knowing
    // about when planning cover.
    const lateCutoff = new Date(shift.starts_at.getTime() - LATE_CANCELLATION_HOURS * 3_600_000);
    const late = await ctx.db
      .selectFrom('signups')
      .innerJoin('users', 'users.id', 'signups.user_id')
      .select(['signups.id', 'signups.cancelled_at', 'users.id as user_id', 'users.name'])
      .where('signups.shift_id', '=', shift.id)
      .where('signups.status', '=', 'cancelled')
      .where('signups.cancelled_at', '>=', lateCutoff)
      .orderBy('signups.cancelled_at', 'desc')
      .execute();

    res.json({
      lateCancellations: late.map((l) => ({
        signupId: l.id,
        cancelledAt: l.cancelled_at!.toISOString(),
        volunteer: { id: l.user_id, name: l.name },
      })),
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
    const updated = await markAttendance(
      ctx,
      idParam(req.params.id, 'Signup'),
      attendance,
      currentUser(req).id,
    );
    res.json({ signup: toSignupDto(updated) });
  });

  return router;
}
