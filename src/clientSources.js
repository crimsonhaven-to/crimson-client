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
import { apiFetch } from './hooks';

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
      onLine?.(JSON.stringify(line));
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('[clientSources] stream error:', err);
  } finally {
    await engine.dispose();
  }
  return emitted;
}
