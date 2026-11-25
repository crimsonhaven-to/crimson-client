import { describe, expect, it } from 'vitest';

import {
  compareTitles,
  dedupeSavedTracks,
  formatAllTitlesSubtitle,
  formatTitleCount,
  splitPlaylistBadges,
} from './allTitles';

describe('formatTitleCount', () => {
  it('handles zero, singular, plural, and invalid counts', () => {
    expect(formatTitleCount(0)).toBe('0 titles');
    expect(formatTitleCount(1)).toBe('1 title');
    expect(formatTitleCount(42)).toBe('42 titles');
    expect(formatTitleCount(-3)).toBe('0 titles');
    expect(formatTitleCount(NaN)).toBe('0 titles');
  });
});

describe('formatAllTitlesSubtitle', () => {
  it('summarizes empty, ready counts, and playlist counts', () => {
    expect(formatAllTitlesSubtitle(0, 0, 0)).toBe('No titles yet');
    expect(formatAllTitlesSubtitle(10, 12, 0)).toBe('10 / 12 ready');
    expect(formatAllTitlesSubtitle(10, 12, 1)).toBe('10 / 12 ready · 1 playlist');
    expect(formatAllTitlesSubtitle(10, 12, 3)).toBe('10 / 12 ready · 3 playlists');
  });
});

describe('splitPlaylistBadges', () => {
  it('returns all playlists when within the visible limit', () => {
    const list = [{ id: 1, name: 'Focus' }, { id: 2, name: 'Driving' }];
    expect(splitPlaylistBadges(list)).toEqual({
      visible: list,
      overflowCount: 0,
      overflowTitle: '',
    });
    expect(splitPlaylistBadges(null)).toEqual({
      visible: [],
      overflowCount: 0,
      overflowTitle: '',
    });
  });

  it('caps visible pills and joins hidden names for the overflow tooltip', () => {
    const list = [
      { id: 1, name: 'Focus' },
      { id: 2, name: 'Driving' },
      { id: 3, name: 'Night' },
      { id: 4, name: 'Chill' },
    ];
    expect(splitPlaylistBadges(list, 2)).toEqual({
      visible: [{ id: 1, name: 'Focus' }, { id: 2, name: 'Driving' }],
      overflowCount: 2,
      overflowTitle: 'Night, Chill',
    });
  });
});

describe('compareTitles', () => {
  it('orders case-insensitively by title, then primary artist, then id', () => {
    const rows = [
      { id: 9, title: 'beta', artists: ['Zed'] },
      { id: 4, title: 'Alpha', artists: ['B'] },
      { id: 2, title: 'alpha', artists: ['a'] },
      { id: 1, title: 'alpha', artists: ['A'] },
    ];
    expect([...rows].sort(compareTitles).map((r) => r.id)).toEqual([1, 2, 4, 9]);
  });
});

describe('dedupeSavedTracks', () => {
  it('deduplicates shared tracks, merges playlist badges, and sorts stably', () => {
    const saved = {
      1: {
        playlist: { id: 1, name: 'Road Trip' },
        tracks: [
          { id: 20, title: 'Zebra', artists: ['Band B'], cover_url: 'https://art/20' },
          { id: 10, title: 'A Song', artists: ['Band A'], cover_url: null },
        ],
      },
      2: {
        playlist: { id: 2, name: 'Favorites' },
        tracks: [
          { id: 20, title: 'Zebra', artists: ['Band B'], cover_url: 'https://art/20' },
          { id: 30, title: 'Middle', artists: ['Band C'], cover_url: 'https://art/30' },
        ],
      },
    };
    const result = dedupeSavedTracks(saved, (t) => (t.cover_url ? `local:${t.id}` : null));
    expect(result.map((t) => t.id)).toEqual([10, 30, 20]);
    expect(result[2].playlists).toEqual([
      { id: 1, name: 'Road Trip' },
      { id: 2, name: 'Favorites' },
    ]);
    expect(result[2].cover_url).toBe('local:20');
    expect(result[0].cover_url).toBeNull();
  });
});
