/*
 * The `crimson-sources` engine resolves some sources in the viewer's browser and
 * emits the same `{"type":"stream"}` line as the backend /watch, so the hooks
 * consume both alike. The backend still covers every source the client cannot run.
 *
 * Delivery tiers: the companion extension (E3), the signed crimson-proxy (E2), and
 * the backend itself (E0).
 *
 *   Auto:     engages with the companion (subject to its own on/off switch), and
 *             otherwise via the proxy unless /sign reported it unconfigured.
 *   Override: localStorage 'crimson:clientSources' = '1' forces on, '0' pins off;
 *             VITE_CLIENT_SOURCES=true forces on at build time.
 *   Debug:    localStorage 'crimson:clientSources:debug' = '1' for per-source logs.
 */
import { createEngine, waitForExtensionBridge } from 'crimson-sources';
import { apiFetch } from '../api/client';

const FLAG_KEY = 'crimson:clientSources';

const DEBUG = (() => {
  try { return localStorage.getItem(`${FLAG_KEY}:debug`) === '1'; } catch { return false; }
})();
function dbg(...args) { if (DEBUG) console.info('[clientSources]', ...args); }

// null means auto.
function flagOverride() {
  try {
    if (import.meta.env?.VITE_CLIENT_SOURCES === 'true') return true;
    const v = localStorage.getItem(FLAG_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* no localStorage (SSR/sandbox): fall through to auto */ }
  return null;
}

function extensionPresent() {
  try {
    return Boolean(window.CrimsonExtension?.available);
  } catch {
    return false;
  }
}

// A sync approximation of the async gate in streamLocalSources, used for the
// dedup decision. Being wrongly on is harmless: dedup keys on (source, language),
// so if the engine resolves nothing no backend tile ever collides.
export function clientSourcesEnabled() {
  const o = flagOverride();
  if (o !== null) return o;
  if (extensionPresent()) return true;
  return !_proxyDisabled;
}

// The crimson-proxy only serves signed links and PROXY_SECRET must never reach the
// browser, so links are minted by the backend's /sign grant. One round-trip per
// (url, headers), not per segment: the proxy re-signs HLS sub-resources itself.
// A 503 means the proxy is unconfigured and latches E2 off for the session.
let _proxyDisabled = false;
const _signCache = new Map();

function _signKey(f) {
  return `${f.url}\n${f.referer || ''}\n${f.origin || ''}\n${f.userAgent || ''}`;
}

async function _signOnce(fields) {
  const res = await apiFetch('/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: fields.url,
      referer: fields.referer || '',
      origin: fields.origin || '',
      userAgent: fields.userAgent || '',
    }),
  });
  if (res.status === 503) {
    _proxyDisabled = true;
    throw new Error('crimson-proxy not configured');
  }
  if (!res.ok) throw new Error(`/sign failed: ${res.status}`);
  const data = await res.json();
  const signed = data?.signed?.[0];
  if (!signed) throw new Error('/sign returned no link');
  return signed;
}

// A rejection tells the engine the source cannot run client-side, so the backend
// covers it.
export function signProxyUrl(fields) {
  if (_proxyDisabled) return Promise.reject(new Error('crimson-proxy disabled'));
  const key = _signKey(fields);
  let p = _signCache.get(key);
  if (!p) {
    p = _signOnce(fields).catch((err) => {
      _signCache.delete(key); // a transient failure must not stick
      throw err;
    });
    _signCache.set(key, p);
  }
  return p;
}

// Some sources (Febbox) need a secret cookie that must stay server-side, but only
// for the resolve step: the URL it yields is a plain CDN file. The backend's
// /resolve does the secret lookup and returns the raw URL, and the engine still
// delivers the bytes client-side. Cached per episode. A 503 (unconfigured) or
// 404 (unknown source) latches that source off for the session.
const _grantDisabled = new Set();
const _grantCache = new Map();

function _grantKey(req) {
  const c = req.ctx;
  return `${req.source}\n${c.tmdbId}\n${c.mediaType}\n${c.season ?? ''}\n${c.episode ?? ''}`;
}

