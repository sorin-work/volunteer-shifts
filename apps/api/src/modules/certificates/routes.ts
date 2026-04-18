import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { requireAuth } from '../../middleware/auth.js';
import { assertCanViewVolunteer } from '../hours/routes.js';
import { renderCertificate } from './pdf.js';

export function certificateRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/volunteers/:id/certificates/:year', requireAuth, async (req, res) => {
    const userId = idParam(req.params.id, 'Volunteer');
    assertCanViewVolunteer(req, userId);
    const year = idParam(req.params.year, 'Certificate');
    if (year < 2000 || year > 2100) throw notFound('Certificate');

    const user = await ctx.db
      .selectFrom('users')
      .select(['id', 'name'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) throw notFound('Volunteer');

    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const [totals, events] = await Promise.all([
      ctx.db
        .selectFrom('hour_entries')
        .select((eb) => [
          eb.fn.sum<number>('hours').as('hours'),
          eb.fn.count<number>('signup_id').as('shifts'),
        ])
        .where('user_id', '=', userId)
        .where('worked_on', '>=', from)
        .where('worked_on', '<=', to)
        .executeTakeFirstOrThrow(),
      ctx.db
        .selectFrom('hour_entries')
        .innerJoin('signups', 'signups.id', 'hour_entries.signup_id')
        .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
        .innerJoin('events', 'events.id', 'shifts.event_id')
        .select('events.name')
        .distinct()
        .where('hour_entries.user_id', '=', userId)
        .where('hour_entries.worked_on', '>=', from)
        .where('hour_entries.worked_on', '<=', to)
        .orderBy('events.name')
        .execute(),
    ]);

    const hours = Math.round(Number(totals.hours ?? 0) * 100) / 100;
    if (!hours) throw notFound(`Volunteer hours for ${year}`);

    const pdf = await renderCertificate({
      organisation: ctx.config.ORG_NAME,
      volunteerName: user.name,
      year,
      hours,
      shifts: Number(totals.shifts),
      events: events.map((e) => e.name),
      issuedOn: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(ctx.now()),
    });

    const slug = user.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    res
      .type('application/pdf')
      .set(
        'Content-Disposition',
        `attachment; filename="volunteer-certificate-${year}-${slug}.pdf"`,
      )
      .send(pdf);
  });

  return router;
}
