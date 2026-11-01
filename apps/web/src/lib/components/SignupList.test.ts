import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { MySignup } from '$lib/types';
import SignupList from './SignupList.svelte';

function signup(overrides: Partial<MySignup> = {}): MySignup {
  const start = new Date(Date.now() + 3 * 86_400_000);
  const end = new Date(start.getTime() + 3 * 3_600_000);
  return {
    id: 1,
    shiftId: 10,
    userId: 2,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    cancelledAt: null,
    waitlistPosition: null,
    shift: {
      id: 10,
      eventId: 5,
      roleId: 3,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      date: start.toISOString().slice(0, 10),
      startTime: '09:00',
      endTime: '12:00',
      capacity: 4,
      notes: '',
    },
    event: {
      id: 5,
      name: 'Food bank',
      location: 'Mill Lane',
      timezone: 'UTC',
      status: 'published',
    },
    role: { id: 3, name: 'Sorting' },
    ...overrides,
  };
}

describe('SignupList', () => {
  it('links to the event and offers a calendar file for upcoming shifts', () => {
    render(SignupList, { signups: [signup()] });
    expect(screen.getByRole('link', { name: 'Food bank' })).toHaveAttribute('href', '/events/5');
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toHaveAttribute(
      'href',
      '/api/signups/1/calendar.ics',
    );
  });

  it('shows the place in line for waitlisted shifts', () => {
    render(SignupList, { signups: [signup({ status: 'waitlisted', waitlistPosition: 3 })] });
    expect(screen.getByText('#3 in line')).toBeInTheDocument();
    expect(screen.getByText('Waitlist')).toBeInTheDocument();
  });

  it('marks shifts happening today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const s = signup();
    render(SignupList, { signups: [{ ...s, shift: { ...s.shift, date: today } }] });
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
