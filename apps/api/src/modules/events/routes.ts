import { Router, type Request } from 'express';
import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { validate } from '../../lib/validate.js';
import { sendSafely } from '../../mail/mailer.js';
import { shiftMailInfo } from '../../mail/shift-info.js';
import { templates } from '../../mail/templates.js';
import { currentUser, requireAuth, requireCoordinator } from '../../middleware/auth.js';
import { requiredSkillsByRole, toRoleDto } from '../roles/dto.js';
import { toShiftDto } from '../shifts/dto.js';
import { toEventDto } from './dto.js';
import { createEventSchema, updateEventSchema } from './schemas.js';

export function eventRoutes(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  /** Loads an event the current user may see: volunteers only see published ones. */
  async function findVisibleEvent(req: Request) {
    const id = idParam(req.params.id, 'Event');
    const event = await ctx.db
      .selectFrom('events')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!event) throw notFound('Event');
    if (currentUser(req).role !== 'coordinator' && event.status === 'draft') {
      throw notFound('Event');
    }
    return event;
  }

  router.get('/', async (req, res) => {
    const when = ['upcoming', 'past', 'all'].includes(String(req.query.when))
      ? String(req.query.when)
      : 'upcoming';
    let query = ctx.db
      .selectFrom('events')
      .leftJoin('shifts', 'shifts.event_id', 'events.id')
      .selectAll('events')
      .select((eb) => [
        eb.fn.min('shifts.starts_at').as('first_starts_at'),
        eb.fn.max('shifts.ends_at').as('last_ends_at'),
        eb.fn.count<number>('shifts.id').as('shift_count'),
        eb.fn.coalesce(eb.fn.sum<number>('shifts.capacity'), eb.lit(0)).as('total_spots'),
        eb
          .selectFrom('signups')
          .innerJoin('shifts as s2', 's2.id', 'signups.shift_id')
          .select((sub) => sub.fn.countAll<number>().as('n'))
          .whereRef('s2.event_id', '=', 'events.id')
          .where('signups.status', '=', 'confirmed')
          .as('filled_spots'),
      ])
      .groupBy('events.id');
    if (currentUser(req).role !== 'coordinator') {
      query = query.where('events.status', '=', 'published');
    }
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      query = query.where((eb) =>
        eb.or([eb('events.name', 'ilike', pattern), eb('events.location', 'ilike', pattern)]),
      );
    }
    const now = ctx.now();
    if (when === 'upcoming') {
      // Events still to come, plus drafts that have no shifts yet.
      query = query.having((eb) =>
        eb.or([eb(eb.fn.max('shifts.ends_at'), '>', now), eb(eb.fn.count('shifts.id'), '=', 0)]),
      );
    } else if (when === 'past') {
      query = query.having((eb) => eb(eb.fn.max('shifts.ends_at'), '<=', now));
    }
    const rows = await query
      .orderBy(
        (eb) => eb.fn.min('shifts.starts_at'),
        (ob) => ob.asc().nullsLast(),
      )
      .orderBy('events.id')
      .execute();
    res.json({
      events: rows.map((r) => ({
        ...toEventDto(r),
        firstShiftAt: r.first_starts_at ? new Date(r.first_starts_at).toISOString() : null,
        lastShiftEndsAt: r.last_ends_at ? new Date(r.last_ends_at).toISOString() : null,
        shiftCount: Number(r.shift_count),
        totalSpots: Number(r.total_spots),
        filledSpots: Number(r.filled_spots ?? 0),
      })),
    });
  });

  router.post('/', requireCoordinator, async (req, res) => {
    const input = validate(createEventSchema, req.body);
    const event = await ctx.db
      .insertInto('events')
      .values({ ...input, created_by: currentUser(req).id })
      .returningAll()
      .executeTakeFirstOrThrow();
    res.status(201).json({ event: toEventDto(event) });
  });

  router.get('/:id', async (req, res) => {
    const event = await findVisibleEvent(req);
    const [roles, shifts] = await Promise.all([
      ctx.db
        .selectFrom('roles')
        .selectAll()
        .where('event_id', '=', event.id)
        .orderBy('name')
        .execute(),
      ctx.db
        .selectFrom('shifts')
        .selectAll()
        .where('event_id', '=', event.id)
        .orderBy('starts_at')
        .orderBy('id')
        .execute(),
    ]);
    const shiftIds = shifts.map((s) => s.id);
    const signups = shiftIds.length
      ? await ctx.db
          .selectFrom('signups')
          .select(['id', 'shift_id', 'user_id', 'status'])
          .where('shift_id', 'in', shiftIds)
          .where('status', '<>', 'cancelled')
          .execute()
      : [];
    const skills = await requiredSkillsByRole(
      ctx.db,
      roles.map((r) => r.id),
    );
    const userId = currentUser(req).id;
    res.json({
      event: toEventDto(event),
      roles: roles.map((r) => toRoleDto(r, skills.get(r.id))),
      shifts: shifts.map((s) => {
        const forShift = signups.filter((x) => x.shift_id === s.id);
        const mine = forShift.find((x) => x.user_id === userId);
        return {
          ...toShiftDto(s, event.timezone),
          confirmedCount: forShift.filter((x) => x.status === 'confirmed').length,
          waitlistCount: forShift.filter((x) => x.status === 'waitlisted').length,
          mySignup: mine ? { id: mine.id, status: mine.status } : null,
        };
      }),
    });
  });

  router.patch('/:id', requireCoordinator, async (req, res) => {
    const event = await findVisibleEvent(req);
    const input = validate(updateEventSchema, req.body);
    if (event.status === 'cancelled') {
      throw conflict('event_cancelled', 'Cancelled events can no longer be edited.');
    }
    const updated = await ctx.db
      .updateTable('events')
      .set({ ...input, updated_at: ctx.now() })
      .where('id', '=', event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    res.json({ event: toEventDto(updated) });
  });

  router.post('/:id/publish', requireCoordinator, async (req, res) => {
    const event = await findVisibleEvent(req);
    if (event.status === 'cancelled') {
      throw conflict('event_cancelled', 'A cancelled event cannot be published again.');
    }
    const updated = await ctx.db
      .updateTable('events')
      .set({ status: 'published', updated_at: ctx.now() })
      .where('id', '=', event.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    res.json({ event: toEventDto(updated) });
  });

  router.post('/:id/cancel', requireCoordinator, async (req, res) => {
    const event = await findVisibleEvent(req);
    const updated = await ctx.db
      .updateTable('events')
      .set({ status: 'cancelled', updated_at: ctx.now() })
      .where('id', '=', event.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (event.status === 'published') {
      // Let everyone with an upcoming shift know it won't happen.
      const affected = await ctx.db
        .selectFrom('signups')
        .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
        .innerJoin('roles', 'roles.id', 'shifts.role_id')
        .innerJoin('users', 'users.id', 'signups.user_id')
        .select([
          'shifts.event_id',
          'shifts.starts_at',
          'shifts.ends_at',
          'shifts.notes',
          'roles.name as role_name',
          'users.name',
          'users.email',
        ])
        .where('shifts.event_id', '=', event.id)
        .where('shifts.starts_at', '>', ctx.now())
        .where('signups.status', '<>', 'cancelled')
        .execute();
      for (const row of affected) {
        const info = shiftMailInfo(
          ctx,
          {
            ...row,
            event_name: event.name,
            event_timezone: event.timezone,
            event_location: event.location,
          },
          row,
        );
        await sendSafely(ctx.mailer, ctx.logger, templates.eventCancelled(row.email, info));
      }
    }
    res.json({ event: toEventDto(updated) });
  });

  return router;
}
