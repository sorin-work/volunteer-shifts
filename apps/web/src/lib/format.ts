import type { EventShift, Shift } from './types';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Sat, 7 Mar 2026" for a YYYY-MM-DD calendar date. */
export function formatDate(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

/** "09:00–12:00", with "(+1)" when the shift ends the next day. */
export function formatTimeRange(shift: Pick<Shift, 'startTime' | 'endTime'>): string {
  const overnight = shift.endTime <= shift.startTime;
  return `${shift.startTime}–${shift.endTime}${overnight ? ' (+1)' : ''}`;
}

/** Date and time of an instant in a given time zone, e.g. "Sat 7 Mar, 09:00". */
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(iso));
}

export function shiftHours(shift: Pick<Shift, 'startsAt' | 'endsAt'>): number {
  return (new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / 3_600_000;
}

/** "3 h", "2.5 h", "45 min". */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded} h`;
}

export function groupByDate<T extends Pick<Shift, 'date' | 'startsAt'>>(
  shifts: T[],
): { date: string; shifts: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const s of [...shifts].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const list = groups.get(s.date) ?? [];
    list.push(s);
    groups.set(s.date, list);
  }
  return [...groups].map(([date, shifts]) => ({ date, shifts }));
}

export function spotsLabel(
  shift: Pick<EventShift, 'capacity' | 'confirmedCount' | 'waitlistCount'>,
) {
  const left = shift.capacity - shift.confirmedCount;
  if (left > 0) return `${left} of ${shift.capacity} spots left`;
  return shift.waitlistCount > 0 ? `Full · ${shift.waitlistCount} on waitlist` : 'Full';
}

/** "1 shift", "3 shifts", "2 people". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
