import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { validate } from '../../lib/validate.js';
import { requireCoordinator } from '../../middleware/auth.js';

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
