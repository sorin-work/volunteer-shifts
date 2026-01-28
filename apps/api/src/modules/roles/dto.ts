import type { Database } from '../../db/connection.js';
import type { Role } from '../../db/types.js';

export interface SkillRef {
  id: number;
  name: string;
}

export function toRoleDto(role: Role, requiredSkills: SkillRef[] = []) {
  return {
    id: role.id,
    eventId: role.event_id,
    name: role.name,
    description: role.description,
    minAge: role.min_age,
    requiredSkills,
  };
}

/** Required skills for each of the given roles, keyed by role id. */
export async function requiredSkillsByRole(
  db: Database,
  roleIds: number[],
): Promise<Map<number, SkillRef[]>> {
  const map = new Map<number, SkillRef[]>();
  if (!roleIds.length) return map;
  const rows = await db
    .selectFrom('role_skills')
    .innerJoin('skills', 'skills.id', 'role_skills.skill_id')
    .select(['role_skills.role_id', 'skills.id', 'skills.name'])
    .where('role_skills.role_id', 'in', roleIds)
    .orderBy('skills.name')
    .execute();
  for (const r of rows) {
    const list = map.get(r.role_id) ?? [];
    list.push({ id: r.id, name: r.name });
    map.set(r.role_id, list);
  }
  return map;
}
