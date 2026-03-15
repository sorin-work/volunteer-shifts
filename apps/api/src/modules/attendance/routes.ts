import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { idParam } from '../../lib/params.js';
import { requireCoordinator } from '../../middleware/auth.js';
import { requiredSkillsByRole, toRoleDto } from '../roles/dto.js';
import { toShiftDto } from '../shifts/dto.js';
import { getShiftWithEvent } from '../signups/service.js';

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
      volunteer: { id: r.user_id, name: r.name, email: r.email, phone: r.phone },
    });

    res.json({
      shift: toShiftDto(shift, shift.event_timezone),
      event: { id: shift.event_id, name: shift.event_name, timezone: shift.event_timezone },
      role: toRoleDto(role, skills.get(role.id)),
      confirmed: rows.filter((r) => r.status === 'confirmed').map(toEntry),
      waitlist: rows.filter((r) => r.status === 'waitlisted').map(toEntry),
    });
  });

  return router;
}
