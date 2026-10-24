import type { AppContext } from '../context.js';
import type { ShiftMailInfo } from './templates.js';

interface ShiftRow {
  event_id: number;
  starts_at: Date;
  ends_at: Date;
  notes: string;
  event_name: string;
  event_timezone: string;
  event_location: string;
  role_name: string;
  role_description?: string;
}

export function shiftMailInfo(
  ctx: AppContext,
  shift: ShiftRow,
  volunteer: { name: string },
): ShiftMailInfo {
  return {
    volunteerName: volunteer.name,
    eventName: shift.event_name,
    roleName: shift.role_name,
    roleDescription: shift.role_description ?? '',
    startsAt: shift.starts_at,
    endsAt: shift.ends_at,
    timezone: shift.event_timezone,
    location: shift.event_location,
    notes: shift.notes,
    url: new URL(`/events/${shift.event_id}`, ctx.config.APP_URL).toString(),
  };
}
