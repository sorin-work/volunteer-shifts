import { Router, type Request } from 'express';
import type { EventStatus } from '../../db/types.js';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { addDays } from '../../lib/time.js';
import { containsPattern } from '../../lib/search.js';
import { validate } from '../../lib/validate.js';
import { sendSafely } from '../../mail/mailer.js';
import { shiftMailInfo } from '../../mail/shift-info.js';
import { templates } from '../../mail/templates.js';
import { currentUser, requireAuth, requireCoordinator } from '../../middleware/auth.js';
import { requiredSkillsByRole, toRoleDto } from '../roles/dto.js';
import { eligibilityProblem } from '../signups/eligibility.js';
import { toShiftDto } from '../shifts/dto.js';
import { resolveShiftTimes } from '../shifts/schedule.js';
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
    } else if (['draft', 'published', 'cancelled'].includes(String(req.query.status))) {
      query = query.where('events.status', '=', req.query.status as EventStatus);
    }
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      const pattern = containsPattern(search);
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
    const user = currentUser(req);
    const userId = user.id;
    const mySkills = new Set(
      (
        await ctx.db
          .selectFrom('user_skills')
          .select('skill_id')
          .where('user_id', '=', userId)
          .execute()
      ).map((r) => r.skill_id),
    );
    const roleById = new Map(roles.map((r) => [r.id, r]));
    res.json({
      event: toEventDto(event),
      roles: roles.map((r) => toRoleDto(r, skills.get(r.id))),
      shifts: shifts.map((s) => {
        const forShift = signups.filter((x) => x.shift_id === s.id);
        const mine = forShift.find((x) => x.user_id === userId);
        const dto = toShiftDto(s, event.timezone);
        const role = roleById.get(s.role_id)!;
        return {
          ...dto,
          eligibility: eligibilityProblem(
            user,
            mySkills,
            { ...role, requiredSkills: skills.get(role.id) ?? [] },
            dto.date,
          ),
          confirmedCount: forShift.filter((x) => x.status === 'confirmed').length,
          waitlistCount: forShift.filter((x) => x.status === 'waitlisted').length,
          mySignup: mine ? { id: mine.id, status: mine.status } : null,
        };
      }),
    });
  });

  /** Turnout for an event: how many came, didn't show, and hours given. */
  router.get('/:id/summary', requireCoordinator, async (req, res) => {
    const event = await findVisibleEvent(req);
    const rows = await ctx.db
      .selectFrom('signups')
      .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
      .select(['signups.status', 'signups.attendance', (eb) => eb.fn.countAll<number>().as('n')])
      .where('shifts.event_id', '=', event.id)
      .groupBy(['signups.status', 'signups.attendance'])
      .execute();
    const hours = await ctx.db
      .selectFrom('hour_entries')
      .innerJoin('signups', 'signups.id', 'hour_entries.signup_id')
      .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
      .select((eb) =>
        eb.fn.coalesce(eb.fn.sum<number>('hour_entries.hours'), eb.lit(0)).as('total'),
      )
      .where('shifts.event_id', '=', event.id)
      .executeTakeFirstOrThrow();
    const count = (pred: (r: (typeof rows)[number]) => boolean) =>
      rows.filter(pred).reduce((sum, r) => sum + Number(r.n), 0);
    const present = count((r) => r.status === 'confirmed' && r.attendance === 'present');
    const noShows = count((r) => r.status === 'confirmed' && r.attendance === 'no_show');
    res.json({
      summary: {
        confirmed: count((r) => r.status === 'confirmed'),
        waitlisted: count((r) => r.status === 'waitlisted'),
        cancelled: count((r) => r.status === 'cancelled'),
        present,
        noShows,
        // Of the shifts where attendance was taken, how many people turned up.
        turnout: present + noShows ? Math.round((present / (present + noShows)) * 100) : null,
        hours: Math.round(Number(hours.total) * 100) / 100,
      },
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

  // Plan next year's festival from this one: copies details, roles and
  // shifts moved by a number of days, as a new draft.
  router.post('/:id/duplicate', requireCoordinator, async (req, res) => {
    const source = await findVisibleEvent(req);
    const input = validate(
      z.object({
        name: z.string().trim().min(1).max(160).optional(),
        shiftDays: z.number().int().min(-3650).max(3650).default(0),
      }),
      req.body ?? {},
    );
    const copy = await ctx.db.transaction().execute(async (trx) => {
      const event = await trx
        .insertInto('events')
        .values({
          name: input.name ?? `${source.name} (copy)`,
          description: source.description,
          location: source.location,
          timezone: source.timezone,
          created_by: currentUser(req).id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const roles = await trx
        .selectFrom('roles')
        .selectAll()
        .where('event_id', '=', source.id)
        .execute();
      const roleMap = new Map<number, number>();
      for (const role of roles) {
        const created = await trx
          .insertInto('roles')
          .values({
            event_id: event.id,
            name: role.name,
            description: role.description,
            min_age: role.min_age,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        roleMap.set(role.id, created.id);
        const skills = await trx
          .selectFrom('role_skills')
          .select('skill_id')
          .where('role_id', '=', role.id)
          .execute();
        if (skills.length) {
          await trx
            .insertInto('role_skills')
            .values(skills.map((s) => ({ role_id: created.id, skill_id: s.skill_id })))
            .execute();
        }
      }
      const shifts = await trx
        .selectFrom('shifts')
        .selectAll()
        .where('event_id', '=', source.id)
        .execute();
      if (shifts.length) {
        await trx
          .insertInto('shifts')
          .values(
            shifts.map((s) => {
              // Keep local wall-clock times even across DST changes.
              const local = toShiftDto(s, source.timezone);
              const times = resolveShiftTimes(
                { ...local, date: addDays(local.date, input.shiftDays) },
                source.timezone,
              );
              return {
                event_id: event.id,
                role_id: roleMap.get(s.role_id)!,
                starts_at: times.startsAt,
                ends_at: times.endsAt,
                capacity: s.capacity,
                notes: s.notes,
              };
            }),
          )
          .execute();
      }
      return event;
    });
    res.status(201).json({ event: toEventDto(copy) });
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
