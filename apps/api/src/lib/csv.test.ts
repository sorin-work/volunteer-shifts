import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv.js';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+44 7700 900123')).toBe("'+44 7700 900123");
  });

  it('renders empty values', () => {
    expect(toCsv(['a', 'b'], [[null, 1]])).toBe('a,b\r\n,1\r\n');
  });
});
