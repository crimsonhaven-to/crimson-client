// The local "backend": maps the exact API paths the frontend calls to local
// handlers, returning real Response objects (including a ReadableStream body for
// /watch NDJSON) so src/hooks.js works unchanged. Mirrors the FastAPI endpoints
// in api.py (shapes documented in the frontend API contract).

import { fetchTmdbShow, fetchTmdbMetadata, searchTmdb, trendingAnime } from './tmdb.js';
import { fetchAnilistMetadata, catalogueItems } from './anilist.js';
import {
  getAnilistId, getTmdbSeason, getShowSeasons, getShowExtras,
} from './mapping.js';
import { watchStream } from './watch.js';
import * as store from './storage.js';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const notFound = (detail) => json({ detail: detail || 'Not found' }, 404);

// _build_season_list: TMDB's real seasons + the AniList id mapped to each.
async function buildSeasonList(tmdbId, show) {
  const dbSeasons = new Map((await getShowSeasons(tmdbId)).map((s) => [s.season_number, s]));
  return (show.seasons || []).map((s) => ({
    season_number: s.season_number,
    anilist_id: dbSeasons.get(s.season_number)?.anilist_id ?? null,
    tmdb_id: tmdbId,
    tmdb_season: s.season_number,
    name: s.name,
    poster: s.poster || show.poster,
    summary: s.overview || show.overview,
    air_date: s.air_date,
    episode_count: s.episode_count,
    title_romaji: null,
    title_english: null,
    anime_type: null,
  }));
}

async function buildExtras(tmdbId) {
  return (await getShowExtras(tmdbId)).map((x) => ({
    anilist_id: x.anilist_id,
    anime_type: x.anime_type,
    title_romaji: null,
    title_english: null,
    start_year: null,
  }));
}

// --- metadata handlers -----------------------------------------------------
async function handleSearch(params) {
  const q = params.get('query_name') || '';
  const results = await searchTmdb(q);
  return json({ success: true, query: q, count: results.length, suggestions: results });
}

async function handleTrending(params) {
  const limit = Number(params.get('limit')) || 10;
  const animes = await trendingAnime(limit);
  return json({ success: true, count: animes.length, animes });
}

async function handleCatalogue(params) {
  const items = await catalogueItems();
  const counts = {};
  const genreCounts = {};
  for (const it of items) {
    counts[it.category] = (counts[it.category] || 0) + 1;
    for (const g of it.genres || []) genreCounts[g] = (genreCounts[g] || 0) + 1;
  }
  const categories = Object.keys(counts).sort().map((k) => ({ category: k, count: counts[k] }));
  const genres = Object.keys(genreCounts).sort().map((k) => ({ genre: k, count: genreCounts[k] }));

  let animes = items;
  const category = params.get('category');
  const genre = params.get('genre');
  if (category) {
    const wanted = category.trim().toUpperCase();
    animes = animes.filter((it) => (it.category || '').toUpperCase() === wanted);
  }
  if (genre) {
    const wantedG = genre.trim().toLowerCase();
    animes = animes.filter((it) => (it.genres || []).some((g) => g.toLowerCase() === wantedG));
  }
  return json({
    success: true, count: animes.length, total: items.length, categories, genres, animes,
  });
}

async function handleSeasons(anilistId) {
  const mapping = await getTmdbSeason(anilistId);
  if (!mapping) return notFound('AniList ID not mapped');
  const tmdbId = mapping[0];
  const [show, animeInfo] = await Promise.all([
    fetchTmdbShow(tmdbId),
    fetchAnilistMetadata(anilistId),
  ]);
  if (!show || !show.tmdb_id) return notFound('Show not found on TMDB');
  const seasons = await buildSeasonList(tmdbId, show);
  const title = (animeInfo || {}).title || show.title || 'Unknown Anime';
  return json({
    success: true,
    anilist_id: anilistId,
    title,
    total_seasons: seasons.length,
    seasons,
    extras: await buildExtras(tmdbId),
  });
}

async function handleOverview(anilistId) {
  const mapping = await getTmdbSeason(anilistId);
  if (!mapping) return notFound('AniList ID not mapped');
  const tmdbId = mapping[0];
  const [show, animeInfoRaw] = await Promise.all([
    fetchTmdbShow(tmdbId),
    fetchAnilistMetadata(anilistId),
  ]);
  if (!show || !show.tmdb_id) return notFound('Show not found on TMDB');
  const animeInfo = animeInfoRaw || {};
  const seasons = await buildSeasonList(tmdbId, show);
  const title = animeInfo.title || show.title || 'Unknown Anime';

  let year = null;
  if (show.first_air_date) year = show.first_air_date.slice(0, 4);
  else if (animeInfo.start_date?.year) year = String(animeInfo.start_date.year);

  return json({
    success: true,
    anilist_id: anilistId,
    tmdb_id: tmdbId,
    title,
    title_romaji: animeInfo.title_romaji,
    title_english: animeInfo.title_english,
    poster: animeInfo.cover || show.poster,
    backdrop: show.backdrop,
    banner: animeInfo.banner,
    description: animeInfo.description || show.overview,
    summary: show.overview,
    status: animeInfo.status,
    year,
    total_episodes: animeInfo.total_episodes,
    total_seasons: seasons.length,
    seasons,
    extras: await buildExtras(tmdbId),
  });
}

