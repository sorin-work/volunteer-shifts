import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs, type TestContext } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createRole, createShift } from './fixtures.js';

describe('events routes', () => {
  let db: Database;
  let ctx: TestContext;
  let app: ReturnType<typeof buildApp>;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;
  let volunteer: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    ctx = buildContext(db);
    app = buildApp(ctx);
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

  it('lists upcoming events by first shift with dates and spots', async () => {
    const later = await createEvent({ name: 'Later' });
    const sooner = await createEvent({ name: 'Sooner' });
    const past = await createEvent({ name: 'Past' });
    for (const [event, start, capacity] of [
      [later, '2026-04-01T09:00:00Z', 4],
      [later, '2026-04-02T09:00:00Z', 6],
      [sooner, '2026-03-10T09:00:00Z', 3],
      [past, '2026-02-01T09:00:00Z', 3],
    ] as const) {
      const role = await createRole(db, event.id, { name: `Role ${start}` });
      const end = start.replace('09:00', '12:00');
      await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: start,
        endsAt: end,
        capacity,
      });
    }
    const upcoming = await coordinator.get('/api/events');
    expect(upcoming.body.events.map((e: { name: string }) => e.name)).toEqual(['Sooner', 'Later']);
    expect(upcoming.body.events[1]).toMatchObject({
      firstShiftAt: '2026-04-01T09:00:00.000Z',
      lastShiftEndsAt: '2026-04-02T12:00:00.000Z',
      shiftCount: 2,
      totalSpots: 10,
      filledSpots: 0,
    });
    const pastList = await coordinator.get('/api/events?when=past');
    expect(pastList.body.events.map((e: { name: string }) => e.name)).toEqual(['Past']);
  });

  it('searches events by name or location', async () => {
    await createEvent({ name: 'Harvest Festival', location: 'Victoria Park' });
    await createEvent({ name: 'Food bank', location: 'Riverside Hall' });
    const byName = await coordinator.get('/api/events?search=harvest');
    expect(byName.body.events.map((e: { name: string }) => e.name)).toEqual(['Harvest Festival']);
    const byPlace = await coordinator.get('/api/events?search=riverside');
    expect(byPlace.body.events.map((e: { name: string }) => e.name)).toEqual(['Food bank']);
  });

  it('keeps new events without shifts in the upcoming list', async () => {
    await createEvent({ name: 'Brand new' });
    const res = await coordinator.get('/api/events');
    expect(res.body.events[0]).toMatchObject({
      name: 'Brand new',
      shiftCount: 0,
      firstShiftAt: null,
    });
  });

  it('emails volunteers with upcoming shifts when an event is cancelled', async () => {
    const event = await createEvent({ name: 'Beach clean' });
    await coordinator.post(`/api/events/${event.id}/publish`).expect(200);
    const role = await createRole(db, event.id);
    const shift = await createShift(db, {
      eventId: event.id,
      roleId: role.id,
      startsAt: '2026-03-14T10:00:00Z',
      endsAt: '2026-03-14T12:00:00Z',
    });
    await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    ctx.mailer.clear();
    await coordinator.post(`/api/events/${event.id}/cancel`).expect(200);
    expect(ctx.mailer.to('vol@example.org').map((m) => m.subject)).toEqual([
      'Cancelled: Beach clean',
    ]);
  });

  it('returns 404 for unknown or malformed ids', async () => {
    expect((await coordinator.get('/api/events/999')).status).toBe(404);
    expect((await coordinator.get('/api/events/abc')).status).toBe(404);
  });
});
