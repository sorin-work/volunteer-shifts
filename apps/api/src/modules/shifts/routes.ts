import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { isIsoDate, isTimeOfDay } from '../../lib/time.js';
import { validate } from '../../lib/validate.js';
import { requireCoordinator } from '../../middleware/auth.js';
import { getEditableEvent } from '../events/queries.js';
import { sendSafely } from '../../mail/mailer.js';
import { shiftMailInfo } from '../../mail/shift-info.js';
import { templates } from '../../mail/templates.js';
import {
  countConfirmed,
  getShiftWithEvent,
  notifyPromoted,
  promoteFromWaitlist,
} from '../signups/service.js';
import { toShiftDto } from './dto.js';
import { durationHours, MAX_SHIFT_HOURS, resolveShiftTimes } from './schedule.js';

const date = z.string().refine(isIsoDate, 'Use a date like 2026-05-30.');
const time = z.string().refine(isTimeOfDay, 'Use a 24-hour time like 09:30.');

const shiftSchema = z.object({
  roleId: z.number().int().positive(),
  date,
  startTime: time,
  endTime: time,
  capacity: z.number().int().min(1, 'At least one volunteer.').max(500),
  notes: z.string().trim().max(1000).default(''),
});

export function shiftRoutes(ctx: AppContext): Router {
  const router = Router();

  async function assertRoleInEvent(roleId: number, eventId: number) {
    const role = await ctx.db
      .selectFrom('roles')
      .select('id')
      .where('id', '=', roleId)
      .where('event_id', '=', eventId)
      .executeTakeFirst();
    if (!role) throw badRequest('That role does not belong to this event.');
  }

  function checkedTimes(input: z.infer<typeof shiftSchema>, timezone: string) {
    const times = resolveShiftTimes(input, timezone);
    if (durationHours(times.startsAt, times.endsAt) > MAX_SHIFT_HOURS) {
      throw badRequest(`Shifts can be at most ${MAX_SHIFT_HOURS} hours long.`);
    }
    return times;
  }

  async function getShift(id: number) {
    const shift = await ctx.db
      .selectFrom('shifts')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!shift) throw notFound('Shift');
    return shift;
  }

  /** Shifts in the next few days that still need people, emptiest first. */
  router.get('/shifts/understaffed', requireCoordinator, async (req, res) => {
    const days = Math.min(31, Math.max(1, Number(req.query.days) || 7));
    const now = ctx.now();
    const until = new Date(now.getTime() + days * 86_400_000);
    const rows = await ctx.db
      .selectFrom('shifts')
      .innerJoin('events', 'events.id', 'shifts.event_id')
      .innerJoin('roles', 'roles.id', 'shifts.role_id')
      .selectAll('shifts')
      .select((eb) => [
        'events.name as event_name',
        'events.timezone as event_timezone',
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
      .where('shifts.starts_at', '<=', until)
      .orderBy('shifts.starts_at')
      .execute();
    const shifts = rows
      .map((r) => ({
        ...toShiftDto(r, r.event_timezone),
        eventName: r.event_name,
        roleName: r.role_name,
        confirmedCount: Number(r.confirmed ?? 0),
      }))
      .filter((s) => s.confirmedCount < s.capacity)
      .sort((a, b) => a.confirmedCount / a.capacity - b.confirmedCount / b.capacity);
    res.json({ shifts });
  });

  router.post('/events/:id/shifts', requireCoordinator, async (req, res) => {
    const event = await getEditableEvent(ctx.db, idParam(req.params.id, 'Event'));
    const input = validate(shiftSchema, req.body);
    await assertRoleInEvent(input.roleId, event.id);
    const { startsAt, endsAt } = checkedTimes(input, event.timezone);
    const shift = await ctx.db
      .insertInto('shifts')
      .values({
        event_id: event.id,
        role_id: input.roleId,
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: input.capacity,
        notes: input.notes,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    res.status(201).json({ shift: toShiftDto(shift, event.timezone) });
  });

  // Repeat a day's schedule on another date, e.g. next Saturday's food bank.
  router.post('/events/:id/shifts/copy', requireCoordinator, async (req, res) => {
    const event = await getEditableEvent(ctx.db, idParam(req.params.id, 'Event'));
    const { fromDate, toDate } = validate(z.object({ fromDate: date, toDate: date }), req.body);
    if (fromDate === toDate) throw badRequest('Pick a different date to copy to.');
    const source = (
      await ctx.db
        .selectFrom('shifts')
        .selectAll()
        .where('event_id', '=', event.id)
        .orderBy('starts_at')
        .execute()
    )
      .map((s) => toShiftDto(s, event.timezone))
      .filter((s) => s.date === fromDate);
    if (!source.length) throw badRequest('There are no shifts on that date.');

    const values = source.map((s) => {
      const times = resolveShiftTimes({ ...s, date: toDate }, event.timezone);
      return {
        event_id: event.id,
        role_id: s.roleId,
        starts_at: times.startsAt,
        ends_at: times.endsAt,
        capacity: s.capacity,
        notes: s.notes,
      };
    });
    const created = await ctx.db.insertInto('shifts').values(values).returningAll().execute();
    res.status(201).json({ shifts: created.map((s) => toShiftDto(s, event.timezone)) });
  });

  router.patch('/shifts/:id', requireCoordinator, async (req, res) => {
    const shift = await getShift(idParam(req.params.id, 'Shift'));
    const event = await getEditableEvent(ctx.db, shift.event_id);
    const current = toShiftDto(shift, event.timezone);
    const input = validate(shiftSchema, { ...current, ...req.body });
    if (input.roleId !== shift.role_id) await assertRoleInEvent(input.roleId, event.id);
    if (input.capacity < shift.capacity) {
      const confirmed = await countConfirmed(ctx, shift.id);
      if (input.capacity < confirmed) {
        throw conflict(
          'capacity_below_signups',
          `${confirmed} people are already confirmed. Remove some before lowering the capacity.`,
        );
      }
    }
    const { startsAt, endsAt } = checkedTimes(input, event.timezone);
    const updated = await ctx.db
      .updateTable('shifts')
      .set({
        role_id: input.roleId,
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: input.capacity,
        notes: input.notes,
      })
      .where('id', '=', shift.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    if (updated.capacity > shift.capacity) {
      await notifyPromoted(ctx, await promoteFromWaitlist(ctx, shift.id));
    }
    if (updated.starts_at.getTime() !== shift.starts_at.getTime()) {
      // A reminder sent for the old time is no longer right.
      await ctx.db
        .updateTable('signups')
        .set({ reminder_sent_at: null })
        .where('shift_id', '=', shift.id)
        .execute();
    }
    res.json({ shift: toShiftDto(updated, event.timezone) });
  });

  router.delete('/shifts/:id', requireCoordinator, async (req, res) => {
    const shift = await getShift(idParam(req.params.id, 'Shift'));
    const event = await getEditableEvent(ctx.db, shift.event_id);
    const details = await getShiftWithEvent(ctx, shift.id);
    const affected =
      shift.starts_at > ctx.now() && event.status === 'published'
        ? await ctx.db
            .selectFrom('signups')
            .innerJoin('users', 'users.id', 'signups.user_id')
            .select(['users.name', 'users.email'])
            .where('signups.shift_id', '=', shift.id)
            .where('signups.status', '<>', 'cancelled')
            .execute()
        : [];
    await ctx.db.deleteFrom('shifts').where('id', '=', shift.id).execute();
    for (const person of affected) {
      await sendSafely(
        ctx.mailer,
        ctx.logger,
        templates.shiftRemoved(person.email, shiftMailInfo(ctx, details, person)),
      );
    }
    res.status(204).end();
  });

  return router;
}
