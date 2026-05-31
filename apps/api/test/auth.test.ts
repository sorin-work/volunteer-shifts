import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs, TEST_PASSWORD } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';

describe('auth routes', () => {
  let db: Database;
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    app = buildApp(buildContext(db));
  });
  afterAll(() => db.destroy());

  describe('POST /api/auth/register', () => {
    it('creates a volunteer account and signs in', async () => {
      const agent = request.agent(app);
      const res = await agent.post('/api/auth/register').send({
        name: 'Maya Lopez',
        email: 'maya@example.org',
        password: 'long-enough',
        birthDate: '1998-04-12',
      });
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        name: 'Maya Lopez',
        role: 'volunteer',
        birthDate: '1998-04-12',
      });
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toMatch(/vs_session=.*HttpOnly/);

      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('maya@example.org');
    });

    it('rejects short passwords and bad emails', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'X', email: 'not-an-email', password: 'short' });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.details.fields).sort()).toEqual(['email', 'password']);
    });

    it('rejects a duplicate email', async () => {
      await createUser(db, { email: 'taken@example.org' });
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'X', email: 'taken@example.org', password: 'long-enough' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('email_taken');
    });

    it('never lets people register as coordinators', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'X', email: 'x@example.org', password: 'long-enough', role: 'coordinator' });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('volunteer');
    });
  });

  describe('POST /api/auth/login', () => {
    it('signs in with the right password', async () => {
      await createUser(db, { email: 'sam@example.org' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sam@example.org', password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('sam@example.org');
    });

    it('gives the same error for unknown users and wrong passwords', async () => {
      await createUser(db, { email: 'sam@example.org' });
      const wrong = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sam@example.org', password: 'nope-nope' });
      const unknown = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.org', password: 'nope-nope' });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.error.message).toBe(unknown.body.error.message);
    });
  });

  it('slows down repeated failed sign-ins', async () => {
    await createUser(db, { email: 'sam@example.org' });
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'sam@example.org', password: 'bad-guess' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sam@example.org', password: TEST_PASSWORD });
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  describe('session', () => {
    it('requires a session for /me', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('logout ends the session', async () => {
      await createUser(db, { email: 'sam@example.org' });
      const agent = await loginAs(app, 'sam@example.org');
      expect((await agent.post('/api/auth/logout')).status).toBe(204);
      expect((await agent.get('/api/auth/me')).status).toBe(401);
      expect(await db.selectFrom('sessions').selectAll().execute()).toHaveLength(0);
    });
  });
});
