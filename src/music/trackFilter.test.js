import { describe, expect, it } from 'vitest';

import { filterTracks, genreCounts, matchesQuery } from './trackFilter';

const TRACKS = [
  { id: 1, title: 'Plastic Love', artists: ['Mariya Takeuchi'], album: 'Variety', genres: ['city pop', 'j-pop'] },
  { id: 2, title: 'One More Time', artists: ['Daft Punk'], album: 'Discovery', genres: ['french house'] },
  { id: 3, title: 'Untagged', artists: ['Someone'], album: '' },
];

describe('matchesQuery', () => {
  it('matches title, artist, album and genre, ignoring case', () => {
    expect(matchesQuery(TRACKS[0], 'plastic')).toBe(true);
    expect(matchesQuery(TRACKS[0], 'TAKEUCHI')).toBe(true);
    expect(matchesQuery(TRACKS[1], 'discovery')).toBe(true);
    expect(matchesQuery(TRACKS[1], 'house')).toBe(true);
    expect(matchesQuery(TRACKS[1], 'jazz')).toBe(false);
  });

  it('needs every word, wherever each one appears', () => {
    expect(matchesQuery(TRACKS[1], 'daft house')).toBe(true);
    expect(matchesQuery(TRACKS[1], 'daft pop')).toBe(false);
  });

  it('lets everything through on an empty query and copes with no genres', () => {
    expect(matchesQuery(TRACKS[2], '  ')).toBe(true);
    expect(matchesQuery(TRACKS[2], 'someone')).toBe(true);
  });
});

describe('filterTracks', () => {
  it('narrows by exact genre and query together', () => {
    expect(filterTracks(TRACKS, { genre: 'j-pop' }).map((t) => t.id)).toEqual([1]);
    expect(filterTracks(TRACKS, { genre: 'j-pop', query: 'daft' })).toEqual([]);
    expect(filterTracks(TRACKS, { genre: 'pop' })).toEqual([]);
    expect(filterTracks(TRACKS).length).toBe(3);
  });
});

describe('genreCounts', () => {
  it('counts each genre and orders by count, then name', () => {
    const tracks = [...TRACKS, { id: 4, title: 'x', artists: [], genres: ['j-pop'] }];
    expect(genreCounts(tracks)).toEqual([
      { name: 'j-pop', count: 2 },
      { name: 'city pop', count: 1 },
      { name: 'french house', count: 1 },
    ]);
  });
});
