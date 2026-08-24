import { describe, expect, it, vi } from 'vitest';
import { ApiError, onUnauthorized, request } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    return err as ApiError;
  }
  throw new Error('expected the request to fail');
}

describe('request', () => {
  it('prefixes /api and sends json bodies', async () => {
    const fetch = vi.fn(async () => json(200, { ok: true }));
    const data = await request('/events', { method: 'POST', body: { name: 'X' }, fetch });
    expect(data).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({ method: 'POST', body: '{"name":"X"}' }),
    );
  });

  it('returns undefined for 204', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await request('/signups/1', { method: 'DELETE', fetch })).toBeUndefined();
  });

  it('turns error bodies into ApiError with field messages', async () => {
    const fetch = vi.fn(async () =>
      json(400, {
        error: {
          code: 'validation_error',
          message: 'Some fields are invalid.',
          details: { fields: { email: 'Enter a valid email address.' } },
        },
      }),
    );
    const err = await failure(request('/auth/register', { method: 'POST', body: {}, fetch }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('validation_error');
    expect(err.fields.email).toBe('Enter a valid email address.');
  });

  it('copes with non-json error pages', async () => {
    const fetch = vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }));
    const err = await failure(request('/events', { fetch }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Request failed (502).');
  });

  it('signals an expired session, but not for auth endpoints', async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    const fetch = vi.fn(async () => json(401, { error: { code: 'unauthorized', message: 'x' } }));
    await failure(request('/me/signups', { fetch }));
    expect(handler).toHaveBeenCalledTimes(1);
    await failure(request('/auth/login', { method: 'POST', body: {}, fetch }));
    expect(handler).toHaveBeenCalledTimes(1);
    onUnauthorized(null);
  });

  it('reports network failures', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await failure(request('/events', { fetch }));
    expect(err.code).toBe('network');
  });
});
