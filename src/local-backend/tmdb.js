// TMDB access — direct port of api.py's fetch_tmdb_* helpers, calling
// api.themoviedb.org straight from the extension (host_permissions make this
// CORS-free). Uses the user's own token (see config.js): a v4 read token (JWT)
// goes in the Authorization: Bearer header like the backend did; a legacy v3 key
// falls back to the api_key query param.

import { getTmdbKey } from './config.js';
import { cached } from './cache.js';
import { getFirstAnilistIds } from './mapping.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';
const DAY = 24 * 60 * 60 * 1000;

export function tmdbImg(path, size = 'w500') {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

function isV4Token(key) {
  // v4 read tokens are JWTs (three dot-separated segments); v3 keys are 32 hex.
  return key.includes('.') || key.length > 40;
}

async function tmdbGet(path, params = {}) {
  const key = await getTmdbKey();
  if (!key) throw new Error('TMDB key not configured');
  const url = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const headers = { accept: 'application/json' };
  if (isV4Token(key)) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);

  // Light retry, mirroring fetch_with_retry's intent (transient 5xx/network).
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  console.warn('[tmdb] request failed:', path, lastErr);
  return null;
}

// --- fetch_tmdb_show -------------------------------------------------------
export async function fetchTmdbShow(tmdbId) {
  return cached(`tmdb:show:${tmdbId}`, DAY, async () => {
    const data = await tmdbGet(`/tv/${tmdbId}`);
    if (!data) return {};
    const seasons = [];
    for (const s of data.seasons || []) {
      const num = s.season_number;
      if (num == null || num < 1 || (s.episode_count || 0) < 1) continue;
      seasons.push({
        season_number: num,
        name: s.name || `Season ${num}`,
        episode_count: s.episode_count,
        air_date: s.air_date,
        poster: tmdbImg(s.poster_path),
        overview: s.overview,
      });
    }
    return {
      tmdb_id: tmdbId,
      title: data.name || data.original_name,
      overview: data.overview,
      poster_path: data.poster_path,
      backdrop_path: data.backdrop_path,
      poster: tmdbImg(data.poster_path),
      backdrop: tmdbImg(data.backdrop_path, 'original'),
      first_air_date: data.first_air_date,
      seasons,
    };
  });
}

// --- fetch_tmdb_metadata (one season) --------------------------------------
export async function fetchTmdbMetadata(tmdbId, season = 1, show = null) {
  return cached(`tmdb:meta:${tmdbId}:s${season}`, DAY, async () => {
    const data = await tmdbGet(`/tv/${tmdbId}/season/${season}`);
    if (!show) show = await fetchTmdbShow(tmdbId);
    if (!data) {
      return {
        summary: show.overview,
        poster: show.poster,
        backdrop: show.backdrop,
        season_name: `Season ${season}`,
        air_date: null,
        episodes: [],
      };
    }
    const episodes = (data.episodes || []).map((ep) => ({
      episode_number: ep.episode_number,
      title: ep.name || `Episode ${ep.episode_number}`,
      thumbnail: tmdbImg(ep.still_path),
      overview: ep.overview,
      air_date: ep.air_date,
      url: null,
    }));
    return {
      summary: data.overview || show.overview,
      poster: tmdbImg(data.poster_path) || show.poster,
      backdrop: show.backdrop,
      season_name: data.name || `Season ${season}`,
      air_date: data.air_date,
      episodes,
    };
  });
}

// --- fetch_tmdb_search_results ---------------------------------------------
export async function searchTmdb(query, limit = 10) {
  return cached(`tmdb:search:${query.toLowerCase()}`, DAY, async () => {
    const data = await tmdbGet('/search/tv', { query, include_adult: 'false' });
    if (!data) return [];
    const items = (data.results || []).slice(0, limit);
    const anilistByTmdb = await getFirstAnilistIds(items.map((i) => i.id).filter(Boolean));
    const results = [];
    for (const item of items) {
      const anilistId = item.id ? anilistByTmdb.get(item.id) : null;
      if (!anilistId) continue;
      results.push({
        title: item.name || item.original_name,
        tmdb_id: item.id,
        anilist_id: anilistId,
        poster: item.poster_path ? `${IMG_BASE}/w500${item.poster_path}` : null,
        year: item.first_air_date ? item.first_air_date.slice(0, 4) : null,
        vote_average: item.vote_average,
      });
    }
    return results;
  });
}

// --- fetch_trending_anime --------------------------------------------------
export async function trendingAnime(limit = 12) {
  return cached(`tmdb:trending:${limit}`, 6 * 60 * 60 * 1000, async () => {
    const data = await tmdbGet('/discover/tv', {
      page: 1,
      include_adult: 'false',
      language: 'en-US',
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
      'vote_count.gte': 100,
    });
    if (!data) return [];
    const items = (data.results || []).slice(0, limit);
    const anilistByTmdb = await getFirstAnilistIds(items.map((i) => i.id).filter(Boolean));
    const out = [];
    for (const item of items) {
      const anilistId = item.id ? anilistByTmdb.get(item.id) : null;
      if (!anilistId) continue;
      out.push({
        title: item.name || item.original_name,
        tmdb_id: item.id,
        anilist_id: anilistId,
        poster: item.poster_path ? `${IMG_BASE}/w500${item.poster_path}` : null,
        year: item.first_air_date ? item.first_air_date.slice(0, 4) : null,
        vote_average: item.vote_average,
      });
    }
    return out;
  });
}
