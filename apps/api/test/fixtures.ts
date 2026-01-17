import type { Database } from '../src/db/connection.js';

export async function createEvent(
  db: Database,
  attrs: { name?: string; timezone?: string; status?: 'draft' | 'published' | 'cancelled' } = {},
) {
  return db
    .insertInto('events')
    .values({
      name: attrs.name ?? 'Food bank Saturday',
      timezone: attrs.timezone ?? 'UTC',
      status: attrs.status ?? 'published',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function createRole(
  db: Database,
  eventId: number,
  attrs: { name?: string; minAge?: number | null } = {},
) {
  return db
    .insertInto('roles')
    .values({ event_id: eventId, name: attrs.name ?? 'Sorting', min_age: attrs.minAge ?? null })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function createShift(
  db: Database,
  attrs: { eventId: number; roleId: number; startsAt: string; endsAt: string; capacity?: number },
) {
  return db
    .insertInto('shifts')
    .values({
      event_id: attrs.eventId,
      role_id: attrs.roleId,
      starts_at: attrs.startsAt,
      ends_at: attrs.endsAt,
      capacity: attrs.capacity ?? 5,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
