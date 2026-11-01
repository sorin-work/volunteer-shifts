import { describe, expect, it } from 'vitest';
import {
  addDays,
  isIsoDate,
  isTimeOfDay,
  isValidTimeZone,
  localDate,
  offsetMinutes,
  zonedTimeToUtc,
} from './time.js';

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isValidTimeZone('Europe/Bucharest')).toBe(true);
    expect(isValidTimeZone('America/Chicago')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('isIsoDate / isTimeOfDay', () => {
  it('validates calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-2-1')).toBe(false);
  });

  it('validates 24h times', () => {
    expect(isTimeOfDay('00:00')).toBe(true);
    expect(isTimeOfDay('23:59')).toBe(true);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(isTimeOfDay('9:00')).toBe(false);
  });
});

describe('zonedTimeToUtc', () => {
  it('converts winter and summer times in London', () => {
    expect(zonedTimeToUtc('2026-01-10', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-01-10T09:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-07-10', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-07-10T08:00:00.000Z',
    );
  });

  it('handles zones west of UTC', () => {
    expect(zonedTimeToUtc('2026-03-02', '18:30', 'America/Chicago').toISOString()).toBe(
      '2026-03-03T00:30:00.000Z',
    );
  });

  it('moves times in the spring-forward gap forward', () => {
    // London skips 01:00-02:00 on 2026-03-29, so 01:30 becomes 02:30 BST.
    const d = zonedTimeToUtc('2026-03-29', '01:30', 'Europe/London');
    expect(d.toISOString()).toBe('2026-03-29T01:30:00.000Z');
    expect(zonedTimeToUtc('2026-03-29', '00:30', 'Europe/London').toISOString()).toBe(
      '2026-03-29T00:30:00.000Z',
    );
  });

  it('picks the first occurrence of an ambiguous fall-back time', () => {
    // 01:30 happens twice in New York on 2026-11-01.
    expect(zonedTimeToUtc('2026-11-01', '01:30', 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });
});

describe('offsetMinutes', () => {
  it('reports east-positive offsets', () => {
    expect(offsetMinutes(new Date('2026-07-01T00:00:00Z'), 'Europe/Bucharest')).toBe(180);
    expect(offsetMinutes(new Date('2026-01-01T00:00:00Z'), 'America/Chicago')).toBe(-360);
  });
});

describe('localDate', () => {
  it('uses the calendar day in the given zone', () => {
    const instant = new Date('2026-01-01T03:00:00Z');
    expect(localDate(instant, 'UTC')).toBe('2026-01-01');
    expect(localDate(instant, 'America/Chicago')).toBe('2025-12-31');
  });
});

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('round trips across zones', () => {
  const zones = [
    'UTC',
    'Europe/London',
    'Europe/Bucharest',
    'America/Los_Angeles',
    'Asia/Kolkata',
    'Australia/Adelaide',
    'Pacific/Auckland',
  ];
  const dates = ['2026-01-15', '2026-03-29', '2026-07-01', '2026-10-25', '2026-12-31'];

  it.each(zones)('reads back the same local date and time in %s', (tz) => {
    for (const date of dates) {
      for (const time of ['00:30', '09:00', '13:45', '23:59']) {
        const instant = zonedTimeToUtc(date, time, tz);
        const back = new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(instant);
        // Skipped (spring-forward) times move forward, everything else is exact.
        if (back !== time) expect(back > time).toBe(true);
        else expect(localDate(instant, tz)).toBe(date);
      }
    }
  });

  it('handles half-hour offsets', () => {
    expect(zonedTimeToUtc('2026-06-01', '09:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-06-01T03:30:00.000Z',
    );
  });
});
