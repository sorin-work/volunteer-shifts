import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';

describe('events routes', () => {
  let db: Database;
  let app: ReturnType<typeof buildApp>;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;
  let volunteer: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    app = buildApp(buildContext(db));
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    await createUser(db, { email: 'vol@example.org' });
    coordinator = await loginAs(app, 'coord@example.org');
    volunteer = await loginAs(app, 'vol@example.org');
  });
  afterAll(() => db.destroy());

  async function createEvent(body: object = {}) {
    const res = await coordinator
      .post('/api/events')
      .send({ name: 'Saturday distribution', timezone: 'Europe/London', ...body });
    expect(res.status).toBe(201);
    return res.body.event;
  }

  it('requires a session', async () => {
    expect((await request(app).get('/api/events')).status).toBe(401);
  });

  it('lets coordinators create draft events', async () => {
    const event = await createEvent({ location: 'Riverside Hall' });
    expect(event).toMatchObject({
      name: 'Saturday distribution',
      location: 'Riverside Hall',
      timezone: 'Europe/London',
      status: 'draft',
    });
  });

  it('validates the time zone', async () => {
    const res = await coordinator.post('/api/events').send({ name: 'X', timezone: 'Nowhere/Land' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields.timezone).toMatch(/time zone/);
  });

  it('forbids volunteers from creating events', async () => {
    const res = await volunteer.post('/api/events').send({ name: 'Mine' });
    expect(res.status).toBe(403);
  });

  it('hides drafts from volunteers', async () => {
    const draft = await createEvent({ name: 'Draft' });
    const published = await createEvent({ name: 'Live' });
    await coordinator.post(`/api/events/${published.id}/publish`).expect(200);

    const list = await volunteer.get('/api/events');
    expect(list.body.events.map((e: { name: string }) => e.name)).toEqual(['Live']);
    expect((await volunteer.get(`/api/events/${draft.id}`)).status).toBe(404);
    expect((await coordinator.get('/api/events')).body.events).toHaveLength(2);
  });

  it('updates event details', async () => {
    const event = await createEvent();
    const res = await coordinator
      .patch(`/api/events/${event.id}`)
      .send({ name: 'Sunday distribution', description: 'Bring gloves' });
    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({
      name: 'Sunday distribution',
      description: 'Bring gloves',
    });
  });

  it('does not allow editing or re-publishing a cancelled event', async () => {
    const event = await createEvent();
    await coordinator.post(`/api/events/${event.id}/cancel`).expect(200);
    expect((await coordinator.patch(`/api/events/${event.id}`).send({ name: 'X' })).status).toBe(
      409,
    );
    expect((await coordinator.post(`/api/events/${event.id}/publish`)).status).toBe(409);
  });

  it('returns 404 for unknown or malformed ids', async () => {
    expect((await coordinator.get('/api/events/999')).status).toBe(404);
    expect((await coordinator.get('/api/events/abc')).status).toBe(404);
  });
});
