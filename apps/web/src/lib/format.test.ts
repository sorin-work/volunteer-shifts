import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatHours,
  formatTimeRange,
  groupByDate,
  shiftHours,
  plural,
  spotsLabel,
} from './format';

describe('formatDate', () => {
  it('formats calendar dates without shifting the day', () => {
    expect(formatDate('2026-03-07')).toBe('Sat, 7 Mar 2026');
    expect(formatDate('2026-01-01')).toBe('Thu, 1 Jan 2026');
  });
});

describe('formatTimeRange', () => {
  it('marks overnight shifts', () => {
    expect(formatTimeRange({ startTime: '09:00', endTime: '12:00' })).toBe('09:00–12:00');
    expect(formatTimeRange({ startTime: '22:00', endTime: '06:00' })).toBe('22:00–06:00 (+1)');
  });
});

describe('formatDateTime', () => {
  it('uses the event time zone', () => {
    expect(formatDateTime('2026-03-07T15:00:00Z', 'America/Chicago')).toBe('Sat 7 Mar, 09:00');
  });
});

describe('hours', () => {
  it('computes shift length', () => {
    expect(shiftHours({ startsAt: '2026-03-07T09:00:00Z', endsAt: '2026-03-07T11:30:00Z' })).toBe(
      2.5,
    );
  });

  it('formats short and long durations', () => {
    expect(formatHours(0.75)).toBe('45 min');
    expect(formatHours(3)).toBe('3 h');
    expect(formatHours(2.333333)).toBe('2.33 h');
  });
});

describe('groupByDate', () => {
  it('groups by local date in time order', () => {
    const groups = groupByDate([
      { id: 1, date: '2026-03-08', startsAt: '2026-03-08T09:00:00Z' },
      { id: 2, date: '2026-03-07', startsAt: '2026-03-07T13:00:00Z' },
      { id: 3, date: '2026-03-07', startsAt: '2026-03-07T09:00:00Z' },
    ]);
    expect(groups.map((g) => [g.date, g.shifts.map((s) => s.id)])).toEqual([
      ['2026-03-07', [3, 2]],
      ['2026-03-08', [1]],
    ]);
  });
});

describe('spotsLabel', () => {
  it('describes open, full and waitlisted shifts', () => {
    expect(spotsLabel({ capacity: 5, confirmedCount: 3, waitlistCount: 0 })).toBe(
      '2 of 5 spots left',
    );
    expect(spotsLabel({ capacity: 2, confirmedCount: 2, waitlistCount: 0 })).toBe('Full');
    expect(spotsLabel({ capacity: 2, confirmedCount: 2, waitlistCount: 4 })).toBe(
      'Full · 4 on waitlist',
    );
  });
});

describe('plural', () => {
  it('picks the right word', () => {
    expect(plural(1, 'shift')).toBe('1 shift');
    expect(plural(0, 'shift')).toBe('0 shifts');
    expect(plural(2, 'person', 'people')).toBe('2 people');
  });
});
