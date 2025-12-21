import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/connection.js';
import { buildApp, buildContext } from './app.js';
import { createTestDatabase } from './db.js';

describe('GET /api/health', () => {
  let db: Database;
  beforeAll(async () => {
    db = await createTestDatabase();
  });
  afterAll(() => db.destroy());

  it('reports ok', async () => {
    const res = await request(buildApp(buildContext(db))).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
