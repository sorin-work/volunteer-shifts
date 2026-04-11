import { describe, expect, it } from 'vitest';
import { formatShiftWhen, templates } from './templates.js';

const info = {
  volunteerName: 'Sam',
  eventName: 'Harvest Festival',
  roleName: 'Info tent',
  startsAt: new Date('2026-06-06T09:00:00Z'),
  endsAt: new Date('2026-06-06T13:00:00Z'),
  timezone: 'Europe/London',
  location: 'Victoria Park',
  notes: '',
  url: 'http://localhost:4420/events/2',
};

describe('formatShiftWhen', () => {
  it('formats in the event time zone', () => {
    expect(formatShiftWhen(info.startsAt, info.endsAt, info.timezone)).toBe(
      'Saturday, 6 June 2026, 10:00–14:00 (Europe/London)',
    );
  });
});

describe('templates', () => {
  it('builds text and html bodies', () => {
    const mail = templates.signupConfirmed('sam@example.org', info);
    expect(mail.subject).toBe("You're signed up: Harvest Festival");
    expect(mail.text).toContain('Harvest Festival: Info tent');
    expect(mail.text).toContain('Victoria Park');
    expect(mail.html).toContain('<strong>Harvest Festival: Info tent</strong>');
  });

  it('escapes names and notes in the html body', () => {
    const mail = templates.reminder('sam@example.org', {
      ...info,
      eventName: 'Fish & Chips <night>',
      notes: '<script>alert(1)</script>',
    });
    expect(mail.html).toContain('Fish &amp; Chips &lt;night&gt;');
    expect(mail.html).not.toContain('<script>');
  });

  it('mentions the waitlist position', () => {
    expect(templates.signupWaitlisted('sam@example.org', info, 3).text).toContain('number 3');
  });
});
