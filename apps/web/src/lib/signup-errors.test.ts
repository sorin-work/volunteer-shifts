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

  it('has a fallback for unexpected errors', () => {
    expect(describeSignupError(new Error('boom'))).toBe('Something went wrong, please try again.');
  });
});
