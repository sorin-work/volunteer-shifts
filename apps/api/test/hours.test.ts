import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs, type TestContext } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole, createShift } from './fixtures.js';

describe('hours', () => {
  let db: Database;
  let ctx: TestContext;
  let app: ReturnType<typeof buildApp>;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;
  let volunteer: Awaited<ReturnType<typeof loginAs>>;
  let volunteerId: number;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    ctx = buildContext(db);
    ctx.setNow('2026-03-02T09:00:00Z');
    app = buildApp(ctx);
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    volunteerId = (await createUser(db, { email: 'vol@example.org' })).id;
    coordinator = await loginAs(app, 'coord@example.org');
    volunteer = await loginAs(app, 'vol@example.org');
  });
  afterAll(() => db.destroy());

  async function checkedInShift(startsAt: string, endsAt: string) {
    const event = await createEvent(db, { name: 'Pantry' });
    const role = await createRole(db, event.id, { name: 'Packing' });
    const shift = await createShift(db, { eventId: event.id, roleId: role.id, startsAt, endsAt });
    const { body } = await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    ctx.setNow(startsAt);
    await coordinator
      .post(`/api/signups/${body.signup.id}/attendance`)
      .send({ attendance: 'present' })
      .expect(200);
    return body.signup.id as number;
  }

  it('credits the shift length when a volunteer is checked in', async () => {
    await checkedInShift('2026-03-07T09:00:00Z', '2026-03-07T12:30:00Z');
    const res = await volunteer.get(`/api/volunteers/${volunteerId}/hours`);
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([
      expect.objectContaining({
        workedOn: '2026-03-07',
        hours: 3.5,
        description: 'Pantry: Packing',
        source: 'shift',
      }),
    ]);
    expect(res.body.totals).toEqual([{ year: 2026, hours: 3.5, entries: 1 }]);
  });

  it('removes the hours when the check-in is undone', async () => {
    const signupId = await checkedInShift('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
    await coordinator
      .post(`/api/signups/${signupId}/attendance`)
      .send({ attendance: 'pending' })
      .expect(200);
    const res = await volunteer.get(`/api/volunteers/${volunteerId}/hours`);
    expect(res.body.entries).toHaveLength(0);
  });

  it('adds up hours per year', async () => {
    for (const [workedOn, hours] of [
      ['2025-11-20', 2],
      ['2025-12-01', 1.5],
      ['2026-02-14', 4],
    ] as const) {
      await coordinator
        .post(`/api/volunteers/${volunteerId}/hours`)
        .send({ workedOn, hours, description: 'Warehouse clean-up' })
        .expect(201);
    }
    const res = await volunteer.get(`/api/volunteers/${volunteerId}/hours`);
    expect(res.body.totals).toEqual([
      { year: 2026, hours: 4, entries: 1 },
      { year: 2025, hours: 3.5, entries: 2 },
    ]);
    const only2025 = await volunteer.get(`/api/volunteers/${volunteerId}/hours?year=2025`);
    expect(only2025.body.entries.map((e: { workedOn: string }) => e.workedOn)).toEqual([
      '2025-12-01',
      '2025-11-20',
    ]);
  });

  it('validates manual entries', async () => {
    const url = `/api/volunteers/${volunteerId}/hours`;
    const bad = await coordinator
      .post(url)
      .send({ workedOn: '2026-02-30', hours: 0.1, description: '' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.details.fields).sort()).toEqual([
      'description',
      'hours',
      'workedOn',
    ]);
    const future = await coordinator
      .post(url)
      .send({ workedOn: '2026-04-01', hours: 1, description: 'x' });
    expect(future.status).toBe(400);
  });

  it('only lets coordinators add or delete hours', async () => {
    const res = await volunteer
      .post(`/api/volunteers/${volunteerId}/hours`)
      .send({ workedOn: '2026-02-01', hours: 1, description: 'Self-reported' });
    expect(res.status).toBe(403);
  });

  it('keeps shift hours tied to the check-in', async () => {
    await checkedInShift('2026-03-07T09:00:00Z', '2026-03-07T12:00:00Z');
    const entry = await db.selectFrom('hour_entries').select('id').executeTakeFirstOrThrow();
    const res = await coordinator.delete(`/api/hours/${entry.id}`);
    expect(res.status).toBe(409);
  });

  it("does not show other volunteers' hours", async () => {
    const other = await createUser(db, { email: 'other@example.org' });
    expect((await volunteer.get(`/api/volunteers/${other.id}/hours`)).status).toBe(403);
    expect((await coordinator.get(`/api/volunteers/${other.id}/hours`)).status).toBe(200);
  });
});
