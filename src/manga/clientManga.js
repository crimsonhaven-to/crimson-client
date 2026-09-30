/*
 * The public backend never talks to a manga host, so chapter lists and page images
 * are resolved here in the viewer's browser. MangaDex's API sends no
 * Access-Control-Allow-Origin, so this needs the same extension or signed-proxy
 * fetchers as the video engine and shares its clientSourcesEnabled() gate.
 * Chapter ids are namespaced "{sourceId}:{rawId}" so a page fetch routes back to
 * the right source. Pages are raw CDN URLs an <img> loads directly.
 */
import { createMangaEngine, waitForExtensionBridge } from 'crimson-sources';

import { clientSourcesEnabled, signProxyUrl } from '../sources/clientSources';

const DEBUG = (() => {
  try { return localStorage.getItem('crimson:clientSources:debug') === '1'; } catch { return false; }
})();
function dbg(...args) { if (DEBUG) console.info('[clientManga]', ...args); }

export function clientMangaEnabled() {
  return clientSourcesEnabled();
}

// Rebuilt per call so it reflects the companion's current on/off toggle. Cheap: a
// single `hello()` probe.
async function getEngine() {
  const bridge = await waitForExtensionBridge();
  return createMangaEngine({ extension: bridge, signProxyUrl });
}

// Returns `[{ sourceId, sourceLabel, mangaId, chapters }]` in the engine's source
// order, or [] on any failure so the caller keeps the backend's answer.
export async function resolveMangaSources({ titles, contentRating, language }) {
  if (!clientMangaEnabled() || !Array.isArray(titles) || titles.length === 0) return [];
  try {
    const engine = await getEngine();
    if (!engine.available) {
      dbg('no client path (no companion / proxy), leaving to the backend');
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
