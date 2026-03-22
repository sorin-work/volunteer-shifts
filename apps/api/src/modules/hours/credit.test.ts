import { describe, expect, it } from 'vitest';
import { creditedHours } from './credit.js';

describe('creditedHours', () => {
  it('uses the scheduled length of the shift', () => {
    expect(creditedHours(new Date('2026-03-07T09:00:00Z'), new Date('2026-03-07T12:00:00Z'))).toBe(
      3,
    );
  });

  it('rounds to two decimals', () => {
    expect(creditedHours(new Date('2026-03-07T09:00:00Z'), new Date('2026-03-07T11:20:00Z'))).toBe(
      2.33,
    );
  });
});
