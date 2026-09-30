import { describe, it, expect } from 'vitest';

import { streamFromMsg, mergeStreamLine, pickBestIdx } from './streamMerge';

// `url` encodes the origin so a local-over-backend swap is observable.
const msg = (source, language, origin = 'backend', extra = {}) => ({
  type: 'stream',
  source,
  streamType: 'hls',
  url: `https://cdn/${source}/${language || 'x'}/${origin}`,
  language,
  ...extra,
});

function run(lines, enabled) {
  const dedup = new Map();
  let streams = [];
  const events = [];
  for (const [m, origin] of lines) {
    const r = mergeStreamLine({ streams, dedup }, m, origin, { enabled });
    streams = r.streams;
    events.push({ changed: r.changed, appended: r.appended });
  }
  return { streams, events };
}

describe('streamFromMsg', () => {
  it('renames streamType -> type and carries the optional fields', () => {
    expect(streamFromMsg({
      source: 'VOE', streamType: 'hls', url: 'u',
      language: 'German Dub', subtitles: [{ lang: 'en' }], cacheTicket: 'tkt',
    })).toEqual({
      source: 'VOE', type: 'hls', url: 'u',
      language: 'German Dub', subtitles: [{ lang: 'en' }], cacheTicket: 'tkt',
    });
  });

  it('leaves optional fields undefined when the scraper omits them', () => {
    const tile = streamFromMsg({ source: 'VOE', streamType: 'mp4', url: 'u' });
    expect(tile).toEqual({
      source: 'VOE', type: 'mp4', url: 'u',
      language: undefined, subtitles: undefined, cacheTicket: undefined,
    });
  });
});

describe('mergeStreamLine: engine OFF (default behaviour)', () => {
  it('appends every line without dedup, even exact duplicates', () => {
    const { streams, events } = run([
      [msg('VOE', 'German Dub'), 'backend'],
      [msg('VOE', 'German Dub'), 'backend'],
    ], false);
    expect(streams).toHaveLength(2);
    expect(events).toEqual([
      { changed: true, appended: true },
      { changed: true, appended: true },
    ]);
  });

  it('ignores origin entirely when off (a local line just appends)', () => {
    const { streams } = run([
      [msg('VOE', 'German Dub', 'backend'), 'backend'],
      [msg('VOE', 'German Dub', 'local'), 'local'],
    ], false);
    expect(streams).toHaveLength(2);
    expect(streams[0].url).toContain('/backend');
    expect(streams[1].url).toContain('/local');
  });
});

describe('mergeStreamLine: engine ON, prefer-local dedup', () => {
  it('drops a same-origin duplicate (backend then backend)', () => {
    const { streams, events } = run([
      [msg('VOE', 'German Dub', 'backend'), 'backend'],
      [msg('VOE', 'German Dub', 'backend'), 'backend'],
    ], true);
    expect(streams).toHaveLength(1);
    expect(events[1]).toEqual({ changed: false, appended: false });
    expect(streams[0].url).toContain('/backend');
  });

  it('lets a local line REPLACE an earlier backend one, in place', () => {
    const { streams, events } = run([
      [msg('VOE', 'German Dub', 'backend'), 'backend'],
      [msg('VOE', 'German Dub', 'local'), 'local'],
    ], true);
    expect(streams).toHaveLength(1);
    // A swap is not a new tile: loading was already cleared.
    expect(events[1]).toEqual({ changed: true, appended: false });
    expect(streams[0].url).toContain('/local');
  });

  it('a backend line NEVER displaces a local one (local arrived first)', () => {
    const { streams, events } = run([
      [msg('VOE', 'German Dub', 'local'), 'local'],
      [msg('VOE', 'German Dub', 'backend'), 'backend'],
    ], true);
    expect(streams).toHaveLength(1);
    expect(events[1]).toEqual({ changed: false, appended: false });
    expect(streams[0].url).toContain('/local');
  });

  it('drops a same-origin local duplicate too', () => {
    const { streams, events } = run([
      [msg('VOE', 'German Dub', 'local'), 'local'],
      [msg('VOE', 'German Dub', 'local'), 'local'],
    ], true);
    expect(streams).toHaveLength(1);
    expect(events[1]).toEqual({ changed: false, appended: false });
  });

  it('keeps distinct dub/sub variants of the same provider separate', () => {
    const { streams } = run([
      [msg('VOE', 'German Dub', 'backend'), 'backend'],
      [msg('VOE', 'English Sub', 'backend'), 'backend'],
    ], true);
    expect(streams).toHaveLength(2);
    expect(streams.map((s) => s.language)).toEqual(['German Dub', 'English Sub']);
  });

  it('treats a missing language as its own dedup bucket (source|"")', () => {
    const { streams, events } = run([
      [msg('VOE', undefined, 'backend'), 'backend'],
      [msg('VOE', undefined, 'backend'), 'backend'],
      [msg('VOE', undefined, 'local'), 'local'],
    ], true);
    expect(streams).toHaveLength(1);
    expect(events[1]).toEqual({ changed: false, appended: false });
    expect(events[2]).toEqual({ changed: true, appended: false });
    expect(streams[0].url).toContain('/local');
  });

  it('preserves the original slot/order when a later local line swaps in', () => {
    const { streams } = run([
      [msg('VOE', 'Sub', 'backend'), 'backend'],
      [msg('Doodstream', 'Sub', 'backend'), 'backend'],
      [msg('VOE', 'Sub', 'local'), 'local'],
    ], true);
    expect(streams.map((s) => s.source)).toEqual(['VOE', 'Doodstream']);
    expect(streams[0].url).toContain('/local');
    expect(streams[1].url).toContain('/backend');
  });
});

describe('pickBestIdx', () => {
  it('returns 0 (arrival order) when no preference is set', () => {
    const streams = [{ source: 'A', language: 'English Sub' }, { source: 'B', language: 'German Dub' }];
    expect(pickBestIdx(streams, null)).toBe(0);
  });

  it('selects the best language match, lower mismatch winning', () => {
    const prefs = { language: 'German', type: 'Dub' };
    const streams = [
      { source: 'A', language: 'English Sub' }, // miss 2
      { source: 'B', language: 'German Sub' },  // miss 1
      { source: 'C', language: 'German Dub' },  // miss 0 -> winner
    ];
    expect(pickBestIdx(streams, prefs)).toBe(2);
  });

  it('breaks ties by arrival order (first equally-good source wins)', () => {
    const prefs = { language: 'German' };
    const streams = [
      { source: 'A', language: 'English Sub' }, // miss 1
      { source: 'B', language: 'German Dub' },  // miss 0
      { source: 'C', language: 'German Sub' },  // miss 0 (ties B, but later)
    ];
    expect(pickBestIdx(streams, prefs)).toBe(1);
  });
});
