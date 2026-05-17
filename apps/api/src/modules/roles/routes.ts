import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/params.js';
import { validate } from '../../lib/validate.js';
import { requireCoordinator } from '../../middleware/auth.js';
import { getEditableEvent } from '../events/queries.js';
import { requiredSkillsByRole, toRoleDto } from './dto.js';

const roleFields = {
  name: z.string().trim().min(1, 'Name is required.').max(80),
  description: z.string().trim().max(1000),
  minAge: z.number().int().min(0).max(120).nullable(),
  skillIds: z.array(z.number().int().positive()).max(20),
};

const createRoleSchema = z.object({
  name: roleFields.name,
  description: roleFields.description.default(''),
  minAge: roleFields.minAge.default(null),
  skillIds: roleFields.skillIds.default([]),
});

// No defaults here: zod applies defaults even inside .partial(), which
// would reset fields the client didn't send.
const updateRoleSchema = z.object(roleFields).partial();

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

  async function setRequiredSkills(roleId: number, skillIds: number[]) {
    const unique = [...new Set(skillIds)];
    if (unique.length) {
      const found = await ctx.db
        .selectFrom('skills')
        .select('id')
        .where('id', 'in', unique)
        .execute();
      if (found.length !== unique.length) throw badRequest('Unknown skill in the list.');
    }
    await ctx.db.deleteFrom('role_skills').where('role_id', '=', roleId).execute();
    if (unique.length) {
      await ctx.db
        .insertInto('role_skills')
        .values(unique.map((skill_id) => ({ role_id: roleId, skill_id })))
        .execute();
    }
  }

  async function roleResponse(role: Awaited<ReturnType<typeof getRole>>) {
    const skills = await requiredSkillsByRole(ctx.db, [role.id]);
    return { role: toRoleDto(role, skills.get(role.id)) };
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
    const input = validate(createRoleSchema, req.body);
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
    await setRequiredSkills(role.id, input.skillIds);
    res.status(201).json(await roleResponse(role));
  });

  router.patch('/roles/:id', requireCoordinator, async (req, res) => {
    const role = await getRole(idParam(req.params.id, 'Role'));
    await getEditableEvent(ctx.db, role.event_id);
    const input = validate(updateRoleSchema, req.body);
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
    if (input.skillIds) await setRequiredSkills(role.id, input.skillIds);
    res.json(await roleResponse(updated));
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
