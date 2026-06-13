// PlayIMDb source — ad-free extracted-stream variant. Port of
// scrapers/playimdb_scraper.py + resolvers/playimdb.py.
//
// The scraper builds a TMDB-keyed marker; the resolver hits the VidAPI stream
// API (streamdata.vaplayer.ru, keyed off the TMDB id) for a list of master.m3u8
// URLs and returns the first that actually answers #EXTM3U. The whole PlayIMDb
// ecosystem is Referer-gated on https://nextgencloudfabric.com/ — a static DNR
// rule covers the API host; a per-host session rule covers the rotating CDN. No
// player UI / ad code is ever loaded.

import { BaseScraper, BaseResolver } from './base.js';
import { addStreamRule } from '../proxy/dnr.js';

const MARKER = 'crimson-playimdb';
const STREAM_API = 'https://streamdata.vaplayer.ru/api.php';
const REFERER = 'https://nextgencloudfabric.com/';
const ORIGIN = 'https://nextgencloudfabric.com';

export class PlayimdbScraper extends BaseScraper {
  async searchAnime(ctx) {
    return ctx.tmdb_id != null ? String(ctx.tmdb_id) : null;
  }

  async getEpisodeEmbeds(slug, episodeNum, seasonNum = 1) {
    if (!slug) return [];
    return [`${MARKER}:tv:${slug}:${seasonNum}:${episodeNum}`];
  }
}

export class PlayimdbResolver extends BaseResolver {
  domainKeyword = MARKER;
  sourceName = 'PlayIMDb';

  async resolve(embedUrl) {
    // Marker: crimson-playimdb:{type}:{tmdb}:{season}:{episode}
    const parts = embedUrl.split(':');
    if (parts.length < 3 || parts[0] !== MARKER) return null;
    const mediaType = parts[1];
    const tmdb = parts[2];
    const season = parts[3] && /^\d+$/.test(parts[3]) ? parts[3] : null;
    const episode = parts[4] && /^\d+$/.test(parts[4]) ? parts[4] : null;

    const u = new URL(STREAM_API);
    u.searchParams.set('tmdb', tmdb);
    u.searchParams.set('type', mediaType);
    if (mediaType === 'tv' && season != null && episode != null) {
      u.searchParams.set('season', season);
      u.searchParams.set('episode', episode);
    }

    let data;
    try {
      const res = await fetch(u.toString()); // Referer set by the static DNR rule
      if (!res.ok) return null;
      data = await res.json();
    } catch {
      return null;
    }
    if (String(data?.status_code) !== '200') return null;
    const urls = (data?.data?.stream_urls || []).filter(
      (x) => typeof x === 'string' && x.startsWith('https://'),
    );
    if (!urls.length) return null;

    // Return the first master that actually answers #EXTM3U (links expire and the
    // CDN host rotates). Add the per-host Referer rule before probing each one.
    for (const url of urls) {
      await addStreamRule(url, { referer: REFERER, origin: ORIGIN });
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        if (text.trimStart().startsWith('#EXTM3U')) return { url, type: 'hls' };
      } catch {
        // try the next candidate
      }
    }
    return null;
  }
}
