import type { Role } from '../../db/types.js';

export function toRoleDto(role: Role) {
  return {
    id: role.id,
    eventId: role.event_id,
    name: role.name,
    description: role.description,
    minAge: role.min_age,
  };
}
