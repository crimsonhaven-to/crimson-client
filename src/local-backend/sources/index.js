// Source registry + the scrape->resolve pipeline, ported from api.py
// (run_single_scraper + resolve_streams). Scrapers and resolvers are registered
// in registry.js (filled in M3/M4); this module is source-agnostic.

import { ALL_SCRAPERS, ALL_RESOLVERS } from './registry.js';

// run_single_scraper: search -> embeds for one scraper.
export async function runScraper(ScraperClass, tmdbId, seasonNum, episodeNum, mediaCtx) {
  const scraper = new ScraperClass();
  try {
    const ctx = { tmdb_id: tmdbId, tmdb_season: seasonNum, ...mediaCtx };
    const slug = await scraper.searchAnime(ctx);
    if (!slug) return [];
    return (await scraper.getEpisodeEmbeds(slug, episodeNum, seasonNum)) || [];
  } catch (e) {
    console.warn(`[source] scraper error ${ScraperClass.name}:`, e);
    return [];
  }
}

// resolve_streams: embed URLs/markers -> playable {source, type, url} entries.
// `type` is 'hls' | 'mp4' | 'iframe'. Resolvers that return a chrome-extension://
// player page (e.g. Movish ad-stripped player) yield an 'iframe'.
export async function resolveStreams(embedUrls, { language } = {}) {
  if (!embedUrls || !embedUrls.length) return [];
  const resolvers = ALL_RESOLVERS.map((R) => new R());
  const out = [];

  for (const embedUrl of embedUrls) {
    const resolver = resolvers.find((r) => embedUrl.toLowerCase().includes(r.domainKeyword));
    if (!resolver) {
      out.push({ source: 'Direct Embed', type: 'iframe', url: embedUrl });
      continue;
    }
    try {
      const direct = await resolver.resolve(embedUrl);
      if (direct) {
        // A resolver may return {url, type} or a bare URL string.
        const url = typeof direct === 'string' ? direct : direct.url;
        let type = typeof direct === 'object' && direct.type ? direct.type : null;
        if (!type) {
          if (url.startsWith('chrome-extension://') || url.includes('player.html')) type = 'iframe';
          else type = url.toLowerCase().includes('m3u8') ? 'hls' : 'mp4';
        }
        out.push({ source: resolver.sourceName, type, url });
      } else if (/^https?:\/\//i.test(embedUrl)) {
        // No direct stream, but the embed is a real page — iframe it (legacy).
        out.push({ source: `${resolver.sourceName} (Embed)`, type: 'iframe', url: embedUrl });
      }
      // else: internal marker that resolved to nothing -> drop silently.
    } catch (e) {
      console.warn(`[source] resolver error ${resolver.sourceName}:`, e);
    }
  }

  if (language) out.forEach((s) => { s.language = language; });
  return out;
}

export { ALL_SCRAPERS };
