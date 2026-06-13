// Aniworld scraper — discovery layer for the VOE / Vidmoly sources. Port of
// scrapers/aniworld_scraper.py.
//
// aniworld.to (a German s.to-family site) is searched by title -> slug, then the
// episode page's hoster <li> list is read and each supported hoster's
// /redirect/<id> is followed to its real embed URL (voe.sx, vidmoly.net, …). The
// VoeResolver / VidmolyResolver (matched by keyword) extract the stream from
// there, exactly as on the backend. aniworld is purely discovery here.

import { parse } from 'node-html-parser';
import { BaseScraper } from './base.js';

const BASE_URL = 'https://aniworld.to';

// data-lang-key: 1 German Dub, 2 English Sub, 3 German Sub. Preference order
// (subbed over dubbed, English over German) decides which stream lands first.
const LANG_PREFERENCE = [2, 3, 1];
const LANG_LABELS = { 1: 'German Dub', 2: 'English Sub', 3: 'German Sub' };
const SUPPORTED_HOSTERS = { VOE: 'voe', Vidmoly: 'vidmoly' };

const STOPWORDS = new Set(['the', 'a', 'an']);
const SEQUEL_MARKERS = new Set([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  '1st', '2nd', '3rd', '4th', '5th', '6th', 'season', 'part', 'cour',
]);

// Minimal HTML-entity decode (titles are mostly ASCII; covers the common ones).
function decodeHtml(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function stripDiacritics(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function normalize(text) {
  let t = decodeHtml(text || '');
  t = t.replace(/<[^>]+>/g, '');
  t = stripDiacritics(t);
  t = t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return t;
}

function slugify(text) {
  let t = decodeHtml(text || '');
  t = stripDiacritics(t).toLowerCase().replace(/'/g, '').replace(/&/g, ' ');
  t = t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return t;
}

function seriesRoot(normTitle) {
  const words = normTitle.split(' ').filter(Boolean);
  while (words.length && (/^\d+$/.test(words[words.length - 1]) || SEQUEL_MARKERS.has(words[words.length - 1]))) {
    words.pop();
  }
  const root = words.join(' ');
  return root.length >= 3 ? root : '';
}

export class AniworldScraper extends BaseScraper {
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

    for (const keyword of this._searchKeywords(candidates)) {
      const slug = await this._searchViaAjax(keyword, normCandidates);
      if (slug) return slug;
    }
    for (const candidate of candidates) {
      const slug = slugify(candidate);
      if (slug && (await this._showExists(slug))) return slug;
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
      add(seriesRoot(normBase));
    }
    return keywords.slice(0, 6);
  }

  async _searchViaAjax(keyword, normCandidates) {
    let results;
    try {
      const res = await fetch(`${BASE_URL}/ajax/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: new URLSearchParams({ keyword }).toString(),
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text.trim()) return null; // empty body = no results
      results = JSON.parse(text);
    } catch {
      return null;
    }
    if (!Array.isArray(results)) return null;

    const shows = [];
    for (const item of results) {
      const link = item.link || '';
      const m = link.match(/^\/anime\/stream\/([a-z0-9-]+)$/);
      if (m) shows.push([normalize(item.title || ''), m[1]]);
    }
    for (const [normTitle, slug] of shows) {
      if (normCandidates.has(normTitle)) return slug;
    }
    for (const [normTitle, slug] of shows) {
      for (const candidate of normCandidates) {
        if (candidate.length >= 5 && (normTitle.startsWith(candidate) || candidate.startsWith(normTitle))) {
          return slug;
        }
      }
    }
    return null;
  }

  async _showExists(slug) {
    try {
      const res = await fetch(`${BASE_URL}/anime/stream/${slug}`);
      if (!res.ok) return false;
      const text = await res.text();
      return text.includes(`/anime/stream/${slug}/staffel-`);
    } catch {
      return false;
    }
  }

  async getEpisodeEmbeds(slug, episodeNum, seasonNum = 1) {
    seasonNum = seasonNum || 1;
    const episodeUrl = `${BASE_URL}/anime/stream/${slug}/staffel-${seasonNum}/episode-${episodeNum}`;
    let htmlText;
    try {
      const res = await fetch(episodeUrl);
      if (!res.ok) return [];
      htmlText = await res.text();
    } catch {
      return [];
    }

    const hosters = this._parseHosters(htmlText);
    if (!hosters.length) return [];
    hosters.sort((a, b) => this._langRank(a.lang) - this._langRank(b.lang));

    const resolved = await Promise.all(hosters.map((h) => this._resolveRedirect(h.redirect)));
    const embeds = [];
    const seen = new Set();
    for (let i = 0; i < resolved.length; i++) {
      const url = resolved[i];
      if (url && !seen.has(url)) {
        seen.add(url);
        embeds.push({ url, language: LANG_LABELS[hosters[i].lang] || null });
      }
    }
    return embeds;
  }

  _langRank(lang) {
    const idx = LANG_PREFERENCE.indexOf(lang);
    return idx === -1 ? LANG_PREFERENCE.length : idx;
  }

  _parseHosters(htmlText) {
    const root = parse(htmlText);
    const hosters = [];
    for (const li of root.querySelectorAll('li[data-link-target]')) {
      const target = li.getAttribute('data-link-target') || '';
      if (!target.includes('/redirect/')) continue;
      const nameNode = li.querySelector('h4');
      const name = nameNode ? nameNode.text.trim() : '';
      if (!(name in SUPPORTED_HOSTERS)) continue;
      const lang = parseInt(li.getAttribute('data-lang-key') || '0', 10) || 0;
      hosters.push({ redirect: new URL(target, BASE_URL).href, lang, name });
    }
    return hosters;
  }

  async _resolveRedirect(redirectUrl) {
    // aniworld 301s /redirect/<id> to the hoster; following it lands on the real
    // embed URL (res.url). The Referer aniworld needs is set by a static DNR rule.
    try {
      const res = await fetch(redirectUrl, { redirect: 'follow' });
      if (res && res.url && !res.url.includes('/redirect/')) return res.url;
    } catch {
      // ignore
    }
    return null;
  }
}
