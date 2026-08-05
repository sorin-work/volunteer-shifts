import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';

describe('hours report', () => {
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
    const ana = await createUser(db, { email: 'ana@example.org', name: 'Ana' });
    const ben = await createUser(db, { email: 'ben@example.org', name: 'Ben' });
    await createUser(db, { email: 'idle@example.org', name: 'Idle' });
    await db
      .insertInto('hour_entries')
      .values([
        { user_id: ana.id, worked_on: '2026-01-10', hours: 2, description: 'a' },
        { user_id: ana.id, worked_on: '2026-02-10', hours: 1.25, description: 'b' },
        { user_id: ben.id, worked_on: '2026-03-01', hours: 5, description: 'c' },
        { user_id: ben.id, worked_on: '2025-12-31', hours: 8, description: 'old' },
      ])
      .execute();
  });
  afterAll(() => db.destroy());

  it('totals hours per volunteer for the year, most hours first', async () => {
    const res = await coordinator.get('/api/reports/hours?year=2026');
    expect(res.status).toBe(200);
    expect(
      res.body.volunteers.map((v: { name: string; hours: number }) => [v.name, v.hours]),
    ).toEqual([
      ['Ben', 5],
      ['Ana', 3.25],
    ]);
    expect(res.body.totals).toEqual({ volunteers: 2, hours: 8.25, shifts: 0 });
  });

  it('defaults to the current year and validates the year', async () => {
    const res = await coordinator.get('/api/reports/hours');
    expect(res.body.year).toBe(2026);
    expect((await coordinator.get('/api/reports/hours?year=abc')).status).toBe(400);
  });

  it('is coordinator-only', async () => {
    const ana = await loginAs(app, 'ana@example.org');
    expect((await ana.get('/api/reports/hours')).status).toBe(403);
  });
});
