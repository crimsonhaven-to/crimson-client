import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { resumeInfo } from './historyResume';

const anime = (over = {}) => ({
  media_type: 'tv', anilist_id: 21, season_number: 1, episode_number: 4,
  status: 'in_progress', position_seconds: 600, duration_seconds: 1200, ...over,
});

describe('resumeInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('resumes an unfinished episode where it was left', () => {
    const r = resumeInfo(anime());
    expect(r).toMatchObject({ mode: 'resume', ep: 4, href: '/watch/21/1/4', percent: 50 });
  });

  it('advances a finished episode into the next aired one', () => {
    const r = resumeInfo(anime({ status: 'completed', next_episode_exists: true, next_episode_air_date: '2026-06-01' }));
    expect(r).toMatchObject({ mode: 'next', ep: 5, href: '/watch/21/1/5', actionLabel: 'Next Episode (E5)' });
  });

  it('holds on the finished episode when the next one has not aired', () => {
    const r = resumeInfo(anime({ status: 'completed', next_episode_exists: true, next_episode_air_date: '2026-06-20' }));
    expect(r).toMatchObject({ mode: 'upcoming', ep: 4, nextAirDate: '2026-06-20' });
  });

  it('offers a rewatch after the finale', () => {
    const r = resumeInfo(anime({ status: 'completed', episode_number: 12, season_episode_count: 12 }));
    expect(r).toMatchObject({ mode: 'rewatch', ep: 12 });
  });

  it('routes TMDB shows to the show player', () => {
    const r = resumeInfo(anime({ anilist_id: null, tmdb_id: 1399, season_number: 2 }));
    expect(r.href).toBe('/watch-show/1399/2/4');
  });

  it('routes movies, manga and local titles to their own pages', () => {
    expect(resumeInfo({ media_type: 'movie', tmdb_id: 550 }).href).toBe('/watch-movie/550');
    expect(resumeInfo({ media_type: 'manga', anilist_id: 30013 }).href).toBe('/read/30013');
    expect(resumeInfo({ media_type: 'local', local_id: 'abc' }).href).toBe('/local/abc');
  });

  it('caps progress at 100 percent', () => {
    expect(resumeInfo(anime({ position_seconds: 5000 })).percent).toBe(100);
  });
});
