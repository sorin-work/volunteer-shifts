import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { validate } from '../../lib/validate.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.js';

const skillSchema = z.object({ name: z.string().trim().min(1, 'Name is required.').max(80) });

export function skillRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/', requireAuth, async (_req, res) => {
    const skills = await ctx.db
      .selectFrom('skills')
      .select(['id', 'name'])
      .orderBy('name')
      .execute();
    res.json({ skills });
  });

  router.post('/', requireCoordinator, async (req, res) => {
    const { name } = validate(skillSchema, req.body);
    const existing = await ctx.db
      .selectFrom('skills')
      .select('id')
      .where((eb) => eb(eb.fn('lower', ['name']), '=', name.toLowerCase()))
      .executeTakeFirst();
    if (existing) throw conflict('skill_exists', `"${name}" is already in the list.`);
    const skill = await ctx.db
      .insertInto('skills')
      .values({ name })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();
    res.status(201).json({ skill });
  });

  router.delete('/:id', requireCoordinator, async (req, res) => {
    const result = await ctx.db
      .deleteFrom('skills')
      .where('id', '=', idParam(req.params.id, 'Skill'))
      .executeTakeFirst();
    if (!result.numDeletedRows) throw notFound('Skill');
    res.status(204).end();
  });

  return router;
}
