import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import HoursLog from './HoursLog.svelte';

const log = {
  volunteer: { id: 7, name: 'Sam Rivera' },
  entries: [
    {
      id: 1,
      userId: 7,
      signupId: 3,
      workedOn: '2026-06-06',
      hours: 3,
      description: 'Riverside Food Bank: Sorting',
      source: 'shift' as const,
      createdAt: '2026-06-06T12:00:00Z',
    },
    {
      id: 2,
      userId: 7,
      signupId: null,
      workedOn: '2025-12-20',
      hours: 4.5,
      description: 'Hamper packing',
      source: 'manual' as const,
      createdAt: '2025-12-21T12:00:00Z',
    },
  ],
  totals: [
    { year: 2026, hours: 3, entries: 1 },
    { year: 2025, hours: 4.5, entries: 1 },
  ],
};

describe('HoursLog', () => {
  it('explains how hours get logged when there are none', () => {
    render(HoursLog, { log: { ...log, entries: [], totals: [] } });
    expect(screen.getByText(/No hours logged yet/)).toBeInTheDocument();
  });

  it('shows a total and a certificate link per year', () => {
    render(HoursLog, { log });
    expect(screen.getByText('4.5 h', { selector: 'strong' })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Certificate (PDF)' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/api/volunteers/7/certificates/2026',
      '/api/volunteers/7/certificates/2025',
    ]);
  });

  it('marks entries added by a coordinator', () => {
    render(HoursLog, { log });
    expect(screen.getAllByText('added by coordinator')).toHaveLength(1);
  });
});
