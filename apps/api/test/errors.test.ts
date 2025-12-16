import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { HttpError } from '../src/lib/errors.js';
import { validate } from '../src/lib/validate.js';

describe('error handling', () => {
  it('returns a json 404 for unknown api routes', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('rejects malformed json bodies', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .set('content-type', 'application/json')
      .send('{"oops"');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});

describe('validate', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int() });

  it('returns parsed data', () => {
    expect(validate(schema, { name: 'Ana', age: 30 })).toEqual({ name: 'Ana', age: 30 });
  });

  it('collects the first message per field', () => {
    try {
      validate(schema, { name: '', age: 1.5 });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const e = err as HttpError;
      expect(e.status).toBe(400);
      expect(Object.keys((e.details as { fields: object }).fields).sort()).toEqual(['age', 'name']);
    }
  });
});
