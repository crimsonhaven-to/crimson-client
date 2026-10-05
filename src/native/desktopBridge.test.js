import { describe, expect, it } from 'vitest';

import { activityOf, newlySaved } from './desktopBridge';

const videos = (entries) => ({ entries });

describe('activityOf', () => {
  it('counts music, a running video download, or a playlist download', () => {
    expect(activityOf({ playing: true }, videos({}), { progress: null })).toEqual({ playing: true, downloading: false });
    expect(activityOf({ playing: false }, videos({ a: { status: 'queued' } }), { progress: null }).downloading).toBe(true);
    expect(activityOf({ playing: false }, videos({ a: { status: 'done' }, b: { status: 'failed' } }), { progress: null }).downloading).toBe(false);
    expect(activityOf({ playing: false }, videos({}), { progress: { done: 1, total: 3 } }).downloading).toBe(true);
  });
});

describe('newlySaved', () => {
  it('reports only entries that just finished', () => {
    const before = { a: { id: 'a', status: 'downloading' }, b: { id: 'b', status: 'done' } };
    const after = { a: { id: 'a', status: 'done' }, b: { id: 'b', status: 'done' }, c: { id: 'c', status: 'done' } };
    expect(newlySaved(before, after).map((e) => e.id)).toEqual(['a']);
  });
});
