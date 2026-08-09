import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs, type TestContext } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole, createShift } from './fixtures.js';

describe('roster and attendance', () => {
  let db: Database;
  let ctx: TestContext;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;
  let volunteer: Awaited<ReturnType<typeof loginAs>>;
  let shiftId: number;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    ctx = buildContext(db);
    ctx.setNow('2026-03-02T09:00:00Z');
    const app = buildApp(ctx);
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    await createUser(db, {
      email: 'vol@example.org',
      name: 'Vera Volunteer',
      phone: '0700 000 111',
    });
    coordinator = await loginAs(app, 'coord@example.org');
    volunteer = await loginAs(app, 'vol@example.org');
    const event = await createEvent(db);
    const role = await createRole(db, event.id);
    shiftId = (
      await createShift(db, {
        eventId: event.id,
        roleId: role.id,
        startsAt: '2026-03-07T09:00:00Z',
        endsAt: '2026-03-07T12:00:00Z',
        capacity: 1,
      })
    ).id;
  });
  afterAll(() => db.destroy());

  async function signUp(agent = volunteer) {
    const res = await agent.post(`/api/shifts/${shiftId}/signups`).expect(201);
    return res.body.signup.id as number;
  }

  describe('roster', () => {
    it('lists confirmed volunteers and the waitlist with contact details', async () => {
      await signUp();
      await signUp(coordinator);
      const res = await coordinator.get(`/api/shifts/${shiftId}/roster`);
      expect(res.status).toBe(200);
      expect(res.body.role.name).toBe('Sorting');
      expect(res.body.confirmed).toEqual([
        expect.objectContaining({
          attendance: 'pending',
          volunteer: expect.objectContaining({
            name: 'Vera Volunteer',
            phone: '0700 000 111',
            recentNoShows: 0,
          }),
        }),
      ]);
      expect(res.body.waitlist).toHaveLength(1);
    });

    it('exports the roster as csv', async () => {
      await signUp();
      const res = await coordinator.get(`/api/shifts/${shiftId}/roster.csv`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toContain('roster-2026-03-07');
      expect(res.text.split('\r\n')).toEqual([
        'Name,Email,Phone,Status,Attendance,Checked in at',
        'Vera Volunteer,vol@example.org,0700 000 111,confirmed,pending,',
        '',
      ]);
    });

    it('lets a coordinator add a volunteer to the shift', async () => {
      const vol = await db
        .selectFrom('users')
        .select('id')
        .where('email', '=', 'vol@example.org')
        .executeTakeFirstOrThrow();
      const res = await coordinator.post(`/api/shifts/${shiftId}/signups`).send({ userId: vol.id });
      expect(res.status).toBe(201);
      expect(res.body.signup).toMatchObject({ userId: vol.id, status: 'confirmed' });
      expect(ctx.mailer.to('vol@example.org')).toHaveLength(1);
    });

    it('does not let volunteers sign up other people', async () => {
      const coord = await db
        .selectFrom('users')
        .select('id')
        .where('email', '=', 'coord@example.org')
        .executeTakeFirstOrThrow();
      const res = await volunteer.post(`/api/shifts/${shiftId}/signups`).send({ userId: coord.id });
      expect(res.status).toBe(403);
    });

    it('lists late cancellations', async () => {
      const id = await signUp();
      ctx.setNow('2026-03-06T20:00:00Z');
      await volunteer.delete(`/api/signups/${id}`).expect(200);
      const res = await coordinator.get(`/api/shifts/${shiftId}/roster`);
      expect(res.body.lateCancellations).toEqual([
        expect.objectContaining({
          cancelledAt: '2026-03-06T20:00:00.000Z',
          volunteer: expect.objectContaining({ name: 'Vera Volunteer' }),
        }),
      ]);
    });

    it('is not available to volunteers', async () => {
      expect((await volunteer.get(`/api/shifts/${shiftId}/roster`)).status).toBe(403);
    });
  });

  describe('attendance', () => {
    it('checks a volunteer in from an hour before the start', async () => {
      const id = await signUp();
      ctx.setNow('2026-03-07T07:30:00Z');
      const early = await coordinator
        .post(`/api/signups/${id}/attendance`)
        .send({ attendance: 'present' });
      expect(early.status).toBe(409);
      expect(early.body.error.code).toBe('too_early');

      ctx.setNow('2026-03-07T08:10:00Z');
      const res = await coordinator
        .post(`/api/signups/${id}/attendance`)
        .send({ attendance: 'present' });
      expect(res.status).toBe(200);
      expect(res.body.signup).toMatchObject({
        attendance: 'present',
        checkedInAt: '2026-03-07T08:10:00.000Z',
      });
    });

    it('only marks no-shows once the shift has started', async () => {
      const id = await signUp();
      ctx.setNow('2026-03-07T08:59:00Z');
      expect(
        (await coordinator.post(`/api/signups/${id}/attendance`).send({ attendance: 'no_show' }))
          .status,
      ).toBe(409);
      ctx.setNow('2026-03-07T09:30:00Z');
      const res = await coordinator
        .post(`/api/signups/${id}/attendance`)
        .send({ attendance: 'no_show' });
      expect(res.status).toBe(200);
      expect(res.body.signup).toMatchObject({ attendance: 'no_show', checkedInAt: null });
    });

    it('can be reset to pending', async () => {
      const id = await signUp();
      ctx.setNow('2026-03-07T09:05:00Z');
      await coordinator
        .post(`/api/signups/${id}/attendance`)
        .send({ attendance: 'present' })
        .expect(200);
      const res = await coordinator
        .post(`/api/signups/${id}/attendance`)
        .send({ attendance: 'pending' });
      expect(res.body.signup).toMatchObject({ attendance: 'pending', checkedInAt: null });
    });

    it('refuses waitlisted signups and bad values', async () => {
      await signUp();
      const waitlisted = await signUp(coordinator);
      ctx.setNow('2026-03-07T09:05:00Z');
      expect(
        (
          await coordinator
            .post(`/api/signups/${waitlisted}/attendance`)
            .send({ attendance: 'present' })
        ).status,
      ).toBe(409);
      expect(
        (
          await coordinator
            .post(`/api/signups/${waitlisted}/attendance`)
            .send({ attendance: 'late' })
        ).status,
      ).toBe(400);
    });

    it('is coordinator-only', async () => {
      const id = await signUp();
      ctx.setNow('2026-03-07T09:05:00Z');
      expect(
        (await volunteer.post(`/api/signups/${id}/attendance`).send({ attendance: 'present' }))
          .status,
      ).toBe(403);
    });
  });
});
