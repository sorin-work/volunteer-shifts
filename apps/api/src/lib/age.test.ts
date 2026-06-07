import { describe, expect, it } from 'vitest';
import { ageOn } from './age.js';

describe('ageOn', () => {
  it('counts whole years', () => {
    expect(ageOn('2000-01-15', '2026-06-01')).toBe(26);
    expect(ageOn('2010-03-01', '2026-03-01')).toBe(16);
  });

  it('only counts the year once the birthday has passed', () => {
    expect(ageOn('2008-09-01', '2026-06-01')).toBe(17);
    expect(ageOn('2008-09-01', '2026-08-31')).toBe(17);
    expect(ageOn('2008-09-01', '2026-09-01')).toBe(18);
  });

  it('handles leap-day birthdays', () => {
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17);
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
  });

  it('is zero in the year of birth', () => {
    expect(ageOn('2026-01-01', '2026-12-31')).toBe(0);
  });
});
