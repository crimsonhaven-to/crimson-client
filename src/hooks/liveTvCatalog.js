// --- Client-side Live TV catalogue (iptv-org) --------------------------------
// The browsable catalogue used to be built and served by the backend's
// iptv_engine (it fetched the iptv-org JSON index, joined it, and answered
// /iptv/browse|channels|channel). This module moves that whole join into the
// viewer's browser: the six iptv-org files are fetched straight from GitHub
// Pages (which serves `Access-Control-Allow-Origin: *`, so no proxy is needed),
// joined by a faithful port of the backend's build_catalog, and cached in
// IndexedDB for 12h — so the catalogue never touches the backend at all, and a
// return visit within the window pays zero bytes.
//
// Playback (the byte-heavy part) is handled separately in liveTvExt.js: a stream
// plays direct off the CDN when it can, through the crimson-extension companion
// when it can't (plain-http / no-CORS / Referer-gated), and only through the
// backend's signed /iptv_proxy as a last resort. See src/LiveTvWatch.jsx.
//
// Nothing here is hosted by us; iptv-org curates a public, daily index of
// free-to-air broadcasts. We honour their blocklist and drop NSFW by default,
// exactly like the backend did.

const IPTV_API_BASE = 'https://iptv-org.github.io/api';

// Matches the backend's IPTV_REFRESH_HOURS default (upstream publishes daily).
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// A stream with no quality tag sorts below any tagged one but above nothing.
const UNKNOWN_QUALITY = -1;

// --- IndexedDB cache ---------------------------------------------------------
// localStorage tops out around 5 MB; the built catalogue is several MB, so it
// lives in IndexedDB. One store, one row (the built catalogue + a timestamp).
const DB_NAME = 'crimson-livetv';
const STORE = 'catalog';
const CACHE_KEY = 'catalog-v1';

function openDb() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key, value) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// --- Catalogue join (pure; a port of iptv_engine.service.build_catalog) -------
function qualityRank(quality) {
  const n = parseInt(String(quality || '').toLowerCase().replace(/[pi]+$/, ''), 10);
  return Number.isNaN(n) ? UNKNOWN_QUALITY : n;
}

/**
 * Join the raw iptv-org API payloads into the servable catalogue. Only channels
 * that are alive (not closed/replaced), permitted (not blocklisted, not NSFW
 * unless opted in) and actually playable (≥1 stream) make it in.
 *
 * Returns { channels: {id -> record}, ordered: [id], categories: [...], countries: [...] }.
 */
