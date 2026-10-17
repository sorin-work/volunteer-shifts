import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { describeSignupError } from './signup-errors';

describe('describeSignupError', () => {
  it('names the clashing shift', () => {
    const err = new ApiError(409, 'schedule_conflict', 'You already have a shift at this time.', {
      shifts: [
        {
          shiftId: 3,
          eventName: 'Harvest Festival',
          startsAt: '2026-03-07T09:00:00Z',
          endsAt: '2026-03-07T12:00:00Z',
        },
      ],
    });
    expect(describeSignupError(err)).toMatch(/^This overlaps your Harvest Festival shift on /);
  });

  it('passes eligibility messages through', () => {
    const err = new ApiError(422, 'missing_skills', 'Forklift needs: Forklift licence.');
    expect(describeSignupError(err)).toBe('Forklift needs: Forklift licence.');
  });

  it('points to the profile when a birth date is missing', () => {
    const err = new ApiError(422, 'birth_date_required', 'x');
    expect(describeSignupError(err)).toMatch(/date of birth/);
  });

  it('falls back to the api message when a clash has no details', () => {
    const err = new ApiError(409, 'schedule_conflict', 'You already have a shift at this time.');
    expect(describeSignupError(err)).toBe('You already have a shift at this time.');
  });

  it('asks people to sign in again when the session expired', () => {
    expect(describeSignupError(new ApiError(401, 'unauthorized', 'x'))).toMatch(/sign in again/);
  });

  it.each(['too_young', 'already_signed_up', 'shift_started', 'event_cancelled'])(
    'shows the api message for %s',
    (code) => {
      expect(describeSignupError(new ApiError(409, code, `message for ${code}`))).toBe(
        `message for ${code}`,
      );
    },
  );

  it('has a fallback for unexpected errors', () => {
    expect(describeSignupError(new Error('boom'))).toBe('Something went wrong, please try again.');
  });
});
