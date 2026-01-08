import type { Event } from '../../db/types.js';

export function toEventDto(event: Event) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    location: event.location,
    timezone: event.timezone,
    status: event.status,
    createdAt: event.created_at.toISOString(),
    updatedAt: event.updated_at.toISOString(),
  };
}
