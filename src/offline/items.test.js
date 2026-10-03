import { describe, expect, it } from 'vitest';

import { episodeTitle, episodesFrom, itemLabel } from './items';

describe('episodesFrom', () => {
  const list = [
    { episode_number: 3, air_date: '2020-01-03' },
    { episode_number: 1, air_date: '2020-01-01' },
    { episode_number: 2, air_date: '2020-01-02' },
    { episode_number: 4, air_date: '2999-01-01' },
    { episode_number: 5 },
  ];

  it('starts with the current episode, then the aired ones after it', () => {
    expect(episodesFrom(list, 2).map((e) => e.episode_number)).toEqual([2, 3, 5]);
  });

  it('keeps the current episode before the season list loads', () => {
    expect(episodesFrom([], 7)).toEqual([{ episode_number: 7 }]);
  });
});

describe('labels', () => {
  it('drops placeholder titles', () => {
    expect(episodeTitle({ episode_number: 2, title: 'Episode 2' })).toBeNull();
    expect(episodeTitle({ episode_number: 2, title: 'The Return' })).toBe('The Return');
  });

  it('names movies and episodes', () => {
    expect(itemLabel({ kind: 'movie', titleName: 'Film' })).toBe('Film');
    expect(itemLabel({ kind: 'episode', season: 1, episode: 4, episodeTitle: 'Rest' })).toBe('S1E4 · Rest');
  });
});
