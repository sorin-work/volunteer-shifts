import { Router } from 'express';
import type { AppContext } from '../../context.js';
import type { Signup } from '../../db/types.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { toIcs } from '../../lib/ics.js';
import { idParam } from '../../lib/params.js';
import { sendSafely } from '../../mail/mailer.js';
import { shiftMailInfo } from '../../mail/shift-info.js';
import { templates } from '../../mail/templates.js';
import { toShiftDto } from '../shifts/dto.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { notifyPromoted, promoteFromWaitlist, signUp, waitlistPosition } from './service.js';

export function toSignupDto(signup: Signup) {
  return {
    id: signup.id,
    shiftId: signup.shift_id,
    userId: signup.user_id,
    status: signup.status,
    createdAt: signup.created_at.toISOString(),
    cancelledAt: signup.cancelled_at?.toISOString() ?? null,
    attendance: signup.attendance,
    checkedInAt: signup.checked_in_at?.toISOString() ?? null,
  };
}

export function signupRoutes(ctx: AppContext): Router {
  const router = Router();

  router.post('/shifts/:id/signups', requireAuth, async (req, res) => {
    const me = currentUser(req);
    // Coordinators can put someone else on a shift, e.g. after a phone call.
    let user = me;
    const forUserId = (req.body as { userId?: unknown } | undefined)?.userId;
    if (forUserId !== undefined && forUserId !== me.id) {
      if (me.role !== 'coordinator') throw forbidden('Only coordinators can sign up other people.');
      const other = await ctx.db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', Number(forUserId) || 0)
        .executeTakeFirst();
      if (!other) throw notFound('Volunteer');
      user = other;
    }
    const { signup, shift } = await signUp(ctx, user, idParam(req.params.id, 'Shift'));
    const position = await waitlistPosition(ctx, signup);
    const info = shiftMailInfo(ctx, shift, user);
    await sendSafely(
      ctx.mailer,
      ctx.logger,
      position === null
        ? templates.signupConfirmed(user.email, info)
        : templates.signupWaitlisted(user.email, info, position),
    );
    res.status(201).json({ signup: { ...toSignupDto(signup), waitlistPosition: position } });
  });

  router.get('/me/signups', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const when = req.query.when === 'past' ? 'past' : 'upcoming';
    let query = ctx.db
      .selectFrom('signups')
      .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
      .innerJoin('events', 'events.id', 'shifts.event_id')
      .innerJoin('roles', 'roles.id', 'shifts.role_id')
      .selectAll('signups')
      .select([
        'shifts.event_id',
        'shifts.role_id',
        'shifts.starts_at',
        'shifts.ends_at',
        'shifts.capacity',
        'shifts.notes',
        'shifts.created_at as shift_created_at',
        'events.name as event_name',
        'events.location as event_location',
        'events.timezone as event_timezone',
        'events.status as event_status',
        'roles.name as role_name',
      ])
      .where('signups.user_id', '=', user.id)
      .where('signups.status', '<>', 'cancelled');
    query =
      when === 'upcoming'
        ? query.where('shifts.ends_at', '>', ctx.now()).orderBy('shifts.starts_at', 'asc')
        : query.where('shifts.ends_at', '<=', ctx.now()).orderBy('shifts.starts_at', 'desc');
    const rows = await query.execute();
    const positions = new Map<number, number | null>();
    for (const r of rows) {
      if (r.status === 'waitlisted') positions.set(r.id, await waitlistPosition(ctx, r));
    }
    res.json({
      signups: rows.map((r) => ({
        ...toSignupDto(r),
        waitlistPosition: positions.get(r.id) ?? null,
        shift: toShiftDto(
          {
            id: r.shift_id,
            event_id: r.event_id,
            role_id: r.role_id,
            starts_at: r.starts_at,
            ends_at: r.ends_at,
            capacity: r.capacity,
            notes: r.notes,
            created_at: r.shift_created_at,
          },
          r.event_timezone,
        ),
        event: {
          id: r.event_id,
          name: r.event_name,
          location: r.event_location,
          timezone: r.event_timezone,
          status: r.event_status,
        },
        role: { id: r.role_id, name: r.role_name },
      })),
    });
  });

  router.get('/signups/:id/calendar.ics', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const row = await ctx.db
      .selectFrom('signups')
      .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
      .innerJoin('events', 'events.id', 'shifts.event_id')
      .innerJoin('roles', 'roles.id', 'shifts.role_id')
      .select([
        'signups.id',
        'signups.user_id',
        'shifts.starts_at',
        'shifts.ends_at',
        'shifts.notes',
        'shifts.event_id',
        'events.name as event_name',
        'events.location',
        'roles.name as role_name',
      ])
      .where('signups.id', '=', idParam(req.params.id, 'Signup'))
      .where('signups.status', '<>', 'cancelled')
      .executeTakeFirst();
    if (!row || row.user_id !== user.id) throw notFound('Signup');
    const ics = toIcs({
      uid: `signup-${row.id}@volunteer-shifts`,
      start: row.starts_at,
      end: row.ends_at,
      stamp: ctx.now(),
      summary: `${row.event_name}: ${row.role_name}`,
      location: row.location,
      description: row.notes,
      url: new URL(`/events/${row.event_id}`, ctx.config.APP_URL).toString(),
    });
    res
      .type('text/calendar; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="shift-${row.id}.ics"`)
      .send(ics);
  });

  router.delete('/signups/:id', requireAuth, async (req, res) => {
    const user = currentUser(req);
    const signup = await ctx.db
      .selectFrom('signups')
      .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
      .selectAll('signups')
      .select('shifts.starts_at')
      .where('signups.id', '=', idParam(req.params.id, 'Signup'))
      .executeTakeFirst();
    // Volunteers can only cancel their own signups; coordinators can remove anyone.
    if (!signup || (user.role !== 'coordinator' && signup.user_id !== user.id)) {
      throw notFound('Signup');
    }
    if (signup.status === 'cancelled') {
      throw conflict('already_cancelled', 'This signup was already cancelled.');
    }
    if (signup.starts_at <= ctx.now() && user.role !== 'coordinator') {
      throw conflict('shift_started', 'The shift has started, ask a coordinator for help.');
    }
    const updated = await ctx.db
      .updateTable('signups')
      .set({ status: 'cancelled', cancelled_at: ctx.now() })
      .where('id', '=', signup.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    if (signup.status === 'confirmed') {
      await notifyPromoted(ctx, await promoteFromWaitlist(ctx, signup.shift_id));
    }
    res.json({ signup: toSignupDto(updated) });
  });

  return router;
}
