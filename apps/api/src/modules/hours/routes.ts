import { Router, type Request } from 'express';
import { sql } from 'kysely';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import type { HourEntry } from '../../db/types.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { isIsoDate } from '../../lib/time.js';
import { validate } from '../../lib/validate.js';
import { currentUser, requireAuth, requireCoordinator } from '../../middleware/auth.js';

const manualEntrySchema = z.object({
  workedOn: z.string().refine(isIsoDate, 'Use a date like 2026-05-30.'),
  hours: z
    .number()
    .min(0.25, 'At least a quarter of an hour.')
    .max(24, 'At most 24 hours in one entry.')
    .multipleOf(0.25, 'Use quarter hours, like 1.5 or 2.75.'),
  description: z.string().trim().min(1, 'Say what the time was for.').max(300),
});

export function toHourEntryDto(entry: HourEntry) {
  return {
    id: entry.id,
    userId: entry.user_id,
    signupId: entry.signup_id,
    workedOn: entry.worked_on,
    hours: Number(entry.hours),
    description: entry.description,
    source: entry.signup_id ? ('shift' as const) : ('manual' as const),
    createdAt: entry.created_at.toISOString(),
  };
}

/** Volunteers may see their own record; coordinators may see anyone's. */
export function assertCanViewVolunteer(req: Request, volunteerId: number) {
  const user = currentUser(req);
  if (user.role !== 'coordinator' && user.id !== volunteerId) {
    throw forbidden('You can only see your own hours.');
  }
}

export async function yearlyTotals(ctx: AppContext, userId: number) {
  const rows = await ctx.db
    .selectFrom('hour_entries')
    .select([
      sql<number>`extract(year from worked_on)::int`.as('year'),
      (eb) => eb.fn.sum<number>('hours').as('hours'),
      (eb) => eb.fn.countAll<number>().as('entries'),
    ])
    .where('user_id', '=', userId)
    .groupBy(sql`extract(year from worked_on)`)
    .orderBy('year', 'desc')
    .execute();
  return rows.map((r) => ({
    year: Number(r.year),
    hours: Math.round(Number(r.hours) * 100) / 100,
    entries: Number(r.entries),
  }));
}

export function hoursRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/volunteers/:id/hours', requireAuth, async (req, res) => {
    const userId = idParam(req.params.id, 'Volunteer');
    assertCanViewVolunteer(req, userId);
    const user = await ctx.db
      .selectFrom('users')
      .select(['id', 'name'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) throw notFound('Volunteer');

    let query = ctx.db
      .selectFrom('hour_entries')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('worked_on', 'desc')
      .orderBy('id', 'desc');
    const year = Number(req.query.year);
    if (Number.isInteger(year) && year > 1900 && year < 3000) {
      query = query
        .where('worked_on', '>=', `${year}-01-01`)
        .where('worked_on', '<=', `${year}-12-31`);
    }
    const entries = await query.execute();
    res.json({
      volunteer: user,
      entries: entries.map(toHourEntryDto),
      totals: await yearlyTotals(ctx, userId),
    });
  });

  // Coordinators log time that didn't come from a shift, like a training
  // session or driving donations around.
  router.post('/volunteers/:id/hours', requireCoordinator, async (req, res) => {
    const userId = idParam(req.params.id, 'Volunteer');
    const input = validate(manualEntrySchema, req.body);
    if (input.workedOn > ctx.now().toISOString().slice(0, 10)) {
      throw badRequest("Hours can't be logged for a future date.");
    }
    const user = await ctx.db
      .selectFrom('users')
      .select('id')
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) throw notFound('Volunteer');
    const entry = await ctx.db
      .insertInto('hour_entries')
      .values({
        user_id: userId,
        worked_on: input.workedOn,
        hours: input.hours,
        description: input.description,
        created_by: currentUser(req).id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    res.status(201).json({ entry: toHourEntryDto(entry) });
  });

  router.delete('/hours/:id', requireCoordinator, async (req, res) => {
    const entry = await ctx.db
      .selectFrom('hour_entries')
      .selectAll()
      .where('id', '=', idParam(req.params.id, 'Hour entry'))
      .executeTakeFirst();
    if (!entry) throw notFound('Hour entry');
    if (entry.signup_id) {
      throw conflict(
        'credited_from_shift',
        'These hours come from a check-in, undo the check-in instead.',
      );
    }
    await ctx.db.deleteFrom('hour_entries').where('id', '=', entry.id).execute();
    res.status(204).end();
  });

  return router;
}
