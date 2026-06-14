import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import EventDescription from './EventDescription.svelte';

describe('EventDescription', () => {
  it('renders links and line breaks', () => {
    const { container } = render(EventDescription, {
      text: 'Map:\nhttps://example.org/map',
    });
    expect(container.querySelector('br')).not.toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.org/map');
  });

  it('does not render html from the description', () => {
    const { container } = render(EventDescription, {
      text: '<img src=x onerror="alert(1)"><script>alert(2)</script>',
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
  });
});
