// Cinema.bz source — TMDB-keyed HLS aggregator (3 providers -> 3 tiles). Port of
// scrapers/cinemabz_scraper.py + resolvers/cinemabz.py.
//
// The scraper deterministically builds one marker per provider; each resolver
// hits cinema.bz's own API (keyed off the TMDB id) for a master.m3u8. Everything
// cinema.bz serves is Referer-gated on https://cinema.bz/ — a static DNR rule
// covers the API host, and a per-host session rule (added here) covers the
// rotating stream CDN. No proxy/playlist-rewrite needed (CORS is free in the
// extension), so the resolver returns the direct m3u8 for hls.js.

import { BaseScraper, BaseResolver } from './base.js';
import { addStreamRule } from '../proxy/dnr.js';

const MARKER = 'crimson-cinemabz';
const PROVIDERS = ['tcloud', 'ipcloud', 'ngcloud'];
const API_BASE = 'https://cinema.bz/api';
const REFERER = 'https://cinema.bz/';
const ORIGIN = 'https://cinema.bz';

export class CinemabzScraper extends BaseScraper {
  async searchAnime(ctx) {
    return ctx.tmdb_id != null ? String(ctx.tmdb_id) : null;
  }

  async getEpisodeEmbeds(slug, episodeNum, seasonNum = 1) {
    if (!slug) return [];
    return PROVIDERS.map((p) => `${MARKER}:${p}:tv:${slug}:${seasonNum}:${episodeNum}`);
  }
}

class CinemabzResolverBase extends BaseResolver {
  provider = '';

  async resolve(embedUrl) {
    // Marker: crimson-cinemabz:{provider}:{type}:{tmdb}:{season}:{episode}
    const parts = embedUrl.split(':');
    if (parts.length < 4 || parts[0] !== MARKER || parts[1] !== this.provider) return null;
    const mediaType = parts[2];
    const tmdb = parts[3];
    const season = parts[4] && /^\d+$/.test(parts[4]) ? parts[4] : null;
    const episode = parts[5] && /^\d+$/.test(parts[5]) ? parts[5] : null;

    const path = (mediaType === 'tv' && season != null && episode != null)
      ? `/${this.provider}/tv/${tmdb}/${season}/${episode}`
      : `/${this.provider}/movie/${tmdb}`;

    let data;
    try {
      const res = await fetch(API_BASE + path); // Referer set by the static DNR rule
      if (!res.ok) return null; // 404 = this provider lacks the title (expected)
      data = await res.json();
    } catch {
      return null;
    }

    const url = data?.stream?.url;
    if (typeof url !== 'string' || !url.startsWith('https://')) return null;

    await addStreamRule(url, { referer: REFERER, origin: ORIGIN });
    return { url, type: 'hls' };
  }
}

export class CinemabzTcloudResolver extends CinemabzResolverBase {
  provider = 'tcloud';
  domainKeyword = `${MARKER}:tcloud`;
  sourceName = 'Cinema.bz (tcloud)';
}
export class CinemabzIpcloudResolver extends CinemabzResolverBase {
  provider = 'ipcloud';
  domainKeyword = `${MARKER}:ipcloud`;
  sourceName = 'Cinema.bz (ipcloud)';
}
export class CinemabzNgcloudResolver extends CinemabzResolverBase {
  provider = 'ngcloud';
  domainKeyword = `${MARKER}:ngcloud`;
  sourceName = 'Cinema.bz (ngcloud)';
}
