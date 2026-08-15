import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { pageInfo, parsePage } from '../../lib/pagination.js';
import { idParam } from '../../lib/params.js';
import { containsPattern } from '../../lib/search.js';
import { validate } from '../../lib/validate.js';
import { toPublicUser } from '../../lib/users.js';
import { currentUser, requireAuth, requireCoordinator } from '../../middleware/auth.js';
import { assertCanViewVolunteer } from '../hours/routes.js';

const skillsSchema = z.object({ skillIds: z.array(z.number().int().positive()).max(50) });

export async function skillsForUser(ctx: AppContext, userId: number) {
  return ctx.db
    .selectFrom('user_skills')
    .innerJoin('skills', 'skills.id', 'user_skills.skill_id')
    .select(['skills.id', 'skills.name'])
    .where('user_skills.user_id', '=', userId)
    .orderBy('skills.name')
    .execute();
}

export function volunteerRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/', requireCoordinator, async (req, res) => {
    const paging = parsePage(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let base = ctx.db.selectFrom('users');
    if (search) {
      const pattern = containsPattern(search);
      base = base.where((eb) =>
        eb.or([eb('name', 'ilike', pattern), eb('email', 'ilike', pattern)]),
      );
    }
    const [{ total }, rows] = await Promise.all([
      base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
      base
        .select(['id', 'name', 'email', 'phone', 'role', 'created_at'])
        .orderBy('name')
        .orderBy('id')
        .limit(paging.pageSize)
        .offset(paging.offset)
        .execute(),
    ]);
    res.json({
      volunteers: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        joinedAt: r.created_at.toISOString(),
      })),
      ...pageInfo(paging, Number(total)),
    });
  });

  router.get('/:id', requireAuth, async (req, res) => {
    const userId = idParam(req.params.id, 'Volunteer');
    assertCanViewVolunteer(req, userId);
    const user = await ctx.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) throw notFound('Volunteer');

    const now = ctx.now();
    const yearStart = `${now.getUTCFullYear()}-01-01`;
    const [attendance, upcoming, hours, skills] = await Promise.all([
      ctx.db
        .selectFrom('signups')
        .select(['attendance', (eb) => eb.fn.countAll<number>().as('n')])
        .where('user_id', '=', userId)
        .where('status', '=', 'confirmed')
        .groupBy('attendance')
        .execute(),
      ctx.db
        .selectFrom('signups')
        .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('signups.user_id', '=', userId)
        .where('signups.status', 'in', ['confirmed', 'waitlisted'])
        .where('shifts.starts_at', '>', now)
        .executeTakeFirstOrThrow(),
      ctx.db
        .selectFrom('hour_entries')
        .select((eb) => [
          eb.fn.coalesce(eb.fn.sum<number>('hours'), eb.lit(0)).as('total'),
          eb.fn
            .coalesce(
              eb.fn.sum<number>(
                eb.case().when('worked_on', '>=', yearStart).then(eb.ref('hours')).end(),
              ),
              eb.lit(0),
            )
            .as('this_year'),
        ])
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow(),
      skillsForUser(ctx, userId),
    ]);
    const count = (a: string) => Number(attendance.find((r) => r.attendance === a)?.n ?? 0);

    res.json({
      volunteer: { ...toPublicUser(user), skills, joinedAt: user.created_at.toISOString() },
      stats: {
        upcomingShifts: Number(upcoming.n),
        attended: count('present'),
        noShows: count('no_show'),
        hoursThisYear: Math.round(Number(hours.this_year) * 100) / 100,
        totalHours: Math.round(Number(hours.total) * 100) / 100,
      },
    });
  });

  router.put('/:id/role', requireCoordinator, async (req, res) => {
    const userId = idParam(req.params.id, 'Volunteer');
    const { role } = validate(z.object({ role: z.enum(['coordinator', 'volunteer']) }), req.body);
    if (userId === currentUser(req).id && role !== 'coordinator') {
      throw conflict('cannot_demote_self', 'Ask another coordinator to change your own role.');
    }
    const updated = await ctx.db
      .updateTable('users')
      .set({ role })
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    if (!updated) throw notFound('Volunteer');
    res.json({ volunteer: toPublicUser(updated) });
  });

  // Skills are confirmed by coordinators (e.g. after checking a food hygiene
  // certificate), so volunteers can't edit their own.
  router.put('/:id/skills', requireCoordinator, async (req, res) => {
    const userId = idParam(req.params.id, 'Volunteer');
    const { skillIds } = validate(skillsSchema, req.body);
    const user = await ctx.db
      .selectFrom('users')
      .select('id')
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) throw notFound('Volunteer');
    const unique = [...new Set(skillIds)];
    if (unique.length) {
      const found = await ctx.db
        .selectFrom('skills')
        .select('id')
        .where('id', 'in', unique)
        .execute();
      if (found.length !== unique.length) throw badRequest('Unknown skill in the list.');
    }
    await ctx.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('user_skills').where('user_id', '=', userId).execute();
      if (unique.length) {
        await trx
          .insertInto('user_skills')
          .values(unique.map((skill_id) => ({ user_id: userId, skill_id })))
          .execute();
      }
    });
    res.json({ skills: await skillsForUser(ctx, userId) });
  });

  return router;
}
