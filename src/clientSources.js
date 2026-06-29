/*
 * Client-side source engine integration (New System, Phase 1).
 *
 * Thin bridge between crimson-client and the `crimson-sources` engine (vendored
 * at vendor/crimson-sources). The engine resolves a subset of sources in the
 * viewer's own browser and emits the **exact same** `{"type":"stream", …}` line
 * the backend /watch produces, so the existing `handleLine` consumes it unchanged
 * and the backend stays the floor (E0) for everything else.
 *
 * It is OFF by default. Prod behavior is byte-identical to today until a viewer
 * opts in (the companion extension + the flag below), so this is a safe,
 * non-regressing addition — exactly the "shift of who does what" the design calls
 * for. Turning the live swap on per-source is the next step ("go from there").
 *
 *   Enable:  localStorage.setItem('crimson:clientSources', '1')   (per browser)
 *      or:   build with VITE_CLIENT_SOURCES=true
 *   Needs:   the crimson-extension companion installed + toggled on (E3). Without
 *            it there's no client-side fetch path yet (E2 needs a backend /sign
 *            grant, not built), so the engine simply runs nothing and the backend
 *            handles the title as always.
 */
import { createEngine, getExtensionBridge } from 'crimson-sources';

// Kept in sync with hooks.js (we deliberately don't import from there — hooks.js
// imports *this* module, so importing back would be a circular dependency).
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'https://backend.crimsonhaven.to';
const SESSION_KEY = 'crimson_session';

// Whether to even attempt client-side resolution. Default false => no behavior
// change. A build-time opt-in (VITE_CLIENT_SOURCES) or a per-browser localStorage
// flag both flip it on.
export function clientSourcesEnabled() {
  try {
    if (import.meta.env?.VITE_CLIENT_SOURCES === 'true') return true;
    return localStorage.getItem('crimson:clientSources') === '1';
  } catch {
    return false;
  }
}

// --- E2 proxy signing (New System §8a) -------------------------------------
// The crimson-proxy edge relay only serves *signed* links, and PROXY_SECRET must
// never ship to the browser. So when a source resolves client-side without the
// extension (E2), the engine asks us to turn an upstream URL + the headers the CDN
// wants injected into a signed proxy link — and we mint it via the backend's
// login-gated `/sign` grant. This is what carries the *segment bytes* off the
// backend (CDN → edge → viewer) for viewers who haven't installed the companion.
//
// Cheap and amortised: one tiny round-trip per distinct (url, headers) tuple
// (deduped + cached below), NOT per segment — the proxy re-signs the HLS
// sub-resources itself with the same secret. If `/sign` says the proxy isn't
// configured (503), we latch it off so we stop trying and the engine simply omits
// the E2 path (extension or backend still cover the source — never a regression).
let _proxyDisabled = false;
const _signCache = new Map(); // canonical key -> Promise<string>

function _signKey(f) {
  return `${f.url}\n${f.referer || ''}\n${f.origin || ''}\n${f.userAgent || ''}`;
}

