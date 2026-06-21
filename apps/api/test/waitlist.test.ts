import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs, type TestContext } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole, createShift } from './fixtures.js';

describe('waitlist', () => {
  let db: Database;
  let ctx: TestContext;
  let app: ReturnType<typeof buildApp>;
  let shiftId: number;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    ctx = buildContext(db);
    app = buildApp(ctx);
    const event = await createEvent(db);
    const role = await createRole(db, event.id);
    const shift = await createShift(db, {
      eventId: event.id,
      roleId: role.id,
      startsAt: '2026-03-07T09:00:00Z',
      endsAt: '2026-03-07T12:00:00Z',
      capacity: 1,
    });
    shiftId = shift.id;
  });
  afterAll(() => db.destroy());

  async function volunteer(name: string) {
    await createUser(db, { email: `${name}@example.org`, name });
    const agent = await loginAs(app, `${name}@example.org`);
    const res = await agent.post(`/api/shifts/${shiftId}/signups`).expect(201);
    return { agent, signup: res.body.signup };
  }

  async function statusOf(signupId: number) {
    const row = await db
      .selectFrom('signups')
      .select('status')
      .where('id', '=', signupId)
      .executeTakeFirstOrThrow();
    return row.status;
  }

  it('numbers waitlist positions in sign-up order', async () => {
    await volunteer('ana');
    const ben = await volunteer('ben');
    const cleo = await volunteer('cleo');
    expect(ben.signup.waitlistPosition).toBe(1);
    expect(cleo.signup.waitlistPosition).toBe(2);
  });

  it('shows the waitlist position in my shifts', async () => {
    await volunteer('ana');
    await volunteer('ben');
    const cleo = await volunteer('cleo');
    const res = await cleo.agent.get('/api/me/signups');
    expect(res.body.signups[0]).toMatchObject({ status: 'waitlisted', waitlistPosition: 2 });
  });

  it('promotes a waitlisted volunteer when a confirmed one cancels', async () => {
    const ana = await volunteer('ana');
    const ben = await volunteer('ben');
    await ana.agent.delete(`/api/signups/${ana.signup.id}`).expect(200);
    expect(await statusOf(ben.signup.id)).toBe('confirmed');
    expect(ctx.mailer.to('ben@example.org').map((m) => m.subject)).toEqual([
      "You're on the waitlist: Food bank Saturday",
      'A spot opened up: Food bank Saturday',
    ]);
  });

  it('promotes whoever has waited longest', async () => {
    const ana = await volunteer('ana');
    const ben = await volunteer('ben');
    const cleo = await volunteer('cleo');
    const dan = await volunteer('dan');
    await ana.agent.delete(`/api/signups/${ana.signup.id}`).expect(200);
    expect(await statusOf(ben.signup.id)).toBe('confirmed');
    expect(await statusOf(cleo.signup.id)).toBe('waitlisted');
    expect(await statusOf(dan.signup.id)).toBe('waitlisted');
    const res = await dan.agent.get('/api/me/signups');
    expect(res.body.signups[0].waitlistPosition).toBe(2);
  });

  it('does not promote anyone when a waitlisted volunteer leaves', async () => {
    await volunteer('ana');
    const ben = await volunteer('ben');
    const cleo = await volunteer('cleo');
    await ben.agent.delete(`/api/signups/${ben.signup.id}`).expect(200);
    expect(await statusOf(cleo.signup.id)).toBe('waitlisted');
  });

  it('promotes people when the coordinator adds spots', async () => {
    await volunteer('ana');
    const ben = await volunteer('ben');
    await createUser(db, { email: 'coord@example.org', role: 'coordinator' });
    const coord = await loginAs(app, 'coord@example.org');
    await coord.patch(`/api/shifts/${shiftId}`).send({ capacity: 2 }).expect(200);
    expect(await statusOf(ben.signup.id)).toBe('confirmed');
  });

  it('shows the waitlist size on the event page', async () => {
    await volunteer('ana');
    const ben = await volunteer('ben');
    const event = await ben.agent.get('/api/events/1');
    expect(event.body.shifts[0]).toMatchObject({
      confirmedCount: 1,
      waitlistCount: 1,
      mySignup: { status: 'waitlisted' },
    });
  });
});
