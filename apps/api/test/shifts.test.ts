import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole, createShift } from './fixtures.js';

describe('roles and shifts', () => {
  let db: Database;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;
  let volunteer: Awaited<ReturnType<typeof loginAs>>;
  let event: Awaited<ReturnType<typeof createEvent>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    const app = buildApp(buildContext(db));
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    await createUser(db, { email: 'vol@example.org' });
    coordinator = await loginAs(app, 'coord@example.org');
    volunteer = await loginAs(app, 'vol@example.org');
    event = await createEvent(db, { timezone: 'America/Chicago' });
  });
  afterAll(() => db.destroy());

  describe('roles', () => {
    it('creates a role with a minimum age', async () => {
      const res = await coordinator
        .post(`/api/events/${event.id}/roles`)
        .send({ name: 'Forklift', minAge: 18 });
      expect(res.status).toBe(201);
      expect(res.body.role).toMatchObject({ name: 'Forklift', minAge: 18, eventId: event.id });
    });

    it('rejects duplicate role names within an event', async () => {
      await createRole(db, event.id, { name: 'Greeter' });
      const res = await coordinator.post(`/api/events/${event.id}/roles`).send({ name: 'Greeter' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('role_exists');
    });

    it('is coordinator-only', async () => {
      const res = await volunteer.post(`/api/events/${event.id}/roles`).send({ name: 'Greeter' });
      expect(res.status).toBe(403);
    });

    it('renames a role', async () => {
      const role = await createRole(db, event.id, { name: 'Greeter' });
      const res = await coordinator.patch(`/api/roles/${role.id}`).send({ name: 'Welcome desk' });
      expect(res.status).toBe(200);
      expect(res.body.role.name).toBe('Welcome desk');
    });

    it('keeps the minimum age and description when only renaming', async () => {
      const created = await coordinator
        .post(`/api/events/${event.id}/roles`)
        .send({ name: 'Driver', description: 'Van runs', minAge: 21 });
      const res = await coordinator
        .patch(`/api/roles/${created.body.role.id}`)
        .send({ name: 'Van driver' });
      expect(res.body.role).toMatchObject({
        name: 'Van driver',
        description: 'Van runs',
        minAge: 21,
      });
    });

    it('refuses to delete a role that still has shifts', async () => {
      const role = await createRole(db, event.id);
      await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-07T15:00:00Z',
        endsAt: '2026-03-07T18:00:00Z',
      });
      expect((await coordinator.delete(`/api/roles/${role.id}`)).status).toBe(409);
    });
  });

  describe('shifts', () => {
    it('creates a shift from local times in the event zone', async () => {
      const role = await createRole(db, event.id);
      const res = await coordinator.post(`/api/events/${event.id}/shifts`).send({
        roleId: role.id,
        date: '2026-03-07',
        startTime: '09:00',
        endTime: '12:00',
        capacity: 4,
      });
      expect(res.status).toBe(201);
      expect(res.body.shift).toMatchObject({
        startsAt: '2026-03-07T15:00:00.000Z',
        endsAt: '2026-03-07T18:00:00.000Z',
        date: '2026-03-07',
        startTime: '09:00',
        endTime: '12:00',
        capacity: 4,
      });
    });

    it('rejects a role from another event', async () => {
      const other = await createEvent(db);
      const role = await createRole(db, other.id);
      const res = await coordinator.post(`/api/events/${event.id}/shifts`).send({
        roleId: role.id,
        date: '2026-03-07',
        startTime: '09:00',
        endTime: '12:00',
        capacity: 4,
      });
      expect(res.status).toBe(400);
    });

    it('rejects shifts that are too long or have bad times', async () => {
      const role = await createRole(db, event.id);
      const base = { roleId: role.id, date: '2026-03-07', capacity: 2 };
      const long = await coordinator
        .post(`/api/events/${event.id}/shifts`)
        .send({ ...base, startTime: '06:00', endTime: '23:00' });
      expect(long.status).toBe(400);
      const bad = await coordinator
        .post(`/api/events/${event.id}/shifts`)
        .send({ ...base, startTime: '25:00', endTime: '26:00' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.details.fields.startTime).toBeDefined();
    });

    it('updates only the fields sent', async () => {
      const role = await createRole(db, event.id);
      const shift = await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-07T15:00:00Z',
        endsAt: '2026-03-07T18:00:00Z',
      });
      const res = await coordinator.patch(`/api/shifts/${shift.id}`).send({ capacity: 10 });
      expect(res.status).toBe(200);
      expect(res.body.shift).toMatchObject({ capacity: 10, startTime: '09:00', endTime: '12:00' });
    });

    it('lists roles and shifts in the event details, in time order', async () => {
      const role = await createRole(db, event.id);
      await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-08T15:00:00Z',
        endsAt: '2026-03-08T18:00:00Z',
      });
      await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-07T15:00:00Z',
        endsAt: '2026-03-07T18:00:00Z',
      });
      const res = await volunteer.get(`/api/events/${event.id}`);
      expect(res.status).toBe(200);
      expect(res.body.roles).toHaveLength(1);
      expect(res.body.shifts.map((s: { date: string }) => s.date)).toEqual([
        '2026-03-07',
        '2026-03-08',
      ]);
    });

    it('lists understaffed shifts in the coming week, emptiest first', async () => {
      const role = await createRole(db, event.id);
      const half = await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-04T15:00:00Z',
        endsAt: '2026-03-04T18:00:00Z',
        capacity: 2,
      });
      const empty = await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-05T15:00:00Z',
        endsAt: '2026-03-05T18:00:00Z',
        capacity: 2,
      });
      await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-20T15:00:00Z',
        endsAt: '2026-03-20T18:00:00Z',
      });
      await volunteer.post(`/api/shifts/${half.id}/signups`).expect(201);
      const res = await coordinator.get('/api/shifts/understaffed');
      expect(res.status).toBe(200);
      expect(res.body.shifts.map((s: { id: number }) => s.id)).toEqual([empty.id, half.id]);
      expect(res.body.shifts[1]).toMatchObject({ confirmedCount: 1, roleName: 'Sorting' });
    });

    it("copies a day's shifts to another date at the same local times", async () => {
      const role = await createRole(db, event.id);
      for (const [start, end] of [
        ['09:00', '12:00'],
        ['20:00', '23:30'],
      ]) {
        await coordinator
          .post(`/api/events/${event.id}/shifts`)
          .send({
            roleId: role.id,
            date: '2026-03-07',
            startTime: start,
            endTime: end,
            capacity: 3,
          })
          .expect(201);
      }
      // Chicago moves to daylight time on 2026-03-08, so the UTC times differ.
      const res = await coordinator
        .post(`/api/events/${event.id}/shifts/copy`)
        .send({ fromDate: '2026-03-07', toDate: '2026-03-14' });
      expect(res.status).toBe(201);
      expect(res.body.shifts).toEqual([
        expect.objectContaining({
          date: '2026-03-14',
          startTime: '09:00',
          startsAt: '2026-03-14T14:00:00.000Z',
        }),
        expect.objectContaining({ date: '2026-03-14', startTime: '20:00', endTime: '23:30' }),
      ]);
      const empty = await coordinator
        .post(`/api/events/${event.id}/shifts/copy`)
        .send({ fromDate: '2026-03-01', toDate: '2026-03-02' });
      expect(empty.status).toBe(400);
    });

    it('deletes a shift', async () => {
      const role = await createRole(db, event.id);
      const shift = await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-07T15:00:00Z',
        endsAt: '2026-03-07T18:00:00Z',
      });
      expect((await coordinator.delete(`/api/shifts/${shift.id}`)).status).toBe(204);
      expect((await coordinator.delete(`/api/shifts/${shift.id}`)).status).toBe(404);
    });
  });
});
