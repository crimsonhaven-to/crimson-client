// Local favorites + watch progress, replacing the backend's Postgres account
// tables. Stored in chrome.storage.local; the item-key scheme and the
// continue-watching / recent derivation mirror account_engine (db.py + routes.py)
// so the frontend's useAccount hook works unchanged.

import { storageGet, storageSet } from './config.js';

const FAV_KEY = 'crimson_favorites';
const PROG_KEY = 'crimson_progress';

const nowIso = () => new Date().toISOString();

function favItemKey(tmdbId, anilistId) {
  return anilistId != null ? `anilist:${anilistId}` : `tmdb:${tmdbId}`;
}

function progItemKey(tmdbId, anilistId, season, episode) {
  let base = anilistId != null ? `anilist:${anilistId}` : `tmdb:${tmdbId}`;
  if (season != null) base += `:s${season}`;
  if (episode != null) base += `:e${episode}`;
  return base;
}

// --- favorites -------------------------------------------------------------
export async function listFavorites() {
  const favs = (await storageGet(FAV_KEY, [])) || [];
  return [...favs].sort((a, b) => (b.added_at || '').localeCompare(a.added_at || ''));
}

export async function upsertFavorite(fav) {
  const item_key = favItemKey(fav.tmdb_id, fav.anilist_id);
  const favs = (await storageGet(FAV_KEY, [])) || [];
  const existing = favs.find((f) => f.item_key === item_key);
  const row = {
    item_key,
    tmdb_id: fav.tmdb_id ?? null,
    anilist_id: fav.anilist_id ?? null,
    season_number: fav.season_number ?? null,
    media_type: fav.media_type ?? null,
    title: fav.title ?? null,
    poster: fav.poster ?? null,
    added_at: existing?.added_at || nowIso(),
  };
  const next = existing
    ? favs.map((f) => (f.item_key === item_key ? row : f))
    : [...favs, row];
  await storageSet(FAV_KEY, next);
  return row;
}

export async function removeFavorite({ tmdb_id, anilist_id, item_key }) {
  const key = item_key || favItemKey(tmdb_id, anilist_id);
  const favs = (await storageGet(FAV_KEY, [])) || [];
  const next = favs.filter((f) => f.item_key !== key);
  await storageSet(FAV_KEY, next);
  return next.length !== favs.length;
}

// --- watch progress --------------------------------------------------------
function resolveStatus(body) {
  if (body.status === 'in_progress' || body.status === 'completed') return body.status;
  const pos = body.position_seconds || 0;
  const dur = body.duration_seconds || 0;
  if (pos && dur > 0 && pos / dur >= 0.9) return 'completed';
  return 'in_progress';
}

export async function listProgress(status) {
  const prog = (await storageGet(PROG_KEY, {})) || {};
  let rows = Object.values(prog);
  if (status) rows = rows.filter((r) => r.status === status);
  return rows.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export async function upsertProgress(body) {
  const item_key = progItemKey(
    body.tmdb_id, body.anilist_id, body.season_number, body.episode_number,
  );
  const prog = (await storageGet(PROG_KEY, {})) || {};
  const row = {
    item_key,
    tmdb_id: body.tmdb_id ?? null,
    anilist_id: body.anilist_id ?? null,
    season_number: body.season_number ?? null,
    episode_number: body.episode_number ?? null,
    position_seconds: body.position_seconds ?? null,
    duration_seconds: body.duration_seconds ?? null,
    status: resolveStatus(body),
    title: body.title ?? null,
    poster: body.poster ?? null,
    updated_at: nowIso(),
  };
  prog[item_key] = row;
  await storageSet(PROG_KEY, prog);
  return row;
}

// Collapse progress rows to one per show, newest-first (account_engine _dedup_by_show).
function dedupByShow(rows, limit) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const showKey = row.anilist_id != null ? `anilist:${row.anilist_id}` : `tmdb:${row.tmdb_id}`;
    if (seen.has(showKey)) continue;
    seen.add(showKey);
    out.push(row);
    if (limit != null && out.length >= limit) break;
  }
  return out;
}

export async function continueWatching() {
  return dedupByShow(await listProgress('in_progress'));
}

export async function recent(limit = 20) {
  return dedupByShow(await listProgress(), limit);
}

export async function accountMe() {
  const favs = await listFavorites();
  const prog = await listProgress();
  return {
    success: true,
    public_key: null,
    email: null,
    label: 'Local',
    favorites_count: favs.length,
    progress_count: prog.length,
  };
}
