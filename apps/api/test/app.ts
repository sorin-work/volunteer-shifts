import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { AppContext } from '../src/context.js';
import type { Database } from '../src/db/connection.js';
import type { NewUser } from '../src/db/types.js';
import { hashPassword } from '../src/modules/auth/passwords.js';

export const TEST_PASSWORD = 'password123';

export function testConfig() {
  return loadConfig({ NODE_ENV: 'test', BCRYPT_ROUNDS: '4', LOG_LEVEL: 'silent' });
}

export interface TestContext extends AppContext {
  /** Moves the injected clock; tests start at 2026-03-02 09:00 UTC. */
  setNow(date: Date | string): void;
}

export function buildContext(db: Database): TestContext {
  let now = new Date('2026-03-02T09:00:00Z');
  return {
    db,
    config: testConfig(),
    now: () => now,
    setNow: (d) => {
      now = new Date(d);
    },
  };
}

export function buildApp(ctx: AppContext) {
  return createApp(ctx);
}

let counter = 0;
export async function createUser(db: Database, attrs: Partial<NewUser> = {}) {
  counter += 1;
  return db
    .insertInto('users')
    .values({
      email: attrs.email ?? `user${counter}@example.org`,
      name: attrs.name ?? `User ${counter}`,
      password_hash: await hashPassword(TEST_PASSWORD, 4),
      ...attrs,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** A supertest agent holding a session cookie for the given user. */
export async function loginAs(app: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return agent;
}
