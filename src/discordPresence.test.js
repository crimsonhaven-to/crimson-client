import { describe, expect, it, vi } from 'vitest';

vi.mock('./hooks/playbackPrefs', () => ({ getPlaybackPrefs: () => ({ discordPresence: false }) }));

const { buildActivity, musicScene, sameMusic } = await import('./discordPresence');

const track = { id: 4, title: 'Song', artists: ['A', 'B'], album: 'Record', duration_ms: 200_000, cover_url: 'https://cdn/c.jpg' };
const player = (patch = {}) => ({ tracks: [track], order: [0], position: 0, playing: true, currentTime: 30, duration: 200, ...patch });

describe('musicScene', () => {
  it('is null while nothing plays', () => {
    expect(musicScene(player({ playing: false }))).toBeNull();
    expect(musicScene(player({ position: -1 }))).toBeNull();
  });

  it('dates the song back to when it would have started', () => {
    const scene = musicScene(player(), 100_000);
    expect(scene.startedAt).toBe(70_000);
    expect(scene.artists).toBe('A, B');
  });
});

describe('sameMusic', () => {
  it('ignores clock drift but not a seek or a new song', () => {
    const a = musicScene(player(), 100_000);
    expect(sameMusic(a, musicScene(player({ currentTime: 30.25 }), 100_250))).toBe(true);
    expect(sameMusic(a, musicScene(player({ currentTime: 120 }), 100_250))).toBe(false);
    expect(sameMusic(a, null)).toBe(false);
    expect(sameMusic(null, null)).toBe(true);
  });
});

describe('buildActivity', () => {
  it('shows a song as listening, with a progress bar and its cover', () => {
    const activity = buildActivity(musicScene(player(), 100_000));
    expect(activity.type).toBe(2);
    expect(activity.details).toBe('Song');
    expect(activity.state).toBe('by A, B');
    expect(activity.timestamps).toEqual({ start: 70_000, end: 270_000 });
    expect(activity.assets.large_image).toBe('https://cdn/c.jpg');
  });

  it('keeps the uploaded art when the cover is not a public link', () => {
    const scene = musicScene(player({ tracks: [{ ...track, cover_url: 'blob:x' }] }), 0);
    expect(buildActivity(scene).assets.large_image).toBe('crimson');
  });

  it('still describes browsing and watching', () => {
    expect(buildActivity(null).details).toBe('Browsing the archives…');
    expect(buildActivity({ kind: 'watch', title: 'Show', episode: 2 }).type).toBe(3);
  });
});
