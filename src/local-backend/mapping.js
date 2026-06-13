// AniList <-> TMDB(season) mapping, ported from metadata_engine/db_handler.py.
//
// The backend synced Fribb's anime-lists into Postgres on a schedule; here we do
// the same grouping in the browser and cache the *derived* id-rows in
// chrome.storage (unlimitedStorage). We only need the id grouping — season/episode
// titles come from the live TMDB/AniList fetches the metadata layer already does,
// so the slow per-id AniList title enrichment the backend ran is unnecessary here.
//
// Source of truth and algorithm match db_handler.MappingDatabaseEngine:
//   * group Fribb entries by TMDB tv id
//   * one AniList id per (tmdb_id, season_number>=1); prefer a TV entry, then the
//     lowest AniList id; everything else (specials/OVAs/movies, collision losers)
//     becomes an "extra" tied to the show
//   * a show with no season>=1 slot but a TV entry -> that becomes season 1

import { storageGet, storageSet } from './config.js';

const MAPPING_URL =
  'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json';
const STORE_KEY = 'crimson_fribb_maps';
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // background-refresh weekly

// In-memory indexes built from the derived rows (see _buildIndexes).
let _maps = null;
let _loading = null;

function safeInt(value) {
  if (value === null || value === undefined) return null;
  let v = value;
  if (typeof v === 'string' && v.includes('.')) v = v.split('.')[0];
  const n = parseInt(String(v).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function tmdbTvId(item) {
  const raw = item.themoviedb_id;
  if (raw && typeof raw === 'object') return safeInt(raw.tv);
  return safeInt(raw);
}

function tmdbSeason(item) {
  const s = item.season;
  if (s && typeof s === 'object') return safeInt(s.tmdb);
  return safeInt(s);
}

// Prefer a real TV entry, then the lowest AniList id (db_handler._better).
function better(candidate, current) {
  if (!current) return true;
  const candTv = candidate.type === 'TV';
  const curTv = current.type === 'TV';
  if (candTv !== curTv) return candTv;
  return candidate.anilist_id < current.anilist_id;
}

// Port of sync_database_async steps 1-2: raw Fribb array -> {seasons, extras} rows.
// Exported for unit testing (mirrors db_handler's grouping); not used elsewhere.
export function buildRows(animeData) {
  const groups = new Map(); // tmdb_id -> entries[]
  for (const item of animeData) {
    const anilistId = safeInt(item.anilist_id);
    const tmdbId = tmdbTvId(item);
    if (!anilistId || !tmdbId) continue;
    if (!groups.has(tmdbId)) groups.set(tmdbId, []);
    groups.get(tmdbId).push({
      anilist_id: anilistId,
      season_number: tmdbSeason(item),
      type: (item.type || 'TV').toUpperCase(),
    });
  }

  const seasons = []; // [tmdb_id, season_number, anilist_id]
  const extras = []; // [tmdb_id, anilist_id, anime_type]

  for (const [tmdbId, items] of groups) {
    const chosen = new Map(); // season_number -> entry
    const leftovers = [];
    for (const entry of items) {
      const snum = entry.season_number;
      if (snum !== null && snum >= 1) {
        if (better(entry, chosen.get(snum))) {
          if (chosen.has(snum)) leftovers.push(chosen.get(snum));
          chosen.set(snum, entry);
        } else {
          leftovers.push(entry);
        }
      } else {
        leftovers.push(entry);
      }
    }
    // Fallback: no season>=1 slot but a TV entry -> make it season 1.
    if (chosen.size === 0) {
      const tvEntries = leftovers.filter((e) => e.type === 'TV');
      if (tvEntries.length) {
        const best = tvEntries.reduce((a, b) => (b.anilist_id < a.anilist_id ? b : a));
        chosen.set(1, best);
        leftovers.splice(leftovers.indexOf(best), 1);
      }
    }
    for (const [snum, entry] of chosen) seasons.push([tmdbId, snum, entry.anilist_id]);
    for (const entry of leftovers) extras.push([tmdbId, entry.anilist_id, entry.type]);
  }

  return { seasons, extras };
}

export function buildIndexes({ seasons, extras }) {
  const seasonByKey = new Map(); // `${tmdb}:${season}` -> anilist
  const anilistToSeason = new Map(); // anilist -> [tmdb, season]
  const showSeasons = new Map(); // tmdb -> [{season_number, anilist_id}]
  const firstAnilistByTmdb = new Map(); // tmdb -> lowest-season anilist
  const extrasByTmdb = new Map(); // tmdb -> [{anilist_id, anime_type}]
  const anilistToTmdbAny = new Map(); // anilist -> tmdb (season first, then extra)

  // seasons already roughly ordered by tmdb; sort each show's seasons ascending.
  const seasonsByTmdb = new Map();
  for (const [tmdb, season, anilist] of seasons) {
    seasonByKey.set(`${tmdb}:${season}`, anilist);
    anilistToSeason.set(anilist, [tmdb, season]);
    anilistToTmdbAny.set(anilist, tmdb);
    if (!seasonsByTmdb.has(tmdb)) seasonsByTmdb.set(tmdb, []);
    seasonsByTmdb.get(tmdb).push({ season_number: season, anilist_id: anilist });
  }
  for (const [tmdb, list] of seasonsByTmdb) {
    list.sort((a, b) => a.season_number - b.season_number);
    showSeasons.set(tmdb, list);
    firstAnilistByTmdb.set(tmdb, list[0].anilist_id);
  }
  for (const [tmdb, anilist, type] of extras) {
    if (!extrasByTmdb.has(tmdb)) extrasByTmdb.set(tmdb, []);
    extrasByTmdb.get(tmdb).push({ anilist_id: anilist, anime_type: type });
    if (!anilistToTmdbAny.has(anilist)) anilistToTmdbAny.set(anilist, tmdb);
  }

  return {
    seasonByKey,
    anilistToSeason,
    showSeasons,
    firstAnilistByTmdb,
    extrasByTmdb,
    anilistToTmdbAny,
  };
}

async function downloadAndBuild() {
  const res = await fetch(MAPPING_URL);
  if (!res.ok) throw new Error(`Fribb download ${res.status}`);
  const etag = res.headers.get('ETag') || String(Date.now());
  const animeData = await res.json();
  const rows = buildRows(animeData);
  await storageSet(STORE_KEY, { etag, builtAt: Date.now(), ...rows });
  return rows;
}

// Public: ensure the in-memory indexes exist. Uses the cached derived rows if
// present (instant); otherwise downloads + builds once. A weekly background
// refresh keeps it current without blocking startup.
export async function ensureMaps() {
  if (_maps) return _maps;
  if (_loading) return _loading;
  _loading = (async () => {
    let rows = await storageGet(STORE_KEY, null);
    if (!rows || !rows.seasons) {
      rows = await downloadAndBuild();
    } else if (Date.now() - (rows.builtAt || 0) > REFRESH_AFTER_MS) {
      // Stale — serve the cache now, refresh in the background.
      downloadAndBuild()
        .then((fresh) => { _maps = buildIndexes(fresh); })
        .catch((e) => console.warn('[mapping] background refresh failed:', e));
    }
    _maps = buildIndexes(rows);
    return _maps;
  })();
  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

// --- public lookups (mirror api.py's DB helpers) ---------------------------

// get_anilist_id(tmdb_id, season_number)
export async function getAnilistId(tmdbId, season) {
  const m = await ensureMaps();
  return m.seasonByKey.get(`${tmdbId}:${season}`) ?? null;
}

// get_tmdb_season(anilist_id) -> [tmdb_id, season_number|null]
export async function getTmdbSeason(anilistId) {
  const m = await ensureMaps();
  const hit = m.anilistToSeason.get(anilistId);
  if (hit) return hit;
  const tmdb = m.anilistToTmdbAny.get(anilistId);
  return tmdb ? [tmdb, null] : null;
}

// get_show_seasons(tmdb_id) -> [{season_number, anilist_id}]
export async function getShowSeasons(tmdbId) {
  const m = await ensureMaps();
  return m.showSeasons.get(tmdbId) || [];
}

// get_show_extras(tmdb_id) -> [{anilist_id, anime_type}]
export async function getShowExtras(tmdbId) {
  const m = await ensureMaps();
  return m.extrasByTmdb.get(tmdbId) || [];
}

// get_first_anilist_ids([tmdb_id]) -> Map(tmdb_id -> anilist_id)
export async function getFirstAnilistIds(tmdbIds) {
  const m = await ensureMaps();
  const out = new Map();
  for (const id of tmdbIds) {
    const a = m.firstAnilistByTmdb.get(id);
    if (a) out.set(id, a);
  }
  return out;
}

// Synchronous reverse lookup (anilist -> its tmdb id). Requires ensureMaps() to
// have run; used by the catalogue builder which awaits ensureMaps first.
export function firstAnilistToTmdb(anilistId) {
  if (!_maps) return null;
  return _maps.anilistToTmdbAny.get(anilistId) ?? null;
}
