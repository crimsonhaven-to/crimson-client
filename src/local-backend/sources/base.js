// Base classes for the JS scraper/resolver ports — same contract as the Python
// scrapers/base_scraper.py + resolvers/base_resolver.py.
//
// Note on headers: the browser forbids setting Referer/Origin/User-Agent via
// fetch(). Sources that need a spoofed Referer (PlayIMDb, AnimeSuge, Cinema.bz,
// VOE, etc.) rely on the static declarativeNetRequest rules instead (the
// extension equivalent of the backend's signed proxies). See proxy/rules.

export class BaseScraper {
  // Step 1: search the site, return its slug/id (or a routing marker for the
  // TMDB-keyed sources). Step 2: turn that into embed URLs / markers.
  async searchAnime(/* mediaCtx */) {
    throw new Error('searchAnime not implemented');
  }

  async getEpisodeEmbeds(/* slug, episodeNum, seasonNum */) {
    throw new Error('getEpisodeEmbeds not implemented');
  }

  async fetchText(url, opts = {}) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) return '';
      return await res.text();
    } catch (e) {
      console.warn('[scraper] fetchText failed:', url, e);
      return '';
    }
  }

  async fetchJson(url, opts = {}) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[scraper] fetchJson failed:', url, e);
      return null;
    }
  }
}

export class BaseResolver {
  domainKeyword = '';
  sourceName = '';

  async resolve(/* embedUrl */) {
    throw new Error('resolve not implemented');
  }

  async fetchText(url, opts = {}) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) return '';
      return await res.text();
    } catch (e) {
      console.warn('[resolver] fetchText failed:', url, e);
      return '';
    }
  }
}
