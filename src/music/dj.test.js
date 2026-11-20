import { describe, expect, it, vi } from 'vitest';

vi.mock('./player', () => ({
  appendTracks: vi.fn(), currentTrack: vi.fn(), getState: vi.fn(), playTracks: vi.fn(), subscribe: vi.fn(),
}));

const { needsNextSet, setFor } = await import('./dj');

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
