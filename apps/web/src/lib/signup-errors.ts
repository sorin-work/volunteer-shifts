import { ApiError } from './api';

interface ConflictDetails {
  shifts?: { shiftId: number; eventName: string; startsAt: string; endsAt: string }[];
}

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** A friendly explanation of why a sign-up failed. */
export function describeSignupError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong, please try again.';
  switch (err.code) {
    case 'schedule_conflict': {
      const clash = (err.details as ConflictDetails | undefined)?.shifts?.[0];
      if (!clash) return err.message;
      return `This overlaps your ${clash.eventName} shift on ${timeFormat.format(new Date(clash.startsAt))}.`;
    }
    case 'birth_date_required':
      return 'This role has a minimum age. Add your date of birth in your profile first.';
    case 'too_young':
    case 'missing_skills':
    case 'already_signed_up':
    case 'shift_started':
    case 'event_cancelled':
      return err.message;
    case 'unauthorized':
      return 'Your session has expired, please sign in again.';
    default:
      return err.message || 'Something went wrong, please try again.';
  }
}
