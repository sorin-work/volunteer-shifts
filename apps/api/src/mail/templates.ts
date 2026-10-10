import { escapeHtml } from '../lib/html.js';
import type { MailMessage } from './mailer.js';

export interface ShiftMailInfo {
  volunteerName: string;
  eventName: string;
  roleName: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  location: string;
  notes: string;
  url: string;
}

/** "Saturday, 7 March 2026, 09:00–12:00 (Europe/London)" */
export function formatShiftWhen(startsAt: Date, endsAt: Date, timezone: string): string {
  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(startsAt);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  });
  return `${day}, ${time.format(startsAt)}–${time.format(endsAt)} (${timezone})`;
}

function render(
  to: string,
  subject: string,
  info: ShiftMailInfo,
  intro: string,
  outro: string,
): MailMessage {
  const when = formatShiftWhen(info.startsAt, info.endsAt, info.timezone);
  const lines = [
    `Hi ${info.volunteerName},`,
    '',
    intro,
    '',
    `${info.eventName}: ${info.roleName}`,
    when,
    ...(info.location ? [info.location] : []),
    ...(info.notes ? ['', `Notes: ${info.notes}`] : []),
    '',
    outro,
    info.url,
  ];
  const e = escapeHtml;
  const html = `<!doctype html>
<html><body style="font-family: system-ui, sans-serif; color: #1d2420; line-height: 1.5">
<p>Hi ${e(info.volunteerName)},</p>
<p>${e(intro)}</p>
<table style="border-left: 3px solid #1f7a5a; padding-left: 12px">
<tr><td><strong>${e(info.eventName)}: ${e(info.roleName)}</strong></td></tr>
<tr><td>${e(when)}</td></tr>
${info.location ? `<tr><td>${e(info.location)}</td></tr>` : ''}
${info.notes ? `<tr><td><em>${e(info.notes)}</em></td></tr>` : ''}
</table>
<p>${e(outro)} <a href="${e(info.url)}">${e(info.url)}</a></p>
</body></html>`;
  return { to, subject, text: lines.join('\n'), html };
}

export const templates = {
  signupConfirmed: (to: string, info: ShiftMailInfo) =>
    render(
      to,
      `You're signed up: ${info.eventName}`,
      info,
      'Thanks for signing up! Here are the details of your shift.',
      "Can't make it any more? Please cancel so someone else can take your spot:",
    ),

  signupWaitlisted: (to: string, info: ShiftMailInfo, position: number) =>
    render(
      to,
      `You're on the waitlist: ${info.eventName}`,
      info,
      `This shift is full, so you're number ${position} on the waitlist. We'll email you if a spot opens up.`,
      'See the shift or leave the waitlist:',
    ),

  promoted: (to: string, info: ShiftMailInfo) =>
    render(
      to,
      `A spot opened up: ${info.eventName}`,
      info,
      'Good news, a spot opened up and you have been moved from the waitlist onto the shift.',
      "If you can't make it, please cancel so the next person can go:",
    ),

  reminder: (to: string, info: ShiftMailInfo) =>
    render(
      to,
      `Reminder: ${info.eventName} tomorrow`,
      info,
      'A quick reminder about your upcoming shift.',
      'Shift details:',
    ),

  shiftMoved: (to: string, info: ShiftMailInfo) =>
    render(
      to,
      `New time for your shift: ${info.eventName}`,
      info,
      "The time of your shift has changed. Here are the new details. If you can't make it any more, please cancel.",
      'Shift details:',
    ),

  shiftRemoved: (to: string, info: ShiftMailInfo) =>
    render(
      to,
      `Shift cancelled: ${info.eventName}`,
      info,
      "The organisers have removed this shift, so you're no longer needed for it. Sorry for the change of plans!",
      'Other shifts at this event:',
    ),

  eventCancelled: (to: string, info: ShiftMailInfo) =>
    render(
      to,
      `Cancelled: ${info.eventName}`,
      info,
      'Unfortunately this event has been cancelled, so your shift will not go ahead.',
      'Other events you can help with:',
    ),
};
