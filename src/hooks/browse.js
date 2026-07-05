// --- Per-type browse hubs ---------------------------------------------------
// The data layer for the Shows / Movies / Manga browse hubs, the discovery twins
// of useCatalogue (anime) and useLocalLibrary (local). Shows + movies are served
// whole from the backend's local TMDB tables (/catalogue/shows|movies) and cached
// like useCatalogue; manga is live + paginated (/catalogue/manga has no local
// table), so useMangaCatalogue drives page/sort/genre and appends pages.
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from './apiClient';
import { memGet, memSet } from './memCache';

// Shared shape for the two local (full-list) catalogues. `listKey` is the item
// array field the endpoint returns ('shows' | 'movies'); `cacheKey` is its
// memCache slot. Mirrors useCatalogue: seed from cache, skip the fetch when warm.
function useLocalCatalogue(path, listKey, cacheKey) {
  const empty = { items: [], genres: [], total: 0 };
  const [data, setData] = useState(() => memGet(cacheKey) || empty);
  const [loading, setLoading] = useState(() => !memGet(cacheKey));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (memGet(cacheKey)) return; // already seeded from cache
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        if (body.success) {
          const next = {
            items: body[listKey] || [],
            genres: body.genres || [],
            total: body.total || 0,
          };
          setData(next);
          memSet(cacheKey, next);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [path, listKey, cacheKey]);

  return { ...data, loading, error };
}

// Full non-anime TV-show catalogue → { items, genres, total, loading, error }.
export function useShowsCatalogue() {
  return useLocalCatalogue('/catalogue/shows', 'shows', 'catalogue-shows');
}

// Full general-movie catalogue → { items, genres, total, loading, error }.
export function useMoviesCatalogue() {
  return useLocalCatalogue('/catalogue/movies', 'movies', 'catalogue-movies');
}

// Shared sort control for the live AniList browse hubs (anime + manga). The
// tokens map to AniList MediaSort enums on the backend (_MEDIA_SORTS).
export const CATALOGUE_SORTS = [
  { value: 'trending', label: 'Trending' },
  { value: 'popular', label: 'Popular' },
  { value: 'score', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'title', label: 'A–Z' },
];
// Back-compat alias for the earlier MangaHub import.
export const MANGA_SORTS = CATALOGUE_SORTS;

// Generic paginated browse over a live AniList catalogue endpoint. `path` is the
// endpoint (/catalogue/anime | /catalogue/manga), `listKey` the item array field
// it returns ('animes' | 'manga'). Re-fetches page 1 whenever genre/sort change;
// `loadMore` appends the next page. The accumulated list (per path+genre+sort) is
// memCached so returning to the hub restores what you'd scrolled.
function usePaginatedBrowse({ path, listKey, genre = null, sort = 'trending' }) {
  const cacheKey = `${path}:${genre || 'all'}:${sort}`;
  const seed = memGet(cacheKey);
  const [items, setItems] = useState(() => seed?.items || []);
  const [genres, setGenres] = useState(() => seed?.genres || []);
  const [total, setTotal] = useState(() => seed?.total || 0);
  const [page, setPage] = useState(() => seed?.page || 0);
  const [hasNext, setHasNext] = useState(() => seed?.hasNext ?? true);
  const [loading, setLoading] = useState(() => !seed);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  // Guards against a stale in-flight response landing after a genre/sort switch.
  const reqRef = useRef(0);
  // Latest accumulated list, read by the append path. fetchPage is keyed only by
  // path/genre/sort (so loadMore doesn't rebuild every page and re-trigger the
  // reset effect), so it can't close over the freshest `items` — the ref bridges
  // that: appending to itemsRef.current instead of the (stale) closed-over items.
  const itemsRef = useRef(seed?.items || []);
  const setList = useCallback((list) => { itemsRef.current = list; setItems(list); }, []);

  const fetchPage = useCallback(async (nextPage, replace) => {
    const token = ++reqRef.current;
    if (replace) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort, page: String(nextPage) });
      if (genre) params.set('genre', genre);
      const res = await apiFetch(`${path}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (token !== reqRef.current) return; // superseded by a newer request
      if (body.success) {
        const base = replace ? [] : itemsRef.current;
        const merged = [...base, ...(body[listKey] || [])];
        setList(merged);
        setGenres(body.genres || []);
        setTotal(body.total || 0);
        setPage(body.page || nextPage);
        setHasNext(!!body.has_next);
        memSet(cacheKey, {
          items: merged, genres: body.genres || [], total: body.total || 0,
          page: body.page || nextPage, hasNext: !!body.has_next,
        });
      }
    } catch (e) {
      if (token === reqRef.current) setError(e.message);
    } finally {
      if (token === reqRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [path, listKey, genre, sort, cacheKey, setList]);

  // (Re)load page 1 when genre/sort change — unless the cache already has it.
  useEffect(() => {
    const cached = memGet(cacheKey);
    if (cached) {
      setList(cached.items); setGenres(cached.genres); setTotal(cached.total);
      setPage(cached.page); setHasNext(cached.hasNext); setLoading(false);
      return;
    }
    fetchPage(1, true);
  }, [cacheKey, fetchPage, setList]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasNext) return;
    fetchPage(page + 1, false);
  }, [loading, loadingMore, hasNext, page, fetchPage]);

  return { items, genres, total, hasNext, loading, loadingMore, error, loadMore };
}

// Manga browse hub: live AniList, paginated (see usePaginatedBrowse).
export function useMangaCatalogue({ genre = null, sort = 'trending' } = {}) {
  return usePaginatedBrowse({ path: '/catalogue/manga', listKey: 'manga', genre, sort });
}

// Anime "Discover" browse — the fast, paginated, poster-rich default view of the
// Anime hub (the full local /catalogue archive stays a secondary view).
export function useAnimeCatalogue({ genre = null, sort = 'trending' } = {}) {
  return usePaginatedBrowse({ path: '/catalogue/anime', listKey: 'animes', genre, sort });
}
