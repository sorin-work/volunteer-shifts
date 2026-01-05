// Time zone helpers built on Intl, so we don't need a date library.
// Shifts are stored as UTC instants; events carry an IANA time zone that
// decides what "Saturday 9:00" means for the people on the ground.

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** The wall-clock reading in `tz` at the given instant. */
export function wallClock(instant: Date, tz: string): WallClock {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(tz).formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  };
}

/** Offset of `tz` from UTC at the given instant, in minutes (east positive). */
export function offsetMinutes(instant: Date, tz: string): number {
  const w = wallClock(instant, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isIsoDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

export function isTimeOfDay(value: string): boolean {
  return TIME_RE.test(value);
}

/**
 * Converts a local date + time in `tz` to a UTC instant. Times that don't
 * exist (spring-forward gap) move forward by the gap; ambiguous times
 * (fall-back) resolve to the first occurrence.
 */
export function zonedTimeToUtc(date: string, time: string, tz: string): Date {
  const dm = DATE_RE.exec(date);
  const tm = TIME_RE.exec(time);
  if (!dm || !tm) throw new Error(`invalid local time ${date} ${time}`);
  const guess = Date.UTC(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
  );
  // Two passes handle the offset changing between the guess and the answer.
  const first = guess - offsetMinutes(new Date(guess), tz) * 60_000;
  const second = guess - offsetMinutes(new Date(first), tz) * 60_000;
  if (first === second) return new Date(first);
  // Ambiguous or skipped: prefer the earlier candidate that reads back correctly.
  const candidates = [Math.min(first, second), Math.max(first, second)];
  for (const c of candidates) {
    const w = wallClock(new Date(c), tz);
    if (w.hour === Number(tm[1]) && w.minute === Number(tm[2])) return new Date(c);
  }
  return new Date(Math.max(first, second));
}

/** The calendar date (YYYY-MM-DD) in `tz` at the given instant. */
export function localDate(instant: Date, tz: string): string {
  const w = wallClock(instant, tz);
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
