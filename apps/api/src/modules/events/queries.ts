import type { Database } from '../../db/connection.js';
import { conflict, notFound } from '../../lib/errors.js';

export async function getEvent(db: Database, id: number) {
  const event = await db.selectFrom('events').selectAll().where('id', '=', id).executeTakeFirst();
  if (!event) throw notFound('Event');
  return event;
}

/** An event whose roles and shifts may still be changed. */
export async function getEditableEvent(db: Database, id: number) {
  const event = await getEvent(db, id);
  if (event.status === 'cancelled') {
    throw conflict('event_cancelled', 'Cancelled events can no longer be edited.');
  }
  return event;
}
