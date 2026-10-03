import { describe, expect, it } from 'vitest';

import { nextKept, nextQueued, titlesOf } from './store';

const entry = (id, patch) => ({ id, titleKey: 't', titleName: 'Show', kind: 'episode', season: 1, status: 'done', addedAt: 0, ...patch });

describe('titlesOf', () => {
  it('groups by title, newest first, episodes in order', () => {
    const titles = titlesOf({
      a: entry('a', { episode: 2, addedAt: 1 }),
      b: entry('b', { episode: 1, addedAt: 2 }),
      m: entry('m', { titleKey: 'movie', titleName: 'Film', kind: 'movie', addedAt: 3 }),
    });
    expect(titles.map((t) => t.key)).toEqual(['movie', 't']);
    expect(titles[1].entries.map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('nextQueued', () => {
  it('takes the oldest queued download', () => {
    expect(nextQueued({
      a: entry('a', { status: 'queued', addedAt: 5 }),
      b: entry('b', { status: 'queued', addedAt: 4 }),
      c: entry('c', { status: 'failed', addedAt: 1 }),
    }).id).toBe('b');
    expect(nextQueued({})).toBeNull();
  });
});

describe('nextKept', () => {
  it('finds the next kept episode of the same title, across seasons', () => {
    const entries = {
      a: entry('a', { episode: 1 }),
      b: entry('b', { episode: 2, status: 'downloading' }),
      c: entry('c', { season: 2, episode: 1 }),
      d: entry('d', { titleKey: 'other', episode: 2 }),
    };
    expect(nextKept(entries, 'a').id).toBe('c');
    expect(nextKept(entries, 'c')).toBeNull();
  });
});
