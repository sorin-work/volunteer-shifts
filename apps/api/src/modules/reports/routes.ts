import { Router, type Request } from 'express';
import type { AppContext } from '../../context.js';
import { toCsv } from '../../lib/csv.js';
import { badRequest } from '../../lib/errors.js';
import { requireCoordinator } from '../../middleware/auth.js';

function reportYear(ctx: AppContext, req: Request): number {
  const raw = req.query.year;
  if (raw === undefined) return ctx.now().getUTCFullYear();
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest('Pick a valid year.');
  return year;
}

/** Hours, shifts and no-shows per volunteer for one calendar year. */
export async function hoursReport(ctx: AppContext, year: number) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const rows = await ctx.db
    .selectFrom('users')
    .leftJoin('hour_entries', (join) =>
      join
        .onRef('hour_entries.user_id', '=', 'users.id')
        .on('hour_entries.worked_on', '>=', from)
        .on('hour_entries.worked_on', '<=', to),
    )
    .select((eb) => [
      'users.id',
      'users.name',
      'users.email',
      eb.fn.coalesce(eb.fn.sum<number>('hour_entries.hours'), eb.lit(0)).as('hours'),
      eb.fn.count<number>('hour_entries.signup_id').as('shifts'),
    ])
    .groupBy(['users.id', 'users.name', 'users.email'])
    .having((eb) => eb.fn.count('hour_entries.id'), '>', 0)
    .orderBy('hours', 'desc')
    .orderBy('users.name')
    .execute();

  const volunteers = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    hours: Math.round(Number(r.hours) * 100) / 100,
    shifts: Number(r.shifts),
  }));
  return {
    year,
    volunteers,
    totals: {
      volunteers: volunteers.length,
      hours: Math.round(volunteers.reduce((sum, v) => sum + v.hours, 0) * 100) / 100,
      shifts: volunteers.reduce((sum, v) => sum + v.shifts, 0),
    },
  };
}

export function reportRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/hours', requireCoordinator, async (req, res) => {
    res.json(await hoursReport(ctx, reportYear(ctx, req)));
  });

  router.get('/hours.csv', requireCoordinator, async (req, res) => {
    const report = await hoursReport(ctx, reportYear(ctx, req));
    const csv = toCsv(
      ['Name', 'Email', 'Hours', 'Shifts'],
      report.volunteers.map((v) => [v.name, v.email, v.hours.toFixed(2), v.shifts]),
    );
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="volunteer-hours-${report.year}.csv"`)
      .send(csv);
  });

  return router;
}
