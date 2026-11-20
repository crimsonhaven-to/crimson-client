import { describe, expect, it, vi } from 'vitest';

vi.mock('./player', () => ({
  appendTracks: vi.fn(), currentTrack: vi.fn(), getState: vi.fn(), playTracks: vi.fn(), subscribe: vi.fn(),
}));

vi.mock('./djVoice', () => ({ hush: vi.fn(), isSpeaking: vi.fn(() => true), speak: vi.fn() }));
vi.mock('../api/client', () => ({
  apiFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({ theme: 'Night drive', intro: 'Listen, mortal.', voice: 'WAV', tracks: [{ id: 1 }] }),
  })),
  extractError: vi.fn(),
}));

const player = await import('./player');
const djVoice = await import('./djVoice');
const { needsNextSet, setFor, startDj, stopDj } = await import('./dj');
const onPlayerChange = player.subscribe.mock.calls[0][0];

describe('setFor', () => {
  const sets = [{ theme: 'a', firstIndex: 0 }, { theme: 'b', firstIndex: 5 }];

  it('finds the set a song belongs to', () => {
    expect(setFor(sets, 0).theme).toBe('a');
    expect(setFor(sets, 4).theme).toBe('a');
    expect(setFor(sets, 5).theme).toBe('b');
    expect(setFor(sets, 9).theme).toBe('b');
  });

  it('is null before any set', () => {
    expect(setFor([], 0)).toBeNull();
  });
});

describe('needsNextSet', () => {
  it('asks for more two songs before the queue runs out', () => {
    expect(needsNextSet({ position: 2, order: [0, 1, 2, 3, 4, 5] })).toBe(false);
    expect(needsNextSet({ position: 4, order: [0, 1, 2, 3, 4, 5] })).toBe(true);
    expect(needsNextSet({ position: 5, order: [0, 1, 2, 3, 4, 5] })).toBe(true);
  });

  it('waits while nothing plays', () => {
    expect(needsNextSet({ position: -1, order: [] })).toBe(false);
  });
});

describe('the spoken intro', () => {
  const at = (position, playing = true) => {
    player.getState.mockReturnValue({ source: { dj: true }, playing, position, order: [0, 1, 2], tracks: [] });
    onPlayerChange();
  };

  it('plays once, when the first song of the set is playing', async () => {
    djVoice.speak.mockClear();
    await startDj();
    at(0, false);
    expect(djVoice.speak).not.toHaveBeenCalled();
    at(0);
    at(0);
    at(1);
    expect(djVoice.speak).toHaveBeenCalledTimes(1);
    expect(djVoice.speak).toHaveBeenCalledWith('WAV');
    stopDj();
  });

  it('stops when the music is paused or the DJ ends', async () => {
    await startDj();
    djVoice.hush.mockClear();
    at(0);
    at(0, false);
    expect(djVoice.hush).toHaveBeenCalledTimes(1);
    stopDj();
    expect(djVoice.hush).toHaveBeenCalledTimes(2);
  });
});
