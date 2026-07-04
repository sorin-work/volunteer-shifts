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

  it('sends security headers and disables caching', async () => {
    const res = await request(buildApp(buildContext(db))).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('reports the database being unreachable', async () => {
    const broken = await createTestDatabase();
    await broken.destroy();
    const res = await request(buildApp(buildContext(broken))).get('/api/health');
    expect(res.status).toBe(503);
  });
});
