import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Pager from './Pager.svelte';

describe('Pager', () => {
  it('is hidden when everything fits on one page', () => {
    render(Pager, { page: 1, totalPages: 1, onpage: () => {} });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('disables previous on the first page and moves forward', async () => {
    const onpage = vi.fn();
    render(Pager, { page: 1, totalPages: 3, onpage });
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onpage).toHaveBeenCalledWith(2);
  });

  it('disables next on the last page', () => {
    render(Pager, { page: 3, totalPages: 3, onpage: () => {} });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
