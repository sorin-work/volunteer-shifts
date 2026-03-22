import { Router, type Request } from 'express';
import { sql } from 'kysely';
import type { AppContext } from '../../context.js';
import type { HourEntry } from '../../db/types.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';

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

  return router;
}
