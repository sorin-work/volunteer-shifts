import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '../../db/connection.js';
import type { User } from '../../db/types.js';

export const SESSION_COOKIE = 'vs_session';

/** Only a hash of the token is stored, so a leaked sessions table can't be replayed. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Database,
  userId: number,
  ttlHours: number,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + ttlHours * 3_600_000);
  await db
    .insertInto('sessions')
    .values({ id: hashToken(token), user_id: userId, expires_at: expiresAt })
    .execute();
  return { token, expiresAt };
}

export async function findSessionUser(
  db: Database,
  token: string,
  now = new Date(),
): Promise<User | undefined> {
  return db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .selectAll('users')
    .where('sessions.id', '=', hashToken(token))
    .where('sessions.expires_at', '>', now)
    .executeTakeFirst();
}

export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.deleteFrom('sessions').where('id', '=', hashToken(token)).execute();
}
