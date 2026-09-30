import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { bucketOf, timeAgo, isFutureDate, airDateLabel } from './historyDates';

// Buckets are calendar days in the viewer's zone, so every instant here is built in local time.
const now = new Date(2026, 5, 10, 12, 0);
const daysAgo = (n, hour = 12) => new Date(2026, 5, 10 - n, hour, 0).toISOString();

describe('history dates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  describe('bucketOf', () => {
    it('buckets by calendar day, not by elapsed hours', () => {
      expect(bucketOf(daysAgo(0, 0))).toBe('Today');
      expect(bucketOf(daysAgo(1, 23))).toBe('Yesterday');
    });

    it('widens to week, month and earlier', () => {
      expect(bucketOf(daysAgo(6))).toBe('This Week');
      expect(bucketOf(daysAgo(7))).toBe('This Month');
      expect(bucketOf(daysAgo(29))).toBe('This Month');
      expect(bucketOf(daysAgo(30))).toBe('Earlier');
    });

    it('files missing or broken timestamps under Earlier', () => {
      expect(bucketOf(null)).toBe('Earlier');
      expect(bucketOf('not a date')).toBe('Earlier');
    });
  });

  describe('timeAgo', () => {
    it('counts up through minutes, hours, days and weeks', () => {
      expect(timeAgo(new Date(now.getTime() - 30 * 1000).toISOString())).toBe('just now');
      expect(timeAgo(new Date(now.getTime() - 5 * 60 * 1000).toISOString())).toBe('5m ago');
      expect(timeAgo(new Date(now.getTime() - 3 * 3600 * 1000).toISOString())).toBe('3h ago');
      expect(timeAgo(daysAgo(2))).toBe('2d ago');
      expect(timeAgo(daysAgo(14))).toBe('2w ago');
    });

    it('is empty for missing or broken timestamps', () => {
      expect(timeAgo(null)).toBe('');
      expect(timeAgo('not a date')).toBe('');
    });
  });

  describe('isFutureDate', () => {
    it('treats today as already aired', () => {
      expect(isFutureDate('2026-06-10')).toBe(false);
      expect(isFutureDate('2026-06-11')).toBe(true);
      expect(isFutureDate(null)).toBe(false);
    });
  });

  describe('airDateLabel', () => {
    it('passes an unparseable date through unchanged', () => {
      expect(airDateLabel('soon')).toBe('soon');
      expect(airDateLabel('')).toBe('');
    });
  });
});
