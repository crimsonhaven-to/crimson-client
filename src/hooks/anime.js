import { useEffect, useRef, useState } from 'react';

import { apiFetch } from './apiClient';
import { memGet, memSet } from './memCache';

// Episodes load lazily per active season rather than all up front, and are
// memoised so flipping back to a season is instant.
export function useAnimeOverview(anilistId) {
  const [overview, setOverview] = useState(() => (anilistId ? memGet(`overview:${anilistId}`) : null));
  const [loading, setLoading] = useState(() => !(anilistId && memGet(`overview:${anilistId}`)));
  const [error, setError] = useState(null);

  const [activeSeason, setActiveSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const episodeCache = useRef(new Map());

  useEffect(() => {
    if (!anilistId) return;
    const cached = memGet(`overview:${anilistId}`);
    if (cached) {
      setOverview(cached);
      setActiveSeason(cached.seasons?.[0]?.season_number ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(`/overview/${anilistId}`);
        if (!res.ok) throw new Error(`Failed to load overview (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`overview:${anilistId}`, data);
        setActiveSeason(data.seasons?.[0]?.season_number ?? null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [anilistId]);

  useEffect(() => {
    if (!overview || activeSeason == null) return;
    const season = overview.seasons?.find(s => s.season_number === activeSeason);
    if (!season) { setEpisodes([]); return; }

    const cacheKey = `${season.tmdb_id}:${season.tmdb_season}`;
    if (episodeCache.current.has(cacheKey)) {
      setEpisodes(episodeCache.current.get(cacheKey));
      return;
    }

    let cancelled = false;
    setEpisodesLoading(true);
    setEpisodes([]);
    (async () => {
      try {
        const res = await apiFetch(`/info/${season.tmdb_id}?season=${season.tmdb_season}`);
        if (!res.ok) throw new Error(`Failed to load episodes (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data.episodes_list) ? data.episodes_list : [];
        episodeCache.current.set(cacheKey, list);
        setEpisodes(list);
      } catch (e) {
        if (!cancelled) { console.error('Episode list fetch failed:', e); setEpisodes([]); }
      } finally {
        if (!cancelled) setEpisodesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [overview, activeSeason]);

  return {
    overview, loading, error,
    activeSeason, setActiveSeason,
    episodes, episodesLoading,
  };
}

export function useTrendingAnime() {
  const [trendingAnimes, setTrendingAnimes] = useState(() => memGet('trending') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending'));

  useEffect(() => {
    if (memGet('trending')) return;
    const fetchTrending = async () => {
      setTrendLoading(true);
      try {
        const res = await apiFetch(`/trending`);
        if (!res.ok) throw new Error('Failed to fetch trending data.');
        const data = await res.json();
        if (data.success && Array.isArray(data.animes)) {
          setTrendingAnimes(data.animes);
          memSet('trending', data.animes);
        }
      } catch (e) {
        console.error('Error fetching trending anime:', e);
      } finally {
        setTrendLoading(false);
      }
    };
    fetchTrending();
  }, []);

  return { trendingAnimes, trendLoading };
}

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState(() => memGet('catalogue') || { animes: [], categories: [], genres: [], total: 0 });
  const [loading, setLoading] = useState(() => !memGet('catalogue'));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (memGet('catalogue')) return;
    const fetchCatalogue = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/catalogue`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          const next = {
            animes: data.animes || [],
            categories: data.categories || [],
            genres: data.genres || [],
            total: data.total || 0
          };
          setCatalogue(next);
          memSet('catalogue', next);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalogue();
  }, []);

  return { catalogue, loading, error };
}

