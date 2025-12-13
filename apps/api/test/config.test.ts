import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(4000);
    expect(config.SESSION_TTL_HOURS).toBe(336);
  });

  it('coerces numbers from strings', () => {
    expect(loadConfig({ PORT: '8081' }).PORT).toBe(8081);
  });

  it('rejects invalid values with a readable message', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
