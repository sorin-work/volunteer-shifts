import { addDays, zonedTimeToUtc } from '../../lib/time.js';

export const MAX_SHIFT_HOURS = 16;

export interface LocalShiftTimes {
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Turns local shift times into UTC instants. An end time at or before the
 * start time means the shift runs past midnight (e.g. 22:00-06:00).
 */
export function resolveShiftTimes(
  { date, startTime, endTime }: LocalShiftTimes,
  timezone: string,
): { startsAt: Date; endsAt: Date } {
  const endDate = endTime <= startTime ? addDays(date, 1) : date;
  return {
    startsAt: zonedTimeToUtc(date, startTime, timezone),
    endsAt: zonedTimeToUtc(endDate, endTime, timezone),
  };
}

export function durationHours(startsAt: Date, endsAt: Date): number {
  return (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
}
