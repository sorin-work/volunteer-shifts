import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { sendDueReminders } from '../src/modules/reminders/service.js';
import { buildApp, buildContext, createUser, loginAs, type TestContext } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole, createShift } from './fixtures.js';

describe('shift reminders', () => {
  let db: Database;
  let ctx: TestContext;
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
    const app = buildApp(ctx);
    await createUser(db, { email: 'vol@example.org', name: 'Vera' });
    volunteer = await loginAs(app, 'vol@example.org');
    event = await createEvent(db, { name: 'Riverside pantry', timezone: 'Europe/London' });
    roleId = (await createRole(db, event.id)).id;
  });
  afterAll(() => db.destroy());

  async function signUpFor(startsAt: string, endsAt: string) {
    const shift = await createShift(db, { eventId: event.id, roleId, startsAt, endsAt });
    await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    ctx.mailer.clear();
    return shift;
  }

  it('reminds volunteers whose shift starts within 24 hours', async () => {
    await signUpFor('2026-03-03T08:00:00Z', '2026-03-03T11:00:00Z');
    await signUpFor('2026-03-05T08:00:00Z', '2026-03-05T11:00:00Z');
    expect(await sendDueReminders(ctx)).toBe(1);
    const [mail] = ctx.mailer.to('vol@example.org');
    expect(mail?.subject).toBe('Reminder: Riverside pantry tomorrow');
    expect(mail?.text).toContain('Tuesday, 3 March 2026, 08:00–11:00 (Europe/London)');
  });

  it('sends each reminder once', async () => {
    await signUpFor('2026-03-03T08:00:00Z', '2026-03-03T11:00:00Z');
    await sendDueReminders(ctx);
    ctx.setNow('2026-03-02T09:10:00Z');
    expect(await sendDueReminders(ctx)).toBe(0);
    expect(ctx.mailer.sent).toHaveLength(1);
  });

  it('skips cancelled signups and cancelled events', async () => {
    await signUpFor('2026-03-03T08:00:00Z', '2026-03-03T11:00:00Z');
    const signup = await db.selectFrom('signups').select('id').executeTakeFirstOrThrow();
    await volunteer.delete(`/api/signups/${signup.id}`).expect(200);
    expect(await sendDueReminders(ctx)).toBe(0);

    await signUpFor('2026-03-02T20:00:00Z', '2026-03-02T22:00:00Z');
    await db.updateTable('events').set({ status: 'cancelled' }).execute();
    expect(await sendDueReminders(ctx)).toBe(0);
  });

  it('does not remind people who are only on the waitlist', async () => {
    const shift = await createShift(db, {
      eventId: event.id,
      roleId,
      startsAt: '2026-03-03T08:00:00Z',
      endsAt: '2026-03-03T11:00:00Z',
      capacity: 1,
    });
    const app = buildApp(ctx);
    await createUser(db, { email: 'first@example.org' });
    await (await loginAs(app, 'first@example.org'))
      .post(`/api/shifts/${shift.id}/signups`)
      .expect(201);
    await volunteer.post(`/api/shifts/${shift.id}/signups`).expect(201);
    ctx.mailer.clear();

    expect(await sendDueReminders(ctx)).toBe(1);
    expect(ctx.mailer.to('first@example.org')).toHaveLength(1);
    expect(ctx.mailer.to('vol@example.org')).toHaveLength(0);
  });

  it('picks up later shifts as the clock moves', async () => {
    await signUpFor('2026-03-05T08:00:00Z', '2026-03-05T11:00:00Z');
    expect(await sendDueReminders(ctx)).toBe(0);
    ctx.setNow('2026-03-04T08:30:00Z');
    expect(await sendDueReminders(ctx)).toBe(1);
  });
});
