import { describe, it, expect } from 'vitest';
import { pickSeason, overviewSeasonUrl } from './seasonParam';

const overlord = [
  { season_number: 1, anilist_id: 20832 },
  { season_number: 2, anilist_id: 98437 },
  { season_number: 3, anilist_id: 101474 },
];

describe('pickSeason', () => {
  it('prefers the season named in the URL', () => {
    expect(pickSeason(overlord, 2, 101474)).toBe(2);
  });

  it('falls back to the season the AniList id belongs to', () => {
    expect(pickSeason(overlord, null, 101474)).toBe(3);
  });

  it('ignores a requested season that does not exist', () => {
    expect(pickSeason(overlord, 9, 98437)).toBe(2);
    expect(pickSeason(overlord, 9)).toBe(1);
  });

  it('opens the first season by default, and nothing without seasons', () => {
    expect(pickSeason(overlord, null, 1)).toBe(1);
    expect(pickSeason([], 2)).toBe(null);
    expect(pickSeason(undefined, null)).toBe(null);
  });

  it('keeps a specials season numbered 0', () => {
    expect(pickSeason([{ season_number: 0 }, { season_number: 1 }], 0)).toBe(0);
  });
});

describe('overviewSeasonUrl', () => {
  it('appends the season only when there is one', () => {
    expect(overviewSeasonUrl('/anime/5', 3)).toBe('/anime/5?season=3');
    expect(overviewSeasonUrl('/anime/5', 0)).toBe('/anime/5?season=0');
    expect(overviewSeasonUrl('/anime/5', '2')).toBe('/anime/5?season=2');
    expect(overviewSeasonUrl('/anime/5', null)).toBe('/anime/5');
    expect(overviewSeasonUrl('/anime/5', NaN)).toBe('/anime/5');
  });
});
