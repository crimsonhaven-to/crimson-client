// Anime discovery + overview hooks: the per-anime overview page, trending, the
// health probe, the full catalogue, and the document-title helper. Lifted verbatim
// from hooks.js.
import { useEffect, useRef, useState } from 'react';

import { apiFetch } from './apiClient';
import { memGet, memSet } from './memCache';

// --- Per-anime overview page -------------------------------------------------
// Fetches the aggregated /overview payload (show metadata + season list + extras)
// in one round-trip, then lazily loads the episode list for whichever season is
// active via /info (so we don't pull every season's episodes up front). Episode
// lists are memoised per (tmdb_id, season) so flipping back to a season is
// instant. This is what powers the new Overview page that sits between picking a
// show and actually watching an episode.
export function useAnimeOverview(anilistId) {
  const [overview, setOverview] = useState(() => (anilistId ? memGet(`overview:${anilistId}`) : null));
  const [loading, setLoading] = useState(() => !(anilistId && memGet(`overview:${anilistId}`)));
  const [error, setError] = useState(null);

  // Active season + its episodes.
  const [activeSeason, setActiveSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const episodeCache = useRef(new Map());

  // Load the show overview shell.
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

  // Load episodes for the active season (lazily, cached per season).
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
  // Seed from the in-memory cache so a remount within the TTL paints instantly
  // and skips the fetch (no setState in the effect body).
  const [trendingAnimes, setTrendingAnimes] = useState(() => memGet('trending') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending'));

  useEffect(() => {
    if (memGet('trending')) return; // already seeded from cache
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

export function useHealthStatus() {
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);

  useEffect(() => {
    apiFetch(`/health`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch(e => setHealthError(e.message))
      .finally(() => setHealthLoading(false));
  }, []);

  return { health, healthLoading, healthError };
}

export function useCatalogue() {
  // Seed from the in-memory cache so a remount within the TTL paints instantly
  // and skips the fetch (no setState in the effect body).
  const [catalogue, setCatalogue] = useState(() => memGet('catalogue') || { animes: [], categories: [], genres: [], total: 0 });
  const [loading, setLoading] = useState(() => !memGet('catalogue'));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (memGet('catalogue')) return; // already seeded from cache
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

export function useTitle(title) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} | Crimsonhaven` : 'Crimsonhaven | Your Anime Sanctuary';
    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}
