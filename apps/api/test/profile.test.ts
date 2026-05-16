import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext, createUser, loginAs, TEST_PASSWORD } from './app.js';
import { createTestDatabase, resetDatabase } from './db.js';

describe('profile', () => {
  let db: Database;
  let app: ReturnType<typeof buildApp>;
  let agent: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase(db);
    app = buildApp(buildContext(db));
    await createUser(db, { email: 'vol@example.org', name: 'Old Name', phone: '123' });
    agent = await loginAs(app, 'vol@example.org');
  });
  afterAll(() => db.destroy());

  it('updates name, phone and birth date', async () => {
    const res = await agent
      .patch('/api/me/profile')
      .send({ name: 'New Name', phone: '', birthDate: '2001-02-03' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'New Name', phone: null, birthDate: '2001-02-03' });
  });

  it('leaves fields that were not sent alone', async () => {
    const res = await agent.patch('/api/me/profile').send({ name: 'Only Name' });
    expect(res.body.user).toMatchObject({ name: 'Only Name', phone: '123' });
  });

  it('rejects a birth date in the future', async () => {
    const res = await agent.patch('/api/me/profile').send({ birthDate: '2030-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields.birthDate).toBeDefined();
  });

  it('changes the password after checking the current one', async () => {
    const wrong = await agent
      .post('/api/me/profile/password')
      .send({ currentPassword: 'nope', newPassword: 'a-new-password' });
    expect(wrong.status).toBe(400);

    const other = await loginAs(app, 'vol@example.org');
    const res = await agent
      .post('/api/me/profile/password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'a-new-password' });
    expect(res.status).toBe(204);

    // This device stays signed in, other sessions are ended.
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vol@example.org', password: 'a-new-password' });
    expect(login.status).toBe(200);
  });
});
