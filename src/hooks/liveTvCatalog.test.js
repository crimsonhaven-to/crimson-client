import { describe, it, expect } from 'vitest';

import { buildCatalog, browseFacets, listChannels, getChannel } from './liveTvCatalog';

// The client catalogue join must stay behaviourally in lockstep with the backend's
// iptv_engine.build_catalog (crimson-backend/tests/test_iptv.py) — same membership
// rules, same best-quality-first ordering, same facet counts, same direct_ok logic.
// These fixtures are the JS twin of that test's, so a divergence surfaces here.
const CHANNELS = [
  { id: 'AlphaTV.us', name: 'Alpha TV', alt_names: ['Alpha'], network: 'AlphaNet', country: 'US', categories: ['news'], is_nsfw: false, closed: null, replaced_by: null, website: 'https://alpha.example' },
  { id: 'BetaKids.de', name: 'Beta Kids', alt_names: [], network: null, country: 'DE', categories: ['kids', 'family'], is_nsfw: false, closed: null, replaced_by: null, website: null },
  { id: 'Naughty.xx', name: 'Naughty', alt_names: [], network: null, country: 'US', categories: ['xxx'], is_nsfw: true, closed: null, replaced_by: null, website: null },
  { id: 'Dead.fr', name: 'Dead', alt_names: [], network: null, country: 'FR', categories: ['general'], is_nsfw: false, closed: '2020-01-01', replaced_by: null, website: null },
  { id: 'Blocked.us', name: 'Blocked', alt_names: [], network: null, country: 'US', categories: ['news'], is_nsfw: false, closed: null, replaced_by: null, website: null },
  { id: 'NoStreams.jp', name: 'No Streams', alt_names: [], network: null, country: 'JP', categories: ['general'], is_nsfw: false, closed: null, replaced_by: null, website: null },
];

const STREAMS = [
  { channel: 'AlphaTV.us', url: 'https://cdn.example/alpha/480.m3u8', quality: '480p', label: null, referrer: null, user_agent: null },
  { channel: 'AlphaTV.us', url: 'https://cdn.example/alpha/1080.m3u8', quality: '1080p', label: null, referrer: 'https://alpha.example/', user_agent: null },
  { channel: 'BetaKids.de', url: 'http://cdn.example/beta.m3u8', quality: null, label: 'Not 24/7', referrer: null, user_agent: null },
  { channel: 'Naughty.xx', url: 'https://cdn.example/n.m3u8', quality: '720p', label: null, referrer: null, user_agent: null },
  { channel: 'Blocked.us', url: 'https://cdn.example/blocked.m3u8', quality: '720p', label: null, referrer: null, user_agent: null },
  { channel: 'Dead.fr', url: 'https://cdn.example/dead.m3u8', quality: '720p', label: null, referrer: null, user_agent: null },
  { channel: null, url: 'https://cdn.example/orphan.m3u8', quality: '720p', label: null, referrer: null, user_agent: null },
];

const CATEGORIES = [
  { id: 'news', name: 'News' }, { id: 'kids', name: 'Kids' }, { id: 'family', name: 'Family' },
  { id: 'general', name: 'General' }, { id: 'xxx', name: 'XXX' },
];

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' }, { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' }, { code: 'FR', name: 'France', flag: '🇫🇷' },
];

const LOGOS = [
  { channel: 'AlphaTV.us', feed: 'SD', in_use: true, width: 100, url: 'https://img.example/alpha-feed.png' },
  { channel: 'AlphaTV.us', feed: null, in_use: true, width: 512, url: 'https://img.example/alpha.png' },
  { channel: 'AlphaTV.us', feed: null, in_use: false, width: 1024, url: 'https://img.example/alpha-old.png' },
];

const BLOCKLIST = [{ channel: 'Blocked.us', reason: 'dmca', ref: 'https://x' }];

