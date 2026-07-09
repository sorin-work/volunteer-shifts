import { describe, expect, it } from 'vitest';
import { filterShifts } from './shift-filters';
import type { EventShift } from './types';

const shift = (id: number, roleId: number, confirmed: number, mine = false): EventShift => ({
  id,
  eventId: 1,
  roleId,
  startsAt: '2026-07-11T09:00:00Z',
  endsAt: '2026-07-11T12:00:00Z',
  date: '2026-07-11',
  startTime: '09:00',
  endTime: '12:00',
  capacity: 2,
  notes: '',
  confirmedCount: confirmed,
  waitlistCount: 0,
  mySignup: mine ? { id: 9, status: 'confirmed' } : null,
  eligibility: null,
});

describe('filterShifts', () => {
  const shifts = [shift(1, 10, 0), shift(2, 20, 2), shift(3, 20, 2, true), shift(4, 10, 1)];

  it('filters by role', () => {
    expect(filterShifts(shifts, { roleId: 20, openOnly: false }).map((s) => s.id)).toEqual([2, 3]);
  });

  it('hides full shifts but keeps the ones you are on', () => {
    expect(filterShifts(shifts, { roleId: null, openOnly: true }).map((s) => s.id)).toEqual([
      1, 3, 4,
    ]);
  });
});
