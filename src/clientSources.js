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
 *            test the no-extension paths) or '0' pins it off; VITE_CLIENT_SOURCES
 *            =true forces on at build time.
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
// Sync, so it mirrors the async gate as closely as a sync read allows: an explicit
// override wins, otherwise it tracks companion presence. By the time stream lines
// arrive the extension has long since injected, so this read is reliable there.
export function clientSourcesEnabled() {
  const o = flagOverride();
  if (o !== null) return o;
  return extensionPresent();
}

// E2 (crimson-proxy) needs a signed URL, and PROXY_SECRET must never ship to the
// browser — so the proxy path is wired to a backend `/sign` grant. That endpoint
// doesn't exist yet (Phase 2), so we pass no signer: the engine then offers only
// the extension (E3) path, and falls back to the backend otherwise.
const signProxyUrl = undefined;

/**
 * Fetch the title bundle the discovery sources need (AniList variants + German
 * synonyms) from the backend `/scrape-meta` grant and fold it into `mediaCtx`. The
 * TMDB key that produces the German titles is server-held (C5), so the client can't
 * derive these itself — it asks the backend, keeping title matching identical to
 * the backend scrapers. Best-effort: on any failure the TMDB-keyed sources still
 * run; only the title-matching ones go quiet.
 */
async function enrichMediaCtx(mediaCtx) {
  if (mediaCtx.mediaType !== 'tv' || mediaCtx.season == null) return mediaCtx;
  try {
    const res = await apiFetch(`/scrape-meta/${mediaCtx.tmdbId}/${mediaCtx.season}`);
    if (!res.ok) return mediaCtx;
    const m = await res.json();
    return {
      ...mediaCtx,
      title: mediaCtx.title || m.title || undefined,
      titleEnglish: m.title_english ?? null,
      titleRomaji: m.title_romaji ?? null,
      titleNative: m.title_native ?? null,
      synonyms: m.synonyms ?? null,
      anilistId: m.anilist_id ?? undefined,
    };
  } catch {
    return mediaCtx;
  }
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
  if (override === false) return emitted; // explicitly pinned to the backend

  // The handshake: discover the companion, waiting briefly for its `…-ready` event
  // in case we beat its async inject (the cold-load-onto-/watch race). In auto mode
  // (no override) the engine only engages when the companion is actually present.
  const bridge = await waitForExtensionBridge();
  if (override !== true && !bridge) {
    dbg('no companion detected and no opt-in — staying on the backend (E0).');
    return emitted;
  }
  if (signal?.aborted) return emitted;

  let engine;
  try {
    engine = await createEngine({ extension: bridge, signProxyUrl });
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

  try {
    for await (const line of engine.streamEpisode(enriched, { signal })) {
      if (signal?.aborted) break;
      emitted.add(line.source);
      dbg(`resolved locally: ${line.source} (${line.streamType}) ${line.url}`);
      onLine?.(JSON.stringify(line));
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('[clientSources] stream error:', err);
  } finally {
    await engine.dispose();
  }
  return emitted;
}
