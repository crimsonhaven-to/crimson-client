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
 *   Auto:    nothing to flip. When the crimson-extension companion is installed
 *            (it announces itself via a `crimson-extension-ready` handshake), the
 *            engine engages on its own; whether it actually runs sources is then
 *            gated by the companion's own on/off switch (E3). No companion => the
 *            engine stays dark and the backend handles the title as always.
 *   Override: localStorage 'crimson:clientSources' = '1' forces it on (e.g. to
 *            test the no-extension E2 proxy path) or '0' pins it off;
 *            VITE_CLIENT_SOURCES=true forces on at build time.
 *   Debug:   localStorage 'crimson:clientSources:debug' = '1' for per-source logs.
 */
import { createEngine, waitForExtensionBridge } from 'crimson-sources';
import { apiFetch } from './hooks';

const FLAG_KEY = 'crimson:clientSources';

const DEBUG = (() => {
  try { return localStorage.getItem(`${FLAG_KEY}:debug`) === '1'; } catch { return false; }
})();
function dbg(...args) { if (DEBUG) console.info('[clientSources]', ...args); }

/**
 * Explicit override of the auto-handshake:
 *   '1' (or VITE_CLIENT_SOURCES=true) => force client sources on,
 *   '0'                                => force off (pin to the backend),
 *   unset                              => auto (engage when the companion is present).
 * @returns {true|false|null} true/false to force, null for auto.
 */
