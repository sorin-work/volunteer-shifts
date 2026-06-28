import { describe, expect, it } from 'vitest';
import { escapeIcsText, toIcs } from './ics.js';

describe('ics', () => {
  it('escapes special characters', () => {
    expect(escapeIcsText('Tea, cake; and\nmore\\')).toBe('Tea\\, cake\\; and\\nmore\\\\');
  });

  it('builds a single event calendar in UTC', () => {
    const ics = toIcs({
      uid: 'signup-1@volunteer-shifts',
      start: new Date('2026-07-04T09:00:00Z'),
      end: new Date('2026-07-04T12:30:00Z'),
      stamp: new Date('2026-06-28T10:00:00Z'),
      summary: 'Food bank: Sorting',
      location: 'Riverside Hall, Mill Lane',
    });
    expect(ics).toContain('DTSTART:20260704T090000Z\r\n');
    expect(ics).toContain('DTEND:20260704T123000Z\r\n');
    expect(ics).toContain('LOCATION:Riverside Hall\\, Mill Lane\r\n');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  });

  it('folds long lines', () => {
    const ics = toIcs({
      uid: 'x',
      start: new Date(0),
      end: new Date(0),
      stamp: new Date(0),
      summary: 'A'.repeat(200),
    });
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});
