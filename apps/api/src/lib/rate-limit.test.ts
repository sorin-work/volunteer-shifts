import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('allows up to the limit within a window', () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.hit('a', 0)).toBe(0);
    expect(limiter.hit('a', 1000)).toBe(0);
    expect(limiter.hit('a', 2000)).toBe(58);
    expect(limiter.hit('b', 2000)).toBe(0);
  });

  it('starts over after the window', () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.hit('a', 0);
    expect(limiter.hit('a', 1)).toBeGreaterThan(0);
    expect(limiter.hit('a', 60_000)).toBe(0);
  });
});
