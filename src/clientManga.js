/*
 * Client-side manga resolution (New System — the reading surface).
 *
 * The reading twin of clientSources.js. The public backend never talks to a manga
 * host: /manga-overview returns AniList metadata + the candidate titles, and THIS
 * resolves the chapter list + page images in the viewer's own browser (via the
 * vendored `crimson-sources` manga engine), exactly like the video sources moved
 * client-side. Resolution is MULTI-SOURCE: the title is matched against every manga
 * source the engine can run (MangaDex, WeebCentral, …) and the reader offers a source
 * picker. Chapter ids are namespaced `"{sourceId}:{rawId}"` by the engine so a later
 * page fetch routes back to the right source. The page images come back as raw CDN
 * URLs an <img> loads directly — no proxy, no backend bytes.
 *
 * It reuses the same tiered fetchers as the video engine (extension E3 / signed
 * crimson-proxy E2 — MangaDex's API answers no ACAO, so a CORS bypass is required)
 * and the same `signProxyUrl` grant + `clientSourcesEnabled()` gate, so its
 * on/off/auto behaviour is identical: nothing changes for a viewer until the
 * companion is installed or the crimson-proxy is configured. When neither is
 * available the resolver simply yields nothing and the surface falls back to the
 * backend (a provider build resolves server-side; a base build shows no chapters).
 */
import { createMangaEngine, waitForExtensionBridge } from 'crimson-sources';

import { clientSourcesEnabled, signProxyUrl } from './clientSources';

const DEBUG = (() => {
  try { return localStorage.getItem('crimson:clientSources:debug') === '1'; } catch { return false; }
})();
function dbg(...args) { if (DEBUG) console.info('[clientManga]', ...args); }

/**
 * Sync best-effort gate: should we even attempt client-side manga resolution? Shares
 * the video engine's verdict (an explicit override, or a present companion, or an
 * as-yet-unruled-out crimson-proxy). When false there is no client path, so callers
 * skip straight to the backend without a wasted round-trip.
 */
export function clientMangaEnabled() {
  return clientSourcesEnabled();
}

// Build a fresh engine per call so it reflects the companion's current on/off toggle
// (cheap — a single `hello()` probe), mirroring how clientSources rebuilds per watch.
async function getEngine() {
  const bridge = await waitForExtensionBridge();
  return createMangaEngine({ extension: bridge, signProxyUrl });
}

/**
 * Resolve a manga across every runnable source client-side, from the AniList
 * candidate titles the backend overview hands us. Returns an array of per-source
 * results `[{ sourceId, sourceLabel, mangaId, chapters }]` (chapters' ids already
 * namespaced by source), in the engine's source order; empty when nothing runs /
 * matches. Best-effort: any failure yields [] and the caller keeps whatever the
 * backend returned (an empty list in a base build).
 *
 * @param {{ titles: string[], contentRating: string[], language: string }} opts
 */
export async function resolveMangaSources({ titles, contentRating, language }) {
  if (!clientMangaEnabled() || !Array.isArray(titles) || titles.length === 0) return [];
  try {
    const engine = await getEngine();
    if (!engine.available) {
      dbg('no client path (no companion / proxy) — leaving to the backend');
      return [];
    }
    const results = await engine.resolveAll(titles, contentRating || [], language || 'en');
    dbg(`resolved ${results.length} source(s) via ${engine.env} for`, titles[0]);
    return results;
  } catch (err) {
    console.warn('[clientManga] source resolution failed:', err);
    return [];
  }
}

/**
 * Resolve one chapter's ordered page-image URLs client-side (raw CDN URLs for an
 * <img>). The chapter id is source-namespaced ("{sourceId}:{rawId}"), so the engine
 * routes the fetch to the right source. Returns [] on any failure so the reader can
 * surface a clean error.
 */
export async function resolveMangaPages(chapterId, dataSaver = false) {
  if (!clientMangaEnabled() || !chapterId) return [];
  try {
    const engine = await getEngine();
    if (!engine.available) return [];
    const pages = await engine.pages(chapterId, dataSaver);
    dbg(`resolved ${pages.length} page(s) via ${engine.env} for chapter ${chapterId}`);
    return pages;
  } catch (err) {
    console.warn('[clientManga] page resolution failed:', err);
    return [];
  }
}
