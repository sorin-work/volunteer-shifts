import type { Shift } from '../../db/types.js';
import { localDate, wallClock } from '../../lib/time.js';

const hhmm = (d: Date, tz: string) => {
  const w = wallClock(d, tz);
  return `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
};

export function toShiftDto(shift: Shift, timezone: string) {
  return {
    id: shift.id,
    eventId: shift.event_id,
    roleId: shift.role_id,
    startsAt: shift.starts_at.toISOString(),
    endsAt: shift.ends_at.toISOString(),
    // Local wall-clock values in the event's time zone, for display and editing.
    date: localDate(shift.starts_at, timezone),
    startTime: hhmm(shift.starts_at, timezone),
    endTime: hhmm(shift.ends_at, timezone),
    capacity: shift.capacity,
    notes: shift.notes,
  };
}