async function _signOnce(fields) {
  const token = localStorage.getItem(SESSION_KEY);
  const res = await fetch(`${API_BASE_URL}/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      url: fields.url,
      referer: fields.referer || '',
      origin: fields.origin || '',
      userAgent: fields.userAgent || '',
    }),
  });
  if (res.status === 503) {
    _proxyDisabled = true; // proxy not configured on the backend — stop asking
    throw new Error('crimson-proxy not configured');
  }
  if (!res.ok) throw new Error(`/sign failed: ${res.status}`);
  const data = await res.json();
  const signed = data?.signed?.[0];
  if (!signed) throw new Error('/sign returned no link');
  return signed;
}

/**
 * The `signProxyUrl(fields) => Promise<string>` the engine threads into its E2
 * fetcher. Deduped + cached by canonical key so repeated fetches of the same host
 * don't re-round-trip. Rejections bubble up as a failed E2 attempt, which the
 * engine treats as "this source couldn't run client-side" → the backend covers it.
 */
function signProxyUrl(fields) {
  if (_proxyDisabled) return Promise.reject(new Error('crimson-proxy disabled'));
  const key = _signKey(fields);
  let p = _signCache.get(key);
  if (!p) {
    p = _signOnce(fields).catch((err) => {
      _signCache.delete(key); // don't cache a transient failure
      throw err;
    });
    _signCache.set(key, p);
  }
  return p;
}

// --- MediaCtx title enrichment (/scrape-meta) ------------------------------
// The TMDB-keyed sources (cinema.bz, PlayIMDb, ScreenScape) resolve off the id
// alone, but the title-matching *discovery* sources (aniworld / s.to / stomirror /
// aniwatch / AnimeSuge) search the target sites by title — and the German
// broadcast synonyms come from the server-held TMDB key (C5). So for TV we fetch
// the backend's `/scrape-meta` grant and merge its title bundle into the ctx,
// keeping client-side title matching byte-identical to the backend scrapers.
const _metaCache = new Map(); // `${tmdb}/${season}` -> Promise<meta|null>

async function fetchScrapeMeta(tmdbId, season) {
  const token = localStorage.getItem(SESSION_KEY);
  const res = await fetch(`${API_BASE_URL}/scrape-meta/${tmdbId}/${season}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json();
}

async function enrichMediaCtx(ctx) {
  // Movies are TMDB-keyed only (no discovery sources) → no title bundle needed.
  if (ctx.mediaType !== 'tv' || ctx.tmdbId == null || ctx.season == null) return ctx;
  const key = `${ctx.tmdbId}/${ctx.season}`;
  let p = _metaCache.get(key);
  if (!p) {
    p = fetchScrapeMeta(ctx.tmdbId, ctx.season).catch(() => null);
    _metaCache.set(key, p);
  }
  const meta = await p;
  if (!meta || meta.success === false) return ctx;
  return {
    ...ctx,
    title: ctx.title || meta.title || undefined,
    titleEnglish: meta.title_english ?? null,
    titleRomaji: meta.title_romaji ?? null,
    titleNative: meta.title_native ?? null,
    synonyms: meta.synonyms ?? null,
    anilistId: ctx.anilistId ?? meta.anilist_id ?? undefined,
  };
}

/**
 * Run the local engine for `mediaCtx`, invoking `onLine(jsonString)` for each
 * resolved source — same shape `streamWatchNdjson` feeds. Resolves immediately
 * (a no-op) when disabled or when nothing is runnable client-side, so callers can
 * always `await` it alongside the backend stream without branching.
 *
 * @returns {Promise<Set<string>>} the source labels emitted locally (for dedup).
 */
export async function streamLocalSources(mediaCtx, { signal, onLine } = {}) {
  const emitted = new Set();
  if (!clientSourcesEnabled()) return emitted;

  let engine;
  try {
    engine = await createEngine({ extension: getExtensionBridge(), signProxyUrl });
  } catch (err) {
    console.warn('[clientSources] engine init failed:', err);
    return emitted;
  }

  if (!engine.canRunAny({ mediaType: mediaCtx.mediaType })) {
    await engine.dispose();
    return emitted;
  }

  // Enrich with the title bundle the discovery sources match on (TV only; cached).
  let ctx = mediaCtx;
  try {
    ctx = await enrichMediaCtx(mediaCtx);
  } catch {
    /* fall back to the bare ctx — TMDB-keyed sources still run */
  }
  if (signal?.aborted) {
    await engine.dispose();
    return emitted;
  }

  try {
    for await (const line of engine.streamEpisode(ctx, { signal })) {
      if (signal?.aborted) break;
      emitted.add(line.source);
      onLine?.(JSON.stringify(line));
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('[clientSources] stream error:', err);
  } finally {
    await engine.dispose();
  }
  return emitted;
}
