import { beforeEach, describe, expect, it } from 'vitest';

import { planPreload, preloadCount, setPreloadCount } from './preload';

const track = (id) => ({ id, stream_url: `https://api/music_stream/${id}` });

describe('planPreload', () => {
  it('fetches the upcoming songs the device does not have yet', () => {
    const plan = planPreload(1, [track(2), track(3), track(4)], new Set([2]), new Set([4]));
    expect(plan.fetch.map((t) => t.id)).toEqual([3]);
  });

  it('drops preloads that fell out of the window but keeps the current song', () => {
    const plan = planPreload(5, [track(6)], new Set([3, 4, 5, 6]), new Set());
    expect(plan.drop).toEqual([3, 4]);
    expect(plan.fetch).toEqual([]);
  });
});

describe('preloadCount', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to three and remembers a choice', () => {
    expect(preloadCount()).toBe(3);
    setPreloadCount(10);
    expect(preloadCount()).toBe(10);
    setPreloadCount(0);
    expect(preloadCount()).toBe(0);
  });

  it('ignores a value that is not one of the choices', () => {
    localStorage.setItem('crimson:music-preload', '7');
    expect(preloadCount()).toBe(3);
  });
});
