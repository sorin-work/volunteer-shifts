import type { EventShift } from './types';

export interface ShiftFilter {
  roleId: number | null;
  openOnly: boolean;
}

/** Shifts matching the role filter; "open only" hides full shifts unless you're on them. */
export function filterShifts(shifts: EventShift[], filter: ShiftFilter): EventShift[] {
  return shifts.filter((s) => {
    if (filter.roleId !== null && s.roleId !== filter.roleId) return false;
    if (filter.openOnly && !s.mySignup && s.confirmedCount >= s.capacity) return false;
    return true;
  });
}