async function handleInfo(tmdbId, params) {
  const season = Number(params.get('season')) || 1;
  const anilistId = await getAnilistId(tmdbId, season);
  const show = await fetchTmdbShow(tmdbId);
  const [tmdbData, anilistData] = await Promise.all([
    fetchTmdbMetadata(tmdbId, season, show),
    anilistId ? fetchAnilistMetadata(anilistId) : Promise.resolve({}),
  ]);
  if ((!show || !show.tmdb_id) && !tmdbData && !anilistData) {
    return notFound(`No data for TMDB ID ${tmdbId} season ${season}`);
  }
  let availableSeasons = (show.seasons || []).map((s) => s.season_number);
  if (!availableSeasons.length) {
    availableSeasons = (await getShowSeasons(tmdbId)).map((s) => s.season_number);
  }
  const description = anilistData.description || tmdbData.summary || show.overview;
  const episodesList = (tmdbData.episodes && tmdbData.episodes.length)
    ? tmdbData.episodes
    : (anilistData.episodes_list || []);
  return json({
    ...tmdbData,
    ...anilistData,
    success: true,
    tmdb_id: tmdbId,
    anilist_id: anilistId,
    current_season: season,
    available_seasons: availableSeasons,
    description,
    summary: tmdbData.summary || show.overview,
    episodes_list: episodesList,
    title: anilistData.title || show.title,
  });
}

const streamHeaders = {
  'Content-Type': 'application/x-ndjson',
  'Cache-Control': 'no-cache',
};

// /watch/{tmdb_id}/{season}/{episode}
async function handleWatch3(tmdbId, season, episode) {
  const anilistId = await getAnilistId(tmdbId, season);
  let fallbackTitle = null;
  if (!anilistId) {
    const show = await fetchTmdbShow(tmdbId);
    fallbackTitle = show.title || null;
  }
  return new Response(watchStream(tmdbId, season, episode, anilistId, fallbackTitle), {
    headers: streamHeaders,
  });
}

// /watch/{anilist_id}/{episode}  (extras served directly; TV seasons resolved)
async function handleWatch2(anilistId, episode) {
  const mapping = await getTmdbSeason(anilistId);
  if (!mapping) return notFound('AniList ID not mapped');
  const [tmdbId, season] = mapping;
  if (season != null) return handleWatch3(tmdbId, season, episode);
  return new Response(watchStream(tmdbId, 1, episode, anilistId, null), { headers: streamHeaders });
}

// --- account handlers (local storage) --------------------------------------
async function handleAccount(segments, method, params, body) {
  const sub = segments[1];
  if (sub === 'me') return json(await store.accountMe());

  if (sub === 'favorites') {
    if (method === 'GET') {
      const favorites = await store.listFavorites();
      return json({ success: true, count: favorites.length, favorites });
    }
    if (method === 'POST') return json({ success: true, favorite: await store.upsertFavorite(body || {}) });
    if (method === 'DELETE') {
      const removed = await store.removeFavorite({
        tmdb_id: body?.tmdb_id ?? num(params.get('tmdb_id')),
        anilist_id: body?.anilist_id ?? num(params.get('anilist_id')),
        item_key: body?.item_key ?? params.get('item_key'),
      });
      return removed ? json({ success: true }) : notFound('Favorite not found');
    }
  }

  if (sub === 'progress') {
    if (method === 'GET') {
      const progress = await store.listProgress(params.get('status'));
      return json({ success: true, count: progress.length, progress });
    }
    if (method === 'POST') return json({ success: true, progress: await store.upsertProgress(body || {}) });
  }

  if (sub === 'continue-watching') {
    const items = await store.continueWatching();
    return json({ success: true, count: items.length, items });
  }
  if (sub === 'recent') {
    const items = await store.recent(Number(params.get('limit')) || 20);
    return json({ success: true, count: items.length, items });
  }
  return notFound();
}

const num = (v) => (v == null ? null : Number(v));

// --- dispatch --------------------------------------------------------------
export async function route(path, options = {}) {
  const u = new URL(path, 'http://local');
  const segments = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const params = u.searchParams;
  const method = (options.method || 'GET').toUpperCase();
  let body = null;
  if (options.body) {
    try { body = JSON.parse(options.body); } catch { /* non-JSON body */ }
  }

  try {
    const [root] = segments;
    if (u.pathname === '/' || root === '') return json({ version: '3.0.0-extension', message: 'Crimsonhaven, local.' });
    if (root === 'health') return json({ status: 'ok', mode: 'extension' });

    if (root === 'search' && segments[1] === 'anime') return handleSearch(params);
    if (root === 'trending') return handleTrending(params);
    if (root === 'catalogue') return handleCatalogue(params);
    if (root === 'seasons') return handleSeasons(Number(segments[1]));
    if (root === 'overview') return handleOverview(Number(segments[1]));
    if (root === 'info') return handleInfo(Number(segments[1]), params);
    if (root === 'account') return handleAccount(segments, method, params, body);

    if (root === 'watch') {
      if (segments.length === 4) return handleWatch3(Number(segments[1]), Number(segments[2]), Number(segments[3]));
      if (segments.length === 3) return handleWatch2(Number(segments[1]), Number(segments[2]));
    }

    return notFound();
  } catch (e) {
    console.error('[local-backend] route error:', path, e);
    return json({ detail: String(e?.message || e) }, 500);
  }
}
