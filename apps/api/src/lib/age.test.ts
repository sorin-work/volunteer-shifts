import { describe, expect, it } from 'vitest';
import { ageOn } from './age.js';

describe('ageOn', () => {
  it('counts whole years', () => {
    expect(ageOn('2000-01-15', '2026-06-01')).toBe(26);
    expect(ageOn('2010-03-01', '2026-03-01')).toBe(16);
  });

  it('is zero in the year of birth', () => {
    expect(ageOn('2026-01-01', '2026-12-31')).toBe(0);
  });
});
