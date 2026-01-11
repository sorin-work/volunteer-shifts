import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { validate } from '../../lib/validate.js';
import { requireCoordinator } from '../../middleware/auth.js';
import { getEditableEvent } from '../events/queries.js';
import { toRoleDto } from './dto.js';

const roleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  description: z.string().trim().max(1000).default(''),
  minAge: z.number().int().min(0).max(120).nullable().default(null),
});

export function roleRoutes(ctx: AppContext): Router {
  const router = Router();

  async function assertNameFree(eventId: number, name: string, exceptId?: number) {
    let query = ctx.db
      .selectFrom('roles')
      .select('id')
      .where('event_id', '=', eventId)
      .where('name', '=', name);
    if (exceptId) query = query.where('id', '<>', exceptId);
    if (await query.executeTakeFirst()) {
      throw conflict('role_exists', `This event already has a role called "${name}".`);
    }
  }

  async function getRole(id: number) {
    const role = await ctx.db
      .selectFrom('roles')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!role) throw notFound('Role');
    return role;
  }

  router.post('/events/:id/roles', requireCoordinator, async (req, res) => {
    const event = await getEditableEvent(ctx.db, idParam(req.params.id, 'Event'));
    const input = validate(roleSchema, req.body);
    await assertNameFree(event.id, input.name);
    const role = await ctx.db
      .insertInto('roles')
      .values({
        event_id: event.id,
        name: input.name,
        description: input.description,
        min_age: input.minAge,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    res.status(201).json({ role: toRoleDto(role) });
  });

  router.patch('/roles/:id', requireCoordinator, async (req, res) => {
    const role = await getRole(idParam(req.params.id, 'Role'));
    await getEditableEvent(ctx.db, role.event_id);
    const input = validate(roleSchema.partial(), req.body);
    if (input.name) await assertNameFree(role.event_id, input.name, role.id);
    const updated = await ctx.db
      .updateTable('roles')
      .set({
        name: input.name,
        description: input.description,
        min_age: input.minAge,
      })
      .where('id', '=', role.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    res.json({ role: toRoleDto(updated) });
  });

  router.delete('/roles/:id', requireCoordinator, async (req, res) => {
    const role = await getRole(idParam(req.params.id, 'Role'));
    const shift = await ctx.db
      .selectFrom('shifts')
      .select('id')
      .where('role_id', '=', role.id)
      .executeTakeFirst();
    if (shift) throw conflict('role_in_use', 'Remove the shifts for this role first.');
    await ctx.db.deleteFrom('roles').where('id', '=', role.id).execute();
    res.status(204).end();
  });

  return router;
}
