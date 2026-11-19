import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// The open season lives in the URL, so "Back to Overview" and the browser's back
// button both land on the season you were watching instead of the first one.
export function useSeasonParam() {
  const [params, setParams] = useSearchParams();
  const season = Number.parseInt(params.get('season') ?? '', 10);
  const setSeason = useCallback(
    (n) => setParams((p) => { p.set('season', String(n)); return p; }, { replace: true }),
    [setParams],
  );
  return [Number.isNaN(season) ? null : season, setSeason];
}

// Each season of a multi-season anime has its own AniList id, and links from
// Discover, watchlists or history open the overview by that id, so it should open
// on that season rather than season 1.
export function pickSeason(seasons, requested, anilistId = null) {
  const list = seasons || [];
  const chosen = list.find((s) => s.season_number === requested)
    ?? (anilistId != null ? list.find((s) => s.anilist_id === anilistId) : undefined)
    ?? list[0];
  return chosen?.season_number ?? null;
}

// Watch pages hold the season as a route string, possibly absent.
export function overviewSeasonUrl(path, season) {
  const n = Number.parseInt(season, 10);
  return Number.isNaN(n) ? path : `${path}?season=${n}`;
}