function flagOverride() {
  try {
    if (import.meta.env?.VITE_CLIENT_SOURCES === 'true') return true;
    const v = localStorage.getItem(FLAG_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* no localStorage (SSR/sandbox) => fall through to auto */ }
  return null;
}

/** Synchronous best-effort: is the companion's in-page API present right now? */
function extensionPresent() {
  try {
    return Boolean(window.CrimsonExtension?.available);
  } catch {
    return false;
  }
}

// Whether the client engine is in play, for the dedup decision in handleLine.
// Sync, so it mirrors the async gate as closely as a sync read allows:
//   • an explicit override wins;
//   • the companion (E3) being present means yes;
//   • otherwise the E2 crimson-proxy path auto-engages for every viewer — it's on
//     unless we've *learned* the proxy is unconfigured (a /sign 503 latches
//     `_proxyDisabled`), at which point there's no client path and we stay on E0.
// Dedup keys on the specific (source, language) tile label, so leaving this on
// when the engine ends up resolving nothing is harmless (no backend tile collides).
export function clientSourcesEnabled() {
  const o = flagOverride();
  if (o !== null) return o;
  if (extensionPresent()) return true;
  return !_proxyDisabled;
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
  // apiFetch attaches the session bearer token + the API base; /sign is login-gated.
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

// --- Backend resolve grant (cookie/secret-bound sources) -------------------
// Some sources can't run in the browser at all — Febbox's final hop needs the `ui`
// cookie (a C5 secret that must stay server-side). But only the *resolve* needs the
// secret; the URL it yields is a direct CDN file. So the engine asks us to run the
// backend `/resolve` grant, which does the token-gated lookup and returns the **raw**
// stream URL + headers — and the engine then delivers the bytes (extension E3 / signed
// proxy E2), keeping the heavy mp4/HLS off the backend. This is the cookie-source twin
// of signProxyUrl (and only the host has the session token + API base, hence here).
//
// Cached per (source, tmdb, season, episode) — one round-trip per episode, not per
// segment. A 503 (source unconfigured, e.g. FEBBOX_UI_TOKEN unset) or 404 (unknown
// source) latches that source off for the session, so we stop asking and it cleanly
// falls back to the backend /watch line (never a regression).
const _grantDisabled = new Set();    // source keys the backend can't serve
const _grantCache = new Map();       // key -> Promise<GrantStream[]>

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
    _grantDisabled.add(req.source); // unconfigured/unknown — stop asking this session
    return [];
  }
  if (!res.ok) throw new Error(`/resolve failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.streams) ? data.streams : [];
}

/**
 * The `resolveGrant(req) => Promise<GrantStream[]>` the engine threads into its
 * backend-resolved sources (Febbox today). Deduped + cached per episode; a failure
 * bubbles up as "this source couldn't run client-side" → the backend covers it.
 */
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

/**
 * Fetch the title bundle the discovery sources need (AniList variants + German
 * synonyms) from the backend `/scrape-meta` grant and fold it into `mediaCtx`. The
 * TMDB key that produces the German titles is server-held (C5), so the client can't
 * derive these itself — it asks the backend, keeping title matching identical to
 * the backend scrapers. Best-effort: on any failure the TMDB-keyed sources still
 * run; only the title-matching ones go quiet.
 */
async function enrichMediaCtx(mediaCtx) {
  // TV needs a season (the grant is season-keyed); movies use the /movie variant.
  // Both add title + release year + imdb id so the title/IMDb-keyed Western sources
  // (hdrezka / lookmovie / insertunit) can match — the year + imdb come from the
  // server-held TMDB key (C5), same reason the German synonyms do.
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
      releaseYear: mediaCtx.releaseYear ?? m.release_year ?? null,
      imdbId: mediaCtx.imdbId ?? m.imdb_id ?? null,
    };
  } catch {
    return mediaCtx;
  }
}

/**
 * Fire-and-forget an anonymous resolve beacon (per-source ok/fail + env) to the
 * backend so the admin dashboard can show real client-side success rates. Strictly
 * aggregate — no title/user is sent. Best-effort: any failure is swallowed and
 * never touches playback.
 */
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

  const override = flagOverride();
  if (override === false) {
    console.info('[clientSources] pinned OFF via flag — using the backend (E0).');
    return emitted;
  }

  // The handshake: discover the companion, waiting briefly for its `…-ready` event
  // in case we beat its async inject (the cold-load-onto-/watch race).
  const bridge = await waitForExtensionBridge();
  // With the companion (E3) we run the full source set. WITHOUT it we still engage
  // the E2 crimson-proxy path for the header-only sources (cinema.bz / PlayIMDb /
  // ScreenScape / AnimeSuge) — the engine routes VOE/VidSrc/etc. to the backend on
  // its own. We only bail when there's genuinely no client path: no companion AND
  // the proxy is known-unconfigured (a prior /sign 503 latched `_proxyDisabled`).
  // Unconditional (not dbg): one verdict line per watch so a "did it engage?"
  // shakeout is always legible. If you see "companion absent" with the companion
  // installed + toggled on, its in-page bridge isn't reaching the page (e.g. a page
  // CSP blocking the inject) — check `window.CrimsonExtension` in the console.
  if (!bridge && _proxyDisabled) {
    console.info('[clientSources] no companion and crimson-proxy unconfigured — staying on the backend (E0).');
    return emitted;
  }
  if (!bridge) {
    console.info('[clientSources] companion absent — using the crimson-proxy (E2) for header-only sources.');
  }
  if (signal?.aborted) return emitted;

  let engine;
  try {
    // `debug` turns on the engine's verbose per-source/discovery trace; failures
    // are surfaced by the engine regardless. The signed-proxy grant (signProxyUrl)
    // lets the engine use the E2 path when the override forces it on without a
    // companion present.
    engine = await createEngine({ extension: bridge, signProxyUrl, resolveGrant, debug: DEBUG });
  } catch (err) {
    console.warn('[clientSources] engine init failed:', err);
    return emitted;
  }

  // One concise line so the shakeout is legible: did we see the companion, is it
  // switched on, and which sources can run client-side for this title.
  const caps = engine.capabilities({ mediaType: mediaCtx.mediaType });
  console.info(
    `[clientSources] companion ${bridge ? 'detected' : 'absent'}, ` +
    `enabled=${caps.extensionEnabled}, runnable=[${caps.runnableSources.join(', ') || 'none'}]`,
  );

  if (!engine.canRunAny({ mediaType: mediaCtx.mediaType })) {
    if (bridge && !caps.extensionEnabled) {
      console.info(
        '[clientSources] companion is installed but switched OFF — using the backend. ' +
        'Toggle it on (toolbar button) to resolve sources locally.',
      );
    }
    await engine.dispose();
    return emitted;
  }

  // Only the title-matching discovery sources need the grant; fetch it once the
  // engine confirms something is runnable, then run with the enriched context.
  const enriched = await enrichMediaCtx(mediaCtx);
  if (signal?.aborted) {
    await engine.dispose();
    return emitted;
  }

  // Collect each source's anonymous outcome (id + ok/fail + env) so we can send a
  // single resolve beacon at the end — this is the source-success visibility the
  // backend lost when resolving moved client-side (see telemetry_engine).
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
  // Fire-and-forget the beacon (not when aborted — a superseded episode isn't a
  // real resolve outcome). Never lets a telemetry failure affect playback.
  if (!signal?.aborted && results.length) sendResolveBeacon(results);
  // NB: intentionally NO engine.dispose() here. dispose() clears the companion's DNR
  // media rules (the injected voe.sx Referer/UA the gated CDN needs), but the player
  // keeps fetching segments for the WHOLE episode — long after the last source
  // resolves. Disposing on completion tore those rules out mid-playback, which is
  // exactly why VOE segments started 403ing a few seconds in (the first segments were
  // 200 while the rule was live). The rules are cleared+reinstalled at the start of
  // the next episode's streamEpisode(); leaving them up between episodes is harmless
  // (host-scoped, and the player only hits those CDNs while actually playing). Doing
  // it here would also race the next episode's install. They're torn down on a real
  // page navigation/reload by the extension's own tab listener.
  return emitted;
}