export function buildCatalog(channels, streams, categories, countries, logos, blocklist, includeNsfw = false) {
  const blocked = new Set((blocklist || []).map((b) => b && b.channel).filter(Boolean));

  // Best logo per channel: in_use first, then channel-level over feed-level, then
  // widest — mirrors the backend's score tuple (in_use, feed is None, width).
  const logoByChannel = new Map();
  for (const lg of logos || []) {
    const ch = lg && lg.channel;
    if (!ch || !lg.url) continue;
    const score = [lg.in_use ? 1 : 0, lg.feed == null ? 1 : 0, lg.width || 0];
    const current = logoByChannel.get(ch);
    if (!current || scoreGreater(score, current.score)) {
      logoByChannel.set(ch, { url: lg.url, score });
    }
  }

  const streamsByChannel = new Map();
  for (const st of streams || []) {
    const ch = st && st.channel;
    const url = st && st.url;
    if (!ch || !url) continue;
    if (!streamsByChannel.has(ch)) streamsByChannel.set(ch, []);
    streamsByChannel.get(ch).push({
      url,
      quality: st.quality ?? null,
      label: st.label ?? null,
      referrer: st.referrer || '',
      user_agent: st.user_agent || '',
    });
  }

  const countryNames = new Map();
  for (const c of countries || []) {
    if (c && c.code) countryNames.set(c.code, { name: c.name || c.code, flag: c.flag || '' });
  }
  const categoryNames = new Map();
  for (const c of categories || []) {
    if (c && c.id) categoryNames.set(c.id, c.name || c.id);
  }

  const records = new Map();
  const categoryCounts = new Map();
  const countryCounts = new Map();

  for (const ch of channels || []) {
    const cid = ch && ch.id;
    if (!cid || blocked.has(cid)) continue;
    if (ch.closed || ch.replaced_by) continue;
    if (ch.is_nsfw && !includeNsfw) continue;
    const chStreams = streamsByChannel.get(cid);
    if (!chStreams || chStreams.length === 0) continue;

    chStreams.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
    const cats = (ch.categories || []).filter((c) => categoryNames.has(c));
    const country = ch.country || '';
    records.set(cid, {
      id: cid,
      name: ch.name || cid,
      network: ch.network ?? null,
      country,
      categories: cats,
      website: ch.website ?? null,
      logo: (logoByChannel.get(cid) || {}).url ?? null,
      streams: chStreams,
      // Pre-lowered haystack so search doesn't re-lower every name per query.
      _search: [ch.name || '', ch.network || '', ...(ch.alt_names || [])].join(' ').toLowerCase(),
    });
    for (const c of cats) categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
    if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
  }

  const ordered = [...records.keys()].sort((a, b) =>
    records.get(a).name.toLowerCase().localeCompare(records.get(b).name.toLowerCase()));

  const catList = [...categoryCounts.entries()]
    .map(([id, count]) => ({ id, name: categoryNames.get(id) || id, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const countryList = [...countryCounts.entries()]
    .map(([code, count]) => ({
      code,
      name: (countryNames.get(code) || {}).name || code,
      flag: (countryNames.get(code) || {}).flag || '',
      count,
    }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));

  return { channels: Object.fromEntries(records), ordered, categories: catList, countries: countryList };
}

// Lexicographic compare of the [in_use, channelLevel, width] score tuples.
function scoreGreater(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

// --- Read helpers (ports of browse_facets / list_channels / get_channel) ------
export function browseFacets(catalog) {
  if (!catalog) return { categories: [], countries: [], total: 0 };
  return {
    categories: catalog.categories,
    countries: catalog.countries,
    total: Object.keys(catalog.channels).length,
  };
}

function shapeCard(rec) {
  return {
    id: rec.id,
    name: rec.name,
    country: rec.country,
    categories: rec.categories,
    logo: rec.logo,
    best_quality: rec.streams.length ? rec.streams[0].quality : null,
    stream_count: rec.streams.length,
  };
}

export function listChannels(catalog, { category = null, country = null, q = '', page = 1, pageSize = 60 } = {}) {
  if (!catalog) return { channels: [], total: 0, page, page_size: pageSize };
  const needle = (q || '').trim().toLowerCase();
  const wantCountry = (country || '').trim().toUpperCase();
  const wantCategory = (category || '').trim().toLowerCase();

  const matches = [];
  for (const cid of catalog.ordered) {
    const rec = catalog.channels[cid];
    if (wantCategory && !rec.categories.includes(wantCategory)) continue;
    if (wantCountry && rec.country !== wantCountry) continue;
    if (needle && !rec._search.includes(needle)) continue;
    matches.push(rec);
  }

  const p = Math.max(1, page);
  const size = Math.max(1, Math.min(200, pageSize));
  const start = (p - 1) * size;
  return {
    channels: matches.slice(start, start + size).map(shapeCard),
    total: matches.length,
    page: p,
    page_size: size,
  };
}

/**
 * Full channel detail for the watch page. Unlike the backend (which pre-signs a
 * proxy_path per stream), the client keeps the raw upstream fields — url plus the
 * Referer/User-Agent the feed demands — and computes `direct_ok`. The playback
 * layer decides per feed whether to go direct, through the extension, or (last
 * resort) mint a signed backend proxy link. See liveTvExt.js.
 */
export function getChannel(catalog, channelId) {
  if (!catalog) return null;
  const rec = catalog.channels[channelId];
  if (!rec) return null;
  return {
    id: rec.id,
    name: rec.name,
    network: rec.network,
    country: rec.country,
    categories: rec.categories,
    website: rec.website,
    logo: rec.logo,
    streams: rec.streams.map((s) => ({
      quality: s.quality,
      label: s.label,
      url: s.url,
      referrer: s.referrer,
      user_agent: s.user_agent,
      // Direct-eligible: an https page can only load https media, and the browser
      // can't send a custom Referer/User-Agent. (CORS can't be known ahead of
      // time — the player discovers it by trying, then escalates.)
      direct_ok: s.url.startsWith('https://') && !s.referrer && !s.user_agent,
    })),
  };
}

// --- Fetch + cache orchestration ---------------------------------------------
async function fetchJson(name) {
  const res = await fetch(`${IPTV_API_BASE}/${name}.json`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`iptv-org ${name}.json: HTTP ${res.status}`);
  return res.json();
}

async function fetchAndBuild() {
  const [channels, streams, categories, countries, logos, blocklist] = await Promise.all([
    fetchJson('channels'),
    fetchJson('streams'),
    fetchJson('categories'),
    fetchJson('countries'),
    fetchJson('logos'),
    fetchJson('blocklist'),
  ]);
  return buildCatalog(channels, streams, categories, countries, logos, blocklist);
}

// Session-scoped memo so navigating between the hub and watch pages doesn't even
// re-read IndexedDB. Holds the in-flight promise too, so concurrent callers share
// one build.
let _catalogPromise = null;

async function loadCatalog() {
  // Try the IndexedDB cache first; a fresh row skips the ~21 MB download entirely.
  try {
    const cached = await idbGet(CACHE_KEY);
    if (cached && cached.builtAt && (Date.now() - cached.builtAt) < CACHE_TTL_MS && cached.catalog) {
      return cached.catalog;
    }
  } catch {
    /* IndexedDB unavailable (private mode / disabled) — fall through to a live fetch. */
  }

  const catalog = await fetchAndBuild();
  try {
    await idbSet(CACHE_KEY, { builtAt: Date.now(), catalog });
  } catch {
    /* Cache write failed (quota/private mode) — playback still works, just uncached. */
  }
  return catalog;
}

/**
 * The built catalogue, memoised for the page session. Rejects if the iptv-org
 * fetch fails and there's no usable cache — callers surface that as the hub's
 * error state (and may fall back to the backend). A rejected attempt is not
 * memoised, so a later retry can succeed.
 */
export function getCatalog() {
  if (!_catalogPromise) {
    _catalogPromise = loadCatalog().catch((err) => {
      _catalogPromise = null;
      throw err;
    });
  }
  return _catalogPromise;
}
