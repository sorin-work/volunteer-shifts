import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { DEMO_COORDINATOR, DEMO_VOLUNTEER, seedDemo } from '../src/seed/demo.js';
import { buildApp, buildContext } from './app.js';
import { createTestDatabase } from './db.js';
import request from 'supertest';

describe('demo seed', () => {
  let db: Database;
  const now = new Date('2026-04-02T12:00:00Z');

  beforeAll(async () => {
    db = await createTestDatabase();
    expect(await seedDemo(db, now)).toBe(true);
  });
  afterAll(() => db.destroy());

  it('only runs on an empty database', async () => {
    expect(await seedDemo(db, now)).toBe(false);
  });

  it('creates the demo accounts', async () => {
    const ctx = buildContext(db);
    ctx.setNow(now);
    const app = buildApp(ctx);
    for (const email of [DEMO_COORDINATOR, DEMO_VOLUNTEER]) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'demo-password' });
      expect(res.status).toBe(200);
    }
  });

  it('has past and upcoming shifts, signups and hours', async () => {
    const past = await db.selectFrom('shifts').select('id').where('ends_at', '<=', now).execute();
    const upcoming = await db
      .selectFrom('shifts')
      .select('id')
      .where('starts_at', '>', now)
      .execute();
    expect(past.length).toBeGreaterThan(10);
    expect(upcoming.length).toBeGreaterThan(10);
    const hours = await db.selectFrom('hour_entries').select('id').execute();
    expect(hours.length).toBeGreaterThan(20);
  });

  it('includes some cancellations', async () => {
    const cancelled = await db
      .selectFrom('signups')
      .select('id')
      .where('status', '=', 'cancelled')
      .execute();
    expect(cancelled.length).toBeGreaterThan(0);
  });

  it('never overfills a shift', async () => {
    const rows = await db
      .selectFrom('signups')
      .innerJoin('shifts', 'shifts.id', 'signups.shift_id')
      .select(['shifts.id', 'shifts.capacity', (eb) => eb.fn.countAll<number>().as('n')])
      .where('signups.status', '=', 'confirmed')
      .groupBy(['shifts.id', 'shifts.capacity'])
      .execute();
    for (const r of rows) expect(Number(r.n)).toBeLessThanOrEqual(r.capacity);
  });
});
