import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs, type TestContext } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole, createShift } from './fixtures.js';

describe('signups', () => {
  let db: Database;
  let ctx: TestContext;
  let app: ReturnType<typeof buildApp>;
  let volunteer: Awaited<ReturnType<typeof loginAs>>;
  let event: Awaited<ReturnType<typeof createEvent>>;
  let roleId: number;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    ctx = buildContext(db);
    ctx.setNow('2026-03-02T09:00:00Z');
    app = buildApp(ctx);
    await createUser(db, { email: 'vol@example.org' });
    volunteer = await loginAs(app, 'vol@example.org');
    event = await createEvent(db);
    roleId = (await createRole(db, event.id)).id;
  });
  afterAll(() => db.destroy());

  const shiftAt = (startsAt: string, endsAt: string, capacity = 3) =>
    createShift(db, { eventId: event.id, roleId, startsAt, endsAt, capacity });

  it('confirms a signup when there is room', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
    const res = await volunteer.post(`/api/shifts/${shift.id}/signups`);
    expect(res.status).toBe(201);
    expect(res.body.signup).toMatchObject({ shiftId: shift.id, status: 'confirmed' });
  });

  it('emails a confirmation', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
    await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    const [mail] = ctx.mailer.to('vol@example.org');
    expect(mail?.subject).toBe("You're signed up: Food bank Saturday");
    expect(mail?.text).toContain('Sorting');
  });

  it('offers a calendar file for your own signups only', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
    const { body } = await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    const res = await volunteer.get(`/api/signups/${body.signup.id}/calendar.ics`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/calendar; charset=utf-8');
    expect(res.text).toContain('SUMMARY:Food bank Saturday: Sorting');
    await createUser(db, { email: 'other@example.org' });
    const other = await loginAs(app, 'other@example.org');
    expect((await other.get(`/api/signups/${body.signup.id}/calendar.ics`)).status).toBe(404);
  });

  it('rejects signing up twice', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
    await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    const res = await volunteer.post(`/api/shifts/${shift.id}/signups`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('already_signed_up');
  });

  it('puts people on the waitlist when a shift is full', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z', 1);
    await createUser(db, { email: 'first@example.org' });
    await (await loginAs(app, 'first@example.org'))
      .post(`/api/shifts/${shift.id}/signups`)
      .expect(201);
    const res = await volunteer.post(`/api/shifts/${shift.id}/signups`);
    expect(res.status).toBe(201);
    expect(res.body.signup).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });
  });

  it('rejects shifts that already started', async () => {
    const shift = await shiftAt('2026-03-02T08:00:00Z', '2026-03-02T12:00:00Z');
    const res = await volunteer.post(`/api/shifts/${shift.id}/signups`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('shift_started');
  });

  it('hides shifts of draft events and rejects cancelled events', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
    await db.updateTable('events').set({ status: 'draft' }).execute();
    expect((await volunteer.post(`/api/shifts/${shift.id}/signups`)).status).toBe(404);
    await db.updateTable('events').set({ status: 'cancelled' }).execute();
    expect((await volunteer.post(`/api/shifts/${shift.id}/signups`)).status).toBe(409);
  });

  describe('schedule conflicts', () => {
    it('rejects a shift that overlaps one you already have', async () => {
      const morning = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
      const brunch = await shiftAt('2026-03-07T08:00:00Z', '2026-03-07T10:00:00Z');
      await volunteer.post(`/api/shifts/${morning.id}/signups`).expect(201);
      const res = await volunteer.post(`/api/shifts/${brunch.id}/signups`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('schedule_conflict');
      expect(res.body.error.details.shifts).toEqual([
        expect.objectContaining({ shiftId: morning.id, eventName: 'Food bank Saturday' }),
      ]);
    });

    it('rejects a shift that starts while an earlier one is still running', async () => {
      const morning = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
      const lunch = await shiftAt('2026-03-07T11:00:00Z', '2026-03-07T14:00:00Z');
      await volunteer.post(`/api/shifts/${morning.id}/signups`).expect(201);
      const res = await volunteer.post(`/api/shifts/${lunch.id}/signups`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('schedule_conflict');
    });

    it('rejects a shift inside a longer one', async () => {
      const allDay = await shiftAt('2026-03-07T08:00:00Z', '2026-03-07T18:00:00Z');
      const short = await shiftAt('2026-03-07T10:00:00Z', '2026-03-07T11:00:00Z');
      await volunteer.post(`/api/shifts/${short.id}/signups`).expect(201);
      expect((await volunteer.post(`/api/shifts/${allDay.id}/signups`)).status).toBe(409);
    });

    it('allows back-to-back shifts', async () => {
      const first = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
      const second = await shiftAt('2026-03-07T12:00:00Z', '2026-03-07T15:00:00Z');
      await volunteer.post(`/api/shifts/${first.id}/signups`).expect(201);
      expect((await volunteer.post(`/api/shifts/${second.id}/signups`)).status).toBe(201);
    });

    it('ignores cancelled signups', async () => {
      const first = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
      const clash = await shiftAt('2026-03-07T08:00:00Z', '2026-03-07T11:00:00Z');
      const { body } = await volunteer.post(`/api/shifts/${clash.id}/signups`).expect(201);
      await volunteer.delete(`/api/signups/${body.signup.id}`).expect(200);
      expect((await volunteer.post(`/api/shifts/${first.id}/signups`)).status).toBe(201);
    });
  });

  it('lists upcoming and past signups separately', async () => {
    const past = await shiftAt('2026-03-01T09:00:00Z', '2026-03-01T12:00:00Z');
    const later = await shiftAt('2026-03-09T09:00:00Z', '2026-03-09T12:00:00Z');
    const soon = await shiftAt('2026-03-05T09:00:00Z', '2026-03-05T12:00:00Z');
    ctx.setNow('2026-02-28T09:00:00Z');
    for (const s of [past, later, soon]) {
      await volunteer.post(`/api/shifts/${s.id}/signups`).expect(201);
    }
    ctx.setNow('2026-03-02T09:00:00Z');

    const upcoming = await volunteer.get('/api/me/signups');
    expect(upcoming.body.signups.map((s: { shiftId: number }) => s.shiftId)).toEqual([
      soon.id,
      later.id,
    ]);
    expect(upcoming.body.signups[0]).toMatchObject({
      event: { name: 'Food bank Saturday' },
      role: { name: 'Sorting' },
      shift: { startTime: '09:00' },
    });
    const past1 = await volunteer.get('/api/me/signups?when=past');
    expect(past1.body.signups.map((s: { shiftId: number }) => s.shiftId)).toEqual([past.id]);
  });

  it('cancels a signup and frees the spot', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z', 1);
    const { body } = await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    const res = await volunteer.delete(`/api/signups/${body.signup.id}`);
    expect(res.status).toBe(200);
    expect(res.body.signup.status).toBe('cancelled');
    expect((await volunteer.get('/api/me/signups')).body.signups).toHaveLength(0);
    // Signing up again after cancelling works.
    expect((await volunteer.post(`/api/shifts/${shift.id}/signups`)).status).toBe(201);
  });

  it("does not let a volunteer cancel someone else's signup", async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z', 1);
    const { body } = await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    await createUser(db, { email: 'mallory@example.org' });
    const mallory = await loginAs(app, 'mallory@example.org');

    const res = await mallory.delete(`/api/signups/${body.signup.id}`);
    expect(res.status).toBe(404);
    const row = await db
      .selectFrom('signups')
      .select('status')
      .where('id', '=', body.signup.id)
      .executeTakeFirstOrThrow();
    expect(row.status).toBe('confirmed');
  });

  it('lets coordinators remove a volunteer from a shift', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
    const { body } = await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    const coord = await loginAs(app, 'coord@example.org');
    expect((await coord.delete(`/api/signups/${body.signup.id}`)).status).toBe(200);
  });

  it('does not cancel after the shift started', async () => {
    const shift = await shiftAt('2026-03-02T10:00:00Z', '2026-03-02T12:00:00Z');
    const { body } = await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    ctx.setNow('2026-03-02T10:30:00Z');
    const res = await volunteer.delete(`/api/signups/${body.signup.id}`);
    expect(res.status).toBe(409);
  });

  it('shows filled spots on the event page', async () => {
    const shift = await shiftAt('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z', 2);
    await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    const res = await volunteer.get(`/api/events/${event.id}`);
    expect(res.body.shifts[0]).toMatchObject({
      confirmedCount: 1,
      capacity: 2,
      mySignup: { status: 'confirmed' },
    });
  });
});
