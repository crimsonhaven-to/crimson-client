import { describe, expect, it } from 'vitest';

import { isDownloaded, planDownloads, savedPlaylist } from './downloads';

const track = (id, extra = {}) => ({ id, status: 'ready', stream_url: `https://api/s/${id}`, ...extra });

describe('planDownloads', () => {
  it('fetches each missing song once, however many playlists hold it', () => {
    const saved = {
      1: { playlist: { id: 1 }, tracks: [track(10), track(11)] },
      2: { playlist: { id: 2 }, tracks: [track(11), track(12)] },
    };
    const plan = planDownloads(saved, new Set([10]));
    expect(plan.fetch.map((t) => t.id)).toEqual([11, 12]);
    expect(plan.drop).toEqual([]);
  });

  it('drops stored songs no downloaded playlist holds any more', () => {
    const saved = { 1: { playlist: { id: 1 }, tracks: [track(10)] } };
    expect(planDownloads(saved, new Set([10, 11, 12])).drop).toEqual([11, 12]);
    expect(planDownloads({}, new Set([10])).drop).toEqual([10]);
  });
});

describe('savedPlaylist', () => {
  const s = {
    saved: {
      7: {
        playlist: { id: 7, name: 'Road trip' },
        tracks: [track(1, { cover_url: 'https://api/music_art/1' }), track(2, { cover_url: null })],
      },
    },
  };

  it('points covers at the device copy and keeps songs without one bare', () => {
    const { playlist, tracks } = savedPlaylist(7, s);
    expect(playlist.name).toBe('Road trip');
    expect(playlist.cover_url).toBe('/music-offline/cover/1');
    expect(tracks[0].cover_url).toBe('/music-offline/cover/1');
    expect(tracks[1].cover_url).toBeNull();
  });

  it('knows which playlists are downloaded, by id of either type', () => {
    expect(isDownloaded(7, s)).toBe(true);
    expect(isDownloaded('7', s)).toBe(true);
    expect(isDownloaded(8, s)).toBe(false);
    expect(savedPlaylist(8, s)).toBeNull();
  });
});
