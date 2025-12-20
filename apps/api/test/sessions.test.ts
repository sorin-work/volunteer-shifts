import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { hashPassword, verifyPassword } from '../src/modules/auth/passwords.js';
import {
  createSession,
  deleteSession,
  findSessionUser,
  hashToken,
} from '../src/modules/auth/sessions.js';
import { createTestDatabase, resetDatabase } from './db.js';

describe('passwords', () => {
  it('verifies the original password only', async () => {
    const hash = await hashPassword('correct horse', 4);
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong horse', hash)).toBe(false);
  });
});

describe('sessions', () => {
  let db: Database;
  let userId: number;
  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    const user = await db
      .insertInto('users')
      .values({ email: 'a@example.org', password_hash: 'x', name: 'A' })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = user.id;
  });
  afterAll(() => db.destroy());

  it('stores a hash, not the token', async () => {
    const { token } = await createSession(db, userId, 1);
    const row = await db.selectFrom('sessions').selectAll().executeTakeFirstOrThrow();
    expect(row.id).not.toBe(token);
    expect(row.id).toBe(hashToken(token));
  });

  it('finds the user for a valid token', async () => {
    const { token } = await createSession(db, userId, 1);
    const user = await findSessionUser(db, token);
    expect(user?.id).toBe(userId);
  });

  it('ignores expired sessions', async () => {
    const now = new Date('2026-01-01T10:00:00Z');
    const { token } = await createSession(db, userId, 1, now);
    expect(await findSessionUser(db, token, new Date('2026-01-01T10:59:00Z'))).toBeDefined();
    expect(await findSessionUser(db, token, new Date('2026-01-01T11:01:00Z'))).toBeUndefined();
  });

  it('can be deleted', async () => {
    const { token } = await createSession(db, userId, 1);
    await deleteSession(db, token);
    expect(await findSessionUser(db, token)).toBeUndefined();
  });
});
