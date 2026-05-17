import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
  it('labels signup and event states', () => {
    render(StatusBadge, { status: 'waitlisted' });
    expect(screen.getByText('Waitlist')).toHaveClass('badge', 'warning');
  });

  it('greys out cancelled items', () => {
    render(StatusBadge, { status: 'cancelled' });
    expect(screen.getByText('Cancelled')).toHaveClass('muted');
  });
});
