import { describe, expect, it } from 'vitest';
import { pageInfo, parsePage } from './pagination.js';

describe('parsePage', () => {
  it('defaults to the first page', () => {
    expect(parsePage({})).toEqual({ page: 1, pageSize: 20, offset: 0 });
  });

  it('computes the offset and clamps the size', () => {
    expect(parsePage({ page: '3', pageSize: '10' })).toEqual({ page: 3, pageSize: 10, offset: 20 });
    expect(parsePage({ pageSize: '1000' }).pageSize).toBe(100);
    expect(parsePage({ page: '-4' }).page).toBe(1);
    expect(parsePage({ page: 'abc' }).page).toBe(1);
  });
});

describe('pageInfo', () => {
  it('reports totals', () => {
    expect(pageInfo({ page: 1, pageSize: 10, offset: 0 }, 40)).toEqual({
      page: 1,
      pageSize: 10,
      total: 40,
      totalPages: 4,
    });
  });
});
