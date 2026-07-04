/*
 * Client-side manga resolution (New System — the reading surface).
 *
 * The reading twin of clientSources.js. The public backend never talks to a manga
 * host: /manga-overview returns AniList metadata + the candidate titles, and THIS
 * resolves the MangaDex chapter list + page images in the viewer's own browser (via
 * the vendored `crimson-sources` manga engine), exactly like the video sources moved
 * client-side. The page images come back as raw `*.mangadex.network` URLs an <img>
 * loads directly — no proxy, no backend bytes.
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
 * Resolve a manga's chapter list client-side from the AniList candidate titles the
 * backend overview hands us. Returns `{ mangaId, chapters }` or null when nothing
 * runs / matches. Best-effort: any failure yields null and the caller keeps whatever
 * the backend returned (an empty list in a base build).
 *
 * @param {{ titles: string[], contentRating: string[], language: string }} opts
 */
export async function resolveMangaChapters({ titles, contentRating, language }) {
  if (!clientMangaEnabled() || !Array.isArray(titles) || titles.length === 0) return null;
  try {
    const engine = await getEngine();
    if (!engine.available) {
      dbg('no client path (no companion / proxy) — leaving to the backend');
      return null;
    }
    const mangaId = await engine.resolveManga(titles, contentRating || []);
    if (!mangaId) { dbg('no MangaDex match for', titles[0]); return null; }
    const chapters = await engine.chapters(mangaId, language || 'en', contentRating || []);
    dbg(`resolved ${chapters.length} chapter(s) via ${engine.env} for ${mangaId}`);
    return chapters.length ? { mangaId, chapters } : null;
  } catch (err) {
    console.warn('[clientManga] chapter resolution failed:', err);
    return null;
  }
}

/**
 * Resolve one chapter's ordered page-image URLs client-side (raw @Home URLs for an
 * <img>). Returns [] on any failure so the reader can surface a clean error.
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
