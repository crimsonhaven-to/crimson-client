import { describe, it, expect } from 'vitest';

import { kindOf, itemKey, overviewHref } from './watchlistItem';

const anime = { anilist_id: 21, media_type: 'tv' };
const manga = { anilist_id: 30013, media_type: 'manga' };
const movie = { tmdb_id: 550, media_type: 'movie' };
const show = { tmdb_id: 1399, media_type: 'tv' };

describe('kindOf', () => {
  it('treats manga as manga even though it carries an AniList id', () => {
    expect(kindOf(manga)).toBe('manga');
  });

  it('classifies the other kinds', () => {
    expect(kindOf(anime)).toBe('anime');
    expect(kindOf(movie)).toBe('movie');
    expect(kindOf(show)).toBe('show');
  });
});

describe('itemKey', () => {
  it('namespaces each kind so equal ids never collide', () => {
    expect(itemKey(manga)).toBe('g:30013');
    expect(itemKey(anime)).toBe('a:21');
    expect(itemKey(movie)).toBe('m:550');
    expect(itemKey(show)).toBe('t:1399');
    expect(itemKey({ tmdb_id: 7, media_type: 'movie' })).not.toBe(itemKey({ tmdb_id: 7, media_type: 'tv' }));
  });
});

describe('overviewHref', () => {
  it('routes each kind to its overview page', () => {
    expect(overviewHref(manga)).toBe('/manga/30013');
    expect(overviewHref(anime)).toBe('/anime/21');
    expect(overviewHref(movie)).toBe('/movie/550');
    expect(overviewHref(show)).toBe('/show/1399');
  });
});
