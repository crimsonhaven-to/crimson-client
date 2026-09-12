import { describe, it, expect } from 'vitest';

import { groupByLocalDay, dayLabel, hasAired } from './airingFormat';

// Every airing here is given as a UTC instant, and every assertion is about what
// the viewer's own calendar makes of it. That is the whole point of grouping on
// the client: the backend cannot know which day an instant falls on for you.

const at = (iso) => ({ airing_at: iso, anilist_id: 21, episode: 1 });

describe('groupByLocalDay', () => {
  it('puts airings on the same local day in one group', () => {
    const noon = new Date(2026, 5, 1, 12, 0).toISOString();
    const evening = new Date(2026, 5, 1, 22, 0).toISOString();
    const groups = groupByLocalDay([at(noon), at(evening)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  it('splits airings that fall on different local days', () => {
    const late = new Date(2026, 5, 1, 23, 30).toISOString();
    const early = new Date(2026, 5, 2, 0, 30).toISOString();
    const groups = groupByLocalDay([at(late), at(early)]);
    expect(groups).toHaveLength(2);
  });

  it('keeps the order the backend returned', () => {
    const groups = groupByLocalDay([
      { ...at(new Date(2026, 5, 1, 9).toISOString()), episode: 1 },
      { ...at(new Date(2026, 5, 2, 9).toISOString()), episode: 2 },
      { ...at(new Date(2026, 5, 3, 9).toISOString()), episode: 3 },
    ]);
    expect(groups.map((g) => g.items[0].episode)).toEqual([1, 2, 3]);
  });

  it('drops a row with an unparseable timestamp instead of making a bad group', () => {
    const groups = groupByLocalDay([at('not a date'), at(new Date(2026, 5, 1, 9).toISOString())]);
    expect(groups).toHaveLength(1);
  });

  it('returns nothing for an empty schedule', () => {
    expect(groupByLocalDay([])).toEqual([]);
  });

  it('gives each group a date at the start of its local day', () => {
    const [group] = groupByLocalDay([at(new Date(2026, 5, 1, 17, 45).toISOString())]);
    expect(group.date.getHours()).toBe(0);
    expect(group.date.getDate()).toBe(1);
  });
});

describe('dayLabel', () => {
  const now = new Date(2026, 5, 10, 12, 0);

  it('names today, tomorrow and yesterday rather than a weekday', () => {
    expect(dayLabel(new Date(2026, 5, 10, 23, 0), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 5, 11, 1, 0), now)).toBe('Tomorrow');
    expect(dayLabel(new Date(2026, 5, 9, 23, 0), now)).toBe('Yesterday');
  });

  it('falls back to a weekday further out', () => {
    expect(['Today', 'Tomorrow', 'Yesterday']).not.toContain(dayLabel(new Date(2026, 5, 14), now));
  });

  it('compares calendar days, not elapsed hours', () => {
    // Two hours apart, but either side of midnight: still different days.
    expect(dayLabel(new Date(2026, 5, 11, 1, 0), new Date(2026, 5, 10, 23, 0))).toBe('Tomorrow');
  });
});

describe('hasAired', () => {
  it('is true for a past airing and false for a future one', () => {
    const now = Date.UTC(2026, 5, 10, 12, 0);
    expect(hasAired('2026-06-10T11:00:00Z', now)).toBe(true);
    expect(hasAired('2026-06-10T13:00:00Z', now)).toBe(false);
  });

  it('counts the exact airing moment as aired', () => {
    const now = Date.UTC(2026, 5, 10, 12, 0);
    expect(hasAired('2026-06-10T12:00:00Z', now)).toBe(true);
  });
});
