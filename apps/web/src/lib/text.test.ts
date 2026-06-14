import { describe, expect, it } from 'vitest';
import { formatDescription } from './text';

describe('formatDescription', () => {
  it('keeps line breaks', () => {
    expect(formatDescription('Bring gloves.\nParking at the back.')).toBe(
      'Bring gloves.<br />Parking at the back.',
    );
  });

  it('turns web addresses into links', () => {
    expect(formatDescription('Map: https://example.org/map.')).toBe(
      'Map: <a href="https://example.org/map" target="_blank" rel="noopener noreferrer">https://example.org/map</a>.',
    );
  });

  it('escapes html so descriptions cannot inject markup', () => {
    expect(formatDescription('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
    expect(formatDescription('Tea & biscuits')).toBe('Tea &amp; biscuits');
  });

  it('keeps quotes in links inside the attribute', () => {
    const html = formatDescription('https://example.org/"onmouseover="alert(1)');
    expect(html).not.toContain('"onmouseover="');
  });

  it('leaves plain text alone', () => {
    expect(formatDescription('Sorting tins and dry goods')).toBe('Sorting tins and dry goods');
  });
});