async function _resolveGrantOnce(req) {
  const c = req.ctx;
  const res = await apiFetch('/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: req.source,
      tmdbId: c.tmdbId,
      mediaType: c.mediaType,
      season: c.season ?? null,
      episode: c.episode ?? null,
      title: c.title ?? null,
      titleEnglish: c.titleEnglish ?? null,
      titleRomaji: c.titleRomaji ?? null,
      titleNative: c.titleNative ?? null,
      synonyms: c.synonyms ?? null,
    }),
  });
  if (res.status === 503 || res.status === 404) {
    _grantDisabled.add(req.source);
    return [];
  }
  if (!res.ok) throw new Error(`/resolve failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.streams) ? data.streams : [];
}

function resolveGrant(req) {
  if (_grantDisabled.has(req.source)) return Promise.resolve([]);
  const key = _grantKey(req);
  let p = _grantCache.get(key);
  if (!p) {
    p = _resolveGrantOnce(req).catch((err) => {
      _grantCache.delete(key); // don't cache a transient failure
      throw err;
    });
    _grantCache.set(key, p);
  }
  return p;
}

// The TMDB key behind the German synonyms, release year and IMDb id is
// server-held, so the title-matching sources get them from /scrape-meta. On
// failure the TMDB-keyed sources still run; only title matching goes quiet.
async function enrichMediaCtx(mediaCtx) {
  // The TV grant is season-keyed.
  const isMovie = mediaCtx.mediaType === 'movie';
  const isTv = mediaCtx.mediaType === 'tv' && mediaCtx.season != null;
  if (!isMovie && !isTv) return mediaCtx;
  try {
    const path = isMovie
      ? `/scrape-meta/movie/${mediaCtx.tmdbId}`
      : `/scrape-meta/${mediaCtx.tmdbId}/${mediaCtx.season}`;
    const res = await apiFetch(path);
    if (!res.ok) return mediaCtx;
    const m = await res.json();
    return {
      ...mediaCtx,
      title: mediaCtx.title || m.title || undefined,
      titleEnglish: m.title_english ?? null,
      titleRomaji: m.title_romaji ?? null,
      titleNative: m.title_native ?? null,
      synonyms: m.synonyms ?? null,
      anilistId: mediaCtx.anilistId ?? m.anilist_id ?? undefined,
      // Null for movies and non-AniList shows, so the MAL-keyed source skips itself.
      malId: mediaCtx.malId ?? m.mal_id ?? null,
      releaseYear: mediaCtx.releaseYear ?? m.release_year ?? null,
      imdbId: mediaCtx.imdbId ?? m.imdb_id ?? null,
    };
  } catch {
    return mediaCtx;
  }
}

// Feeds the admin dashboard's client-side success rates. Strictly aggregate: no
// title or user is sent.
function sendResolveBeacon(results) {
  try {
    const events = results.map((r) => ({ source: r.source, ok: !!r.ok, env: r.env }));
    apiFetch('/telemetry/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true, // survive a navigation right after the episode resolves
    }).catch(() => {});
  } catch { /* never let telemetry affect playback */ }
}

// Resolves immediately when nothing can run client-side, so callers can always
// await it alongside the backend stream. Returns the source labels emitted.
export async function streamLocalSources(mediaCtx, { signal, onLine } = {}) {
  const emitted = new Set();

  const override = flagOverride();
  if (override === false) {
    console.info('[clientSources] pinned OFF via flag, using the backend (E0).');
    return emitted;
  }

  // Waits briefly for the ready event in case a cold load onto /watch beat the
  // companion's async inject.
  const bridge = await waitForExtensionBridge();
  // Without the companion, the proxy still covers the header-only sources.
  // These verdict lines are unconditional (not dbg) so "did it engage?" is always
  // answerable. "companion absent" with the companion installed and on means its
  // bridge is not reaching the page (a page CSP blocking the inject, say): check
  // `window.CrimsonExtension` in the console.
  if (!bridge && _proxyDisabled) {
    console.info('[clientSources] no companion and crimson-proxy unconfigured, staying on the backend (E0).');
    return emitted;
  }
  if (!bridge) {
    console.info('[clientSources] companion absent, using the crimson-proxy (E2) for header-only sources.');
  }
  if (signal?.aborted) return emitted;

  let engine;
  try {
    engine = await createEngine({ extension: bridge, signProxyUrl, resolveGrant, debug: DEBUG });
  } catch (err) {
    console.warn('[clientSources] engine init failed:', err);
    return emitted;
  }

  const caps = engine.capabilities({ mediaType: mediaCtx.mediaType });
  console.info(
    `[clientSources] companion ${bridge ? 'detected' : 'absent'}, ` +
    `enabled=${caps.extensionEnabled}, runnable=[${caps.runnableSources.join(', ') || 'none'}]`,
  );

  if (!engine.canRunAny({ mediaType: mediaCtx.mediaType })) {
    if (bridge && !caps.extensionEnabled) {
      console.info(
        '[clientSources] companion is installed but switched OFF, using the backend. ' +
        'Toggle it on (toolbar button) to resolve sources locally.',
      );
    }
    await engine.dispose();
    return emitted;
  }

  // Only fetched once the engine confirms something is runnable.
  const enriched = await enrichMediaCtx(mediaCtx);
  if (signal?.aborted) {
    await engine.dispose();
    return emitted;
  }

  const results = [];
  try {
    for await (const line of engine.streamEpisode(enriched, {
      signal,
      onResult: (r) => results.push(r),
    })) {
      if (signal?.aborted) break;
      emitted.add(line.source);
      dbg(`resolved locally: ${line.source} (${line.streamType}) ${line.url}`);
      onLine?.(JSON.stringify(line));
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('[clientSources] stream error:', err);
  }
  // A superseded episode is not a real resolve outcome.
  if (!signal?.aborted && results.length) sendResolveBeacon(results);
  // Deliberately no engine.dispose(): it clears the companion's DNR rules (the
  // Referer/UA gated CDNs need), but the player keeps fetching segments for the
  // whole episode, so disposing here made VOE segments 403 mid-playback. The next
  // episode's streamEpisode() reinstalls them, and the extension's tab listener
  // clears them on navigation.
  return emitted;
}
