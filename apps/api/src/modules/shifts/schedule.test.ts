import { describe, expect, it } from 'vitest';
import { durationHours, resolveShiftTimes } from './schedule.js';

describe('resolveShiftTimes', () => {
  it('converts a daytime shift in the event zone', () => {
    const t = resolveShiftTimes(
      { date: '2026-06-06', startTime: '09:00', endTime: '13:30' },
      'Europe/Bucharest',
    );
    expect(t.startsAt.toISOString()).toBe('2026-06-06T06:00:00.000Z');
    expect(t.endsAt.toISOString()).toBe('2026-06-06T10:30:00.000Z');
  });

  it('rolls an overnight shift into the next day', () => {
    const t = resolveShiftTimes(
      { date: '2026-08-14', startTime: '22:00', endTime: '04:00' },
      'UTC',
    );
    expect(t.endsAt.toISOString()).toBe('2026-08-15T04:00:00.000Z');
    expect(durationHours(t.startsAt, t.endsAt)).toBe(6);
  });

  it('counts real hours across a DST change', () => {
    // Clocks go back in London overnight on 2026-10-25: 22:00-06:00 is 9 hours.
    const t = resolveShiftTimes(
      { date: '2026-10-24', startTime: '22:00', endTime: '06:00' },
      'Europe/London',
    );
    expect(durationHours(t.startsAt, t.endsAt)).toBe(9);
  });
});
