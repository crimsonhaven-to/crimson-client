import { describe, it, expect } from 'vitest';

import {
  groupStreams,
  streamPriority,
  streamProviderLabel,
  streamRank,
  streamVariantLabel,
} from './streamUtils';

// streamRank is the auto-select contract shared with the backend's continue-watching
// warmup ranker (crimson-backend web/warmup.py _warmup_pick_best). If these two ever
// disagree, the source the player auto-plays and the source the backend pre-caches
// diverge — so this file pins the ranking rules that must stay in lockstep.

describe('streamPriority', () => {
  it('ranks a server-side Cache stream (by its /cache_proxy/ URL) highest', () => {
    expect(streamPriority({ source: 'Whatever NAS label', url: 'https://x/cache_proxy/abc' })).toBe(0);
  });

  it('ranks VOE then Jellyfin, and leaves everything else unranked at 100', () => {
    expect(streamPriority({ source: 'VOE (German Dub)' })).toBe(1);
    expect(streamPriority({ source: 'Jellyfin' })).toBe(2);
    expect(streamPriority({ source: 'ScreenScape · MovieBox' })).toBe(100);
  });

  it('is null-safe', () => {
    expect(streamPriority(undefined)).toBe(100);
    expect(streamPriority({})).toBe(100);
  });
});

describe('streamRank', () => {
  it('equals the source priority when no preference is set', () => {
    expect(streamRank({ source: 'VOE' }, null)).toBe(1);
    expect(streamRank({ source: 'VOE' }, { language: '', type: '' })).toBe(1);
    expect(streamRank({ source: 'x', url: 'y/cache_proxy/z' }, {})).toBe(0);
  });

  it('treats the language/type preference as the PRIMARY key (×1000)', () => {
    const prefs = { language: 'German', type: 'Dub' };
    // Perfect match -> only source priority contributes.
    expect(streamRank({ source: 'VOE', language: 'German Dub' }, prefs)).toBe(1);
    // Missing the type -> one mismatch tier above.
    expect(streamRank({ source: 'VOE', language: 'German Sub' }, prefs)).toBe(1000 + 1);
    // Missing both -> two tiers.
    expect(streamRank({ source: 'VOE', language: 'English Sub' }, prefs)).toBe(2000 + 1);
  });

  it('lets a language match beat a higher source priority (the whole point)', () => {
    const prefs = { language: 'German' };
    // A language-matching but otherwise unranked source (100)...
    const matching = streamRank({ source: 'ScreenScape', language: 'German Dub' }, prefs);
    // ...must still auto-play over a top-priority Cache source in the wrong language.
    const cacheWrongLang = streamRank({ source: 'NAS', url: '/cache_proxy/x', language: 'English' }, prefs);
    expect(matching).toBeLessThan(cacheWrongLang);
    expect(matching).toBe(100);
    expect(cacheWrongLang).toBe(1000);
  });
});

describe('streamProviderLabel / streamVariantLabel', () => {
  it('splits "Provider · variant (quality)" labels', () => {
    const s = { source: 'ScreenScape · MovieBox (1080p)' };
    expect(streamProviderLabel(s)).toBe('ScreenScape');
    expect(streamVariantLabel(s)).toBe('MovieBox (1080p)');
  });

  it('unwraps a bare "(qualifier)" into the variant', () => {
    const s = { source: 'Cinema.bz (tcloud)' };
    expect(streamProviderLabel(s)).toBe('Cinema.bz');
    expect(streamVariantLabel(s)).toBe('tcloud');
  });

  it('falls back to the provider for a lone, unqualified source', () => {
    const s = { source: 'VOE' };
    expect(streamProviderLabel(s)).toBe('VOE');
    expect(streamVariantLabel(s)).toBe('VOE');
  });
});

describe('groupStreams', () => {
  it('collapses a provider\'s variants into one stacked group, preserving indices', () => {
    const streams = [
      { source: 'ScreenScape · MovieBox (1080p)' },
      { source: 'VOE' },
      { source: 'ScreenScape · Vidplay (720p)' },
    ];
    const groups = groupStreams(streams);
    const screenscape = groups.find((g) => g.label === 'ScreenScape');
    expect(screenscape.stacked).toBe(true);
    expect(screenscape.items.map((i) => i.idx)).toEqual([0, 2]);
    const voe = groups.find((g) => g.label === 'VOE');
    expect(voe.stacked).toBe(false);
  });

  it('never groups Cache sources — each NAS target is its own solo card', () => {
    const streams = [
      { source: 'NAS A', url: '/cache_proxy/a' },
      { source: 'NAS B', url: '/cache_proxy/b' },
    ];
    const groups = groupStreams(streams);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.stacked === false)).toBe(true);
  });

  it('anchors groups at first-arrival order', () => {
    const streams = [
      { source: 'VOE' },
      { source: 'ScreenScape · A' },
      { source: 'ScreenScape · B' },
    ];
    expect(groupStreams(streams).map((g) => g.label)).toEqual(['VOE', 'ScreenScape']);
  });
});
