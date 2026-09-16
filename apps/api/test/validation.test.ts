import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole } from './fixtures.js';

describe('input validation edge cases', () => {
  let db: Database;
  let app: ReturnType<typeof buildApp>;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    app = buildApp(buildContext(db));
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    coordinator = await loginAs(app, 'coord@example.org');
  });
  afterAll(() => db.destroy());

  it('rejects zero and fractional capacity', async () => {
    const event = await createEvent(db);
    const role = await createRole(db, event.id);
    const base = { roleId: role.id, date: '2026-03-07', startTime: '09:00', endTime: '12:00' };
    for (const capacity of [0, 2.5, -1, '3']) {
      const res = await coordinator
        .post(`/api/events/${event.id}/shifts`)
        .send({ ...base, capacity });
      expect(res.status).toBe(400);
      expect(res.body.error.details.fields.capacity).toBeDefined();
    }
  });

  it('rejects a shift with the same start and end as too long', async () => {
    // 09:00-09:00 means a 24 hour shift, which is over the limit.
    const event = await createEvent(db);
    const role = await createRole(db, event.id);
    const res = await coordinator.post(`/api/events/${event.id}/shifts`).send({
      roleId: role.id,
      date: '2026-03-07',
      startTime: '09:00',
      endTime: '09:00',
      capacity: 1,
    });
    expect(res.status).toBe(400);
  });

  it('rejects oversized event names and descriptions', async () => {
    const res = await coordinator
      .post('/api/events')
      .send({ name: 'x'.repeat(161), description: 'y'.repeat(5001) });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fields).sort()).toEqual(['description', 'name']);
  });

  it('rejects request bodies over 100kb', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ email: 'a', password: 'b'.repeat(200_000) }));
    expect(res.status).toBe(413);
  });

  it('treats huge or negative ids as not found', async () => {
    expect((await coordinator.get('/api/events/99999999999')).status).toBe(404);
    expect((await coordinator.get('/api/events/-1')).status).toBe(404);
  });

  it('ignores unknown fields instead of saving them', async () => {
    const res = await coordinator
      .post('/api/events')
      .send({ name: 'Picnic', status: 'published', created_by: 999 });
    expect(res.status).toBe(201);
    expect(res.body.event.status).toBe('draft');
  });
});
