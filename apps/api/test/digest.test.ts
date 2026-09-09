import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { sendCoordinatorDigest } from '../src/modules/digest/service.js';
import { buildContext, createUser, type TestContext } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';
import { createEvent, createRole, createShift } from './fixtures.js';

describe('coordinator digest', () => {
  let db: Database;
  let ctx: TestContext;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    ctx = buildContext(db);
    ctx.setNow('2026-03-02T08:00:00Z');
    await createUser(db, { email: 'coord@example.org', name: 'Cora', role: 'coordinator' });
    await createUser(db, { email: 'vol@example.org' });
    const event = await createEvent(db, { name: 'Pantry' });
    const role = await createRole(db, event.id, { name: 'Packing' });
    await createShift(db, {
      eventId: event.id,
      roleId: role.id,
      startsAt: '2026-03-03T09:00:00Z',
      endsAt: '2026-03-03T12:00:00Z',
      capacity: 4,
    });
  });
  afterAll(() => db.destroy());

  it('emails coordinators the shifts that need people', async () => {
    expect(await sendCoordinatorDigest(ctx)).toBe(1);
    const [mail] = ctx.mailer.to('coord@example.org');
    expect(mail?.subject).toBe('1 shift still needs volunteers');
    expect(mail?.text).toContain('Pantry: Packing');
    expect(mail?.text).toContain('0/4 filled');
    expect(ctx.mailer.to('vol@example.org')).toHaveLength(0);
  });

  it('runs once a day', async () => {
    await sendCoordinatorDigest(ctx);
    ctx.setNow('2026-03-02T15:00:00Z');
    expect(await sendCoordinatorDigest(ctx)).toBe(0);
    ctx.setNow('2026-03-03T07:30:00Z');
    expect(await sendCoordinatorDigest(ctx)).toBe(1);
  });

  it('waits until the digest hour', async () => {
    ctx.setNow('2026-03-02T05:00:00Z');
    expect(await sendCoordinatorDigest(ctx)).toBe(0);
  });
});
