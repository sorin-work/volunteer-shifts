import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { migrateToLatest } from '../src/db/migrate.js';
import { createTestDatabase } from './db.js';

describe('migrations', () => {
  let db: Database;
  beforeAll(async () => {
    db = await createTestDatabase();
  });
  afterAll(() => db.destroy());

  it('creates the users table', async () => {
    const user = await db
      .insertInto('users')
      .values({ email: 'a@example.org', password_hash: 'x', name: 'A' })
      .returningAll()
      .executeTakeFirstOrThrow();
    expect(user.role).toBe('volunteer');
    expect(user.created_at).toBeInstanceOf(Date);
  });

  it('is a no-op when already up to date', async () => {
    expect(await migrateToLatest(db)).toEqual([]);
  });
});