const catalog = (opts = false) => buildCatalog(CHANNELS, STREAMS, CATEGORIES, COUNTRIES, LOGOS, BLOCKLIST, opts);

describe('buildCatalog membership', () => {
  it('keeps only alive + permitted + playable channels', () => {
    expect(new Set(Object.keys(catalog().channels))).toEqual(new Set(['AlphaTV.us', 'BetaKids.de']));
  });

  it('includes NSFW when opted in', () => {
    expect(Object.keys(catalog(true).channels)).toContain('Naughty.xx');
  });
});

describe('buildCatalog ordering + logos', () => {
  it('sorts streams best-quality first, untagged last but present', () => {
    const alpha = catalog().channels['AlphaTV.us'].streams;
    expect(alpha.map((s) => s.quality)).toEqual(['1080p', '480p']);
    expect(catalog().channels['BetaKids.de'].streams[0].quality).toBeNull();
  });

  it('picks the in-use channel-level logo', () => {
    expect(catalog().channels['AlphaTV.us'].logo).toBe('https://img.example/alpha.png');
  });
});

describe('buildCatalog facets', () => {
  it('counts only surfaced channels', () => {
    const counts = Object.fromEntries(catalog().categories.map((c) => [c.id, c.count]));
    expect(counts).toEqual({ news: 1, kids: 1, family: 1 });
    const cc = Object.fromEntries(catalog().countries.map((c) => [c.code, c.count]));
    expect(cc).toEqual({ US: 1, DE: 1 });
    expect(Object.fromEntries(catalog().countries.map((c) => [c.code, c.flag])).DE).toBe('🇩🇪');
  });
});

describe('listChannels', () => {
  const cat = catalog();
  it('filters by country/category and searches name/alt/network case-insensitively', () => {
    expect(listChannels(cat).channels.map((c) => c.id)).toEqual(['AlphaTV.us', 'BetaKids.de']);
    expect(listChannels(cat, { country: 'de' }).channels.map((c) => c.id)).toEqual(['BetaKids.de']);
    expect(listChannels(cat, { category: 'NEWS' }).channels.map((c) => c.id)).toEqual(['AlphaTV.us']);
    expect(listChannels(cat, { q: 'alphanet' }).total).toBe(1);
    expect(listChannels(cat, { q: 'zzz' }).total).toBe(0);
  });

  it('pages', () => {
    const page = listChannels(cat, { page: 2, pageSize: 1 });
    expect(page.total).toBe(2);
    expect(page.channels.map((c) => c.id)).toEqual(['BetaKids.de']);
  });

  it('cards carry no private fields', () => {
    const card = listChannels(cat).channels[0];
    expect(card._search).toBeUndefined();
    expect(card.streams).toBeUndefined();
    expect(card.best_quality).toBe('1080p');
    expect(card.stream_count).toBe(2);
  });
});

describe('getChannel + direct_ok', () => {
  const cat = catalog();
  it('returns detail with raw upstream fields', () => {
    const detail = getChannel(cat, 'AlphaTV.us');
    expect(detail.name).toBe('Alpha TV');
    expect(detail.streams[0].url).toBe('https://cdn.example/alpha/1080.m3u8');
    expect(getChannel(cat, 'Blocked.us')).toBeNull();
  });

  it('marks only browser-playable streams direct_ok', () => {
    const alpha = getChannel(cat, 'AlphaTV.us').streams;
    expect(alpha[0].direct_ok).toBe(false); // 1080p is Referer-gated
    expect(alpha[1].direct_ok).toBe(true); // 480p is plain https
    expect(getChannel(cat, 'BetaKids.de').streams[0].direct_ok).toBe(false); // http → mixed content
  });
});

describe('browseFacets', () => {
  it('summarises the catalogue', () => {
    const f = browseFacets(catalog());
    expect(f.total).toBe(2);
    expect(f.categories.map((c) => c.id).sort()).toEqual(['family', 'kids', 'news']);
  });
});
