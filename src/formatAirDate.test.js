import { describe, expect, it } from 'vitest';

import { formatAirDate } from './formatAirDate';

describe('formatAirDate', () => {
  it('passes an unparseable date through unchanged', () => {
    expect(formatAirDate('soon')).toBe('soon');
    expect(formatAirDate('')).toBe('');
  });

  it('reads a bare date as the local calendar day', () => {
    expect(formatAirDate('2026-07-01')).toBe(new Date(2026, 6, 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
  });
});
