import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';

describe('volunteer directory', () => {
  let db: Database;
  let app: ReturnType<typeof buildApp>;
  let coordinator: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    app = buildApp(buildContext(db));
    await createUser(db, {
      email: 'coord@example.org',
      name: 'Cora Coordinator',
      role: 'coordinator',
    });
    for (const name of ['Ada Lovelace', 'Grace Hopper', 'Alan Turing']) {
      await createUser(db, { name, email: `${name.split(' ')[0]!.toLowerCase()}@example.org` });
    }
    coordinator = await loginAs(app, 'coord@example.org');
  });
  afterAll(() => db.destroy());

  it('lists people alphabetically with paging info', async () => {
    const res = await coordinator.get('/api/volunteers?pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.volunteers.map((v: { name: string }) => v.name)).toEqual([
      'Ada Lovelace',
      'Alan Turing',
    ]);
    expect(res.body).toMatchObject({ page: 1, pageSize: 2, total: 4, totalPages: 2 });

    const second = await coordinator.get('/api/volunteers?pageSize=2&page=2');
    expect(second.body.volunteers.map((v: { name: string }) => v.name)).toEqual([
      'Cora Coordinator',
      'Grace Hopper',
    ]);
  });

  it('searches by name or email, case-insensitively', async () => {
    const byName = await coordinator.get('/api/volunteers?search=hopper');
    expect(byName.body.volunteers.map((v: { name: string }) => v.name)).toEqual(['Grace Hopper']);
    const byEmail = await coordinator.get('/api/volunteers?search=ALAN@');
    expect(byEmail.body.volunteers).toHaveLength(1);
  });

  it('treats % and _ in the search as plain text', async () => {
    const res = await coordinator.get('/api/volunteers?search=%25');
    expect(res.body.volunteers).toHaveLength(0);
  });

  it('is coordinator-only', async () => {
    const agent = await loginAs(app, 'ada@example.org');
    expect((await agent.get('/api/volunteers')).status).toBe(403);
  });
});
