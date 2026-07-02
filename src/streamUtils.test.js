import { describe, it, expect } from 'vitest';

import {
  groupStreams,
  streamProviderLabel,
  streamRank,
  streamVariantLabel,
} from './streamUtils';

// streamRank is the auto-select contract shared with the backend's continue-watching
// warmup ranker (crimson-backend web/warmup.py _warmup_pick_best). If these two ever
// disagree, the source the player auto-plays and the source the backend pre-caches
// diverge — so this file pins the ranking rules that must stay in lockstep. The rank
// is purely the viewer's language/dub-sub preference: there is NO source-quality or
// provider priority — ties (and the no-preference case) fall back to arrival order.

describe('streamRank', () => {
  it('scores every stream equal when no preference is set (arrival order decides)', () => {
    expect(streamRank({ source: 'VOE' }, null)).toBe(0);
    expect(streamRank({ source: 'VOE' }, { language: '', type: '' })).toBe(0);
    expect(streamRank({ source: 'x', url: 'y/cache_proxy/z' }, {})).toBe(0);
  });

  it('ranks purely on how well the language/dub-sub preference matches', () => {
    const prefs = { language: 'German', type: 'Dub' };
    // Perfect match -> best (0).
    expect(streamRank({ source: 'VOE', language: 'German Dub' }, prefs)).toBe(0);
    // Missing the type -> one mismatch.
    expect(streamRank({ source: 'VOE', language: 'German Sub' }, prefs)).toBe(1);
    // Missing both -> two mismatches.
    expect(streamRank({ source: 'VOE', language: 'English Sub' }, prefs)).toBe(2);
  });

  it('ignores the provider entirely — only the language match matters', () => {
    const prefs = { language: 'German' };
    // A language-matching source beats a wrong-language one regardless of provider,
    // and provider/URL (e.g. a server-side cache) no longer earns any bonus.
    const matching = streamRank({ source: 'ScreenScape', language: 'German Dub' }, prefs);
    const cacheWrongLang = streamRank({ source: 'NAS', url: '/cache_proxy/x', language: 'English' }, prefs);
    expect(matching).toBe(0);
    expect(cacheWrongLang).toBe(1);
    expect(matching).toBeLessThan(cacheWrongLang);
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
