import { describe, expect, it } from 'vitest';
import { containsPattern } from './search.js';

describe('containsPattern', () => {
  it('wraps the term and escapes wildcards', () => {
    expect(containsPattern('ana')).toBe('%ana%');
    expect(containsPattern('50%_off')).toBe('%50\\%\\_off%');
    expect(containsPattern('a\\b')).toBe('%a\\\\b%');
  });
});
