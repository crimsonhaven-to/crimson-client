// Aniwatch scraper — discovery layer for the VidSrc (megaplay) source. Port of
// scrapers/aniwatch_scraper.py.
//
// aniwatch.co.at is a WordPress "Zoro-Tv" site. `?s=` search yields an
// episode-URL template (already carrying the right season slug); we swap in the
// requested episode number, read each `server-item`, and base64-decode the
// VidSrc server's `data-hash` into a megaplay embed URL. VidSrcResolver (matched
// on the `megaplay` token) extracts the stream from there.

import { parse } from 'node-html-parser';
import { BaseScraper } from './base.js';

const BASE_URL = 'https://aniwatch.co.at';
const LANG_LABELS = { sub: 'English Sub', dub: 'English Dub' };
const LANG_PREFERENCE = ['sub', 'dub'];
const SUPPORTED_SERVERS = new Set(['vidsrc']);
const STOPWORDS = new Set(['the', 'a', 'an']);

function decodeHtml(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
function stripDiacritics(s) { return s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); }
function normalize(text) {
  let t = decodeHtml(text || '');
  t = stripDiacritics(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return t;
}
function slugify(text) {
  let t = decodeHtml(text || '');
  t = stripDiacritics(t).toLowerCase().replace(/'/g, '').replace(/&/g, ' ');
  return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Loose base64 decode (handles missing padding / URL-safe alphabet).
function b64decodeLoose(s) {
  let t = (s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  try {
    const bin = atob(t);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return null;
  }
}

export class AniwatchScraper extends BaseScraper {
  async searchAnime(ctx) {
    const candidates = [];
    for (const key of ['title_english', 'title', 'title_romaji', 'title_native']) {
      const v = ctx[key];
      if (v && !candidates.includes(v)) candidates.push(v);
    }
    for (const syn of ctx.synonyms || []) {
      if (syn && !candidates.includes(syn)) candidates.push(syn);
    }
    if (!candidates.length) return null;

    const normCandidates = new Set(candidates.map(normalize));
    normCandidates.delete('');
    const season = ctx.tmdb_season || 1;

    for (const keyword of this._searchKeywords(candidates)) {
      const url = await this._searchViaQuery(keyword, normCandidates, season);
      if (url) return url;
    }
    for (const candidate of candidates) {
      const slug = slugify(candidate);
      if (!slug) continue;
      const probe = `${BASE_URL}/${slug}-episode-1-english-subbed/`;
      if (await this._pageHasServers(probe)) return probe;
    }
    return null;
  }

  _searchKeywords(candidates) {
    const keywords = [];
    const add = (v) => { if (v && !keywords.includes(v)) keywords.push(v); };
    for (const title of candidates) {
      const base = title.split(':')[0];
      const normBase = normalize(base);
      const words = normBase.split(' ').filter((w) => !STOPWORDS.has(w));
      add(normBase);
      add(words.slice(0, 3).join(' '));
      add(normalize(title));
    }
    return keywords.slice(0, 5);
  }

  async _searchViaQuery(keyword, normCandidates, season) {
    let htmlText;
    try {
      const res = await fetch(`${BASE_URL}/?s=${encodeURIComponent(keyword)}`);
      if (!res.ok) return null;
      htmlText = await res.text();
    } catch {
      return null;
    }
    const root = parse(htmlText);
    const matches = [];
    for (const node of root.querySelectorAll('h3.film-name a[href], .film-name a[href]')) {
      const href = node.getAttribute('href') || '';
      if (!href.includes('-episode-')) continue;
      const title = node.getAttribute('title') || node.text.trim();
      const jname = node.getAttribute('data-jname') || '';
      const normTitle = normalize(title);
      const normJname = normalize(jname);
      const exact = normCandidates.has(normTitle) || normCandidates.has(normJname);
      let loose = false;
      for (const c of normCandidates) {
        if (c.length >= 5 && (normTitle.startsWith(c) || c.startsWith(normTitle))) { loose = true; break; }
      }
      if (!exact && !loose) continue;
      const hrefSeason = this._seasonOf(href, title);
      const seasonScore = hrefSeason === season ? 2 : (exact ? 1 : 0);
      matches.push({ href, seasonScore, exact });
    }
    if (!matches.length) return null;
    matches.sort((a, b) => (b.seasonScore - a.seasonScore) || (b.exact - a.exact));
    return matches[0].href;
  }

  _seasonOf(href, title) {
    const blob = `${href} ${title}`.toLowerCase();
    const m = href.toLowerCase().match(/-season-(\d+)-/)
      || blob.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/)
      || blob.match(/\bseason\s+(\d+)\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) return n;
    }
    return 1;
  }

  async _pageHasServers(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      return (await res.text()).includes('server-item');
    } catch {
      return false;
    }
  }

  async getEpisodeEmbeds(template, episodeNum) {
    const episodeUrl = this._episodeUrl(template, episodeNum);
    if (!episodeUrl) return [];
    let htmlText;
    try {
      const res = await fetch(episodeUrl);
      if (!res.ok) return [];
      htmlText = await res.text();
    } catch {
      return [];
    }
    const servers = this._parseServers(htmlText);
    if (!servers.length) return [];
    servers.sort((a, b) => this._langRank(a.type) - this._langRank(b.type));

    const embeds = [];
    const seen = new Set();
    for (const server of servers) {
      if (server.url && !seen.has(server.url)) {
        seen.add(server.url);
        embeds.push({ url: server.url, language: LANG_LABELS[server.type] || null });
      }
    }
    return embeds;
  }

  _episodeUrl(template, episodeNum) {
    if (template.includes('-episode-')) {
      return template.replace(/-episode-\d+-/, `-episode-${episodeNum}-`);
    }
    const slug = template.replace(/\/+$/, '').split('/').pop();
    if (!slug) return null;
    return `${BASE_URL}/${slug}-episode-${episodeNum}-english-subbed/`;
  }

  _langRank(t) {
    const idx = LANG_PREFERENCE.indexOf(t);
    return idx === -1 ? LANG_PREFERENCE.length : idx;
  }

  _parseServers(htmlText) {
    const root = parse(htmlText);
    const servers = [];
    for (const div of root.querySelectorAll('div.server-item[data-hash]')) {
      const name = (div.getAttribute('data-server-name') || '').trim().toLowerCase();
      if (!SUPPORTED_SERVERS.has(name)) continue;
      const type = (div.getAttribute('data-type') || 'sub').trim().toLowerCase();
      const decoded = (b64decodeLoose(div.getAttribute('data-hash')) || '').trim();
      if (!decoded.startsWith('http://') && !decoded.startsWith('https://')) continue;
      servers.push({ url: decoded, type });
    }
    return servers;
  }
}
