// Deliberately parallel to the anime hooks rather than shared, so anime stays
// priority 1 and is never disturbed by show changes.
import { useCallback, useEffect, useRef, useState } from 'react';

import { clientSourcesEnabled, streamLocalSources } from '../clientSources';
import { apiFetch, useSessionToken } from './apiClient';
import { memGet, memSet } from './memCache';
import { getPlaybackPrefs } from './playbackPrefs';
import { streamWatchNdjson } from './ndjson';
import { mergeStreamLine, pickBestIdx } from './streamMerge';

export function useUnifiedSearch() {
  const [queryName, setQueryName] = useState('');
  const [results, setResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3) return;
    try {
      const [animeRes, showRes, movieRes, mangaRes, localRes] = await Promise.all([
        apiFetch(`/search/anime?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/search/shows?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/search/movies?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        // 503 when manga is disabled; the catch turns that into no rows.
        apiFetch(`/search/manga?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/search/local?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const anime = (animeRes?.suggestions || []).map(s => ({ ...s, kind: 'anime' }));
      const shows = (showRes?.suggestions || []).map(s => ({ ...s, kind: 'show' }));
      const movies = (movieRes?.suggestions || []).map(s => ({ ...s, kind: 'movie' }));
      const manga = (mangaRes?.suggestions || []).map(s => ({ ...s, kind: 'manga' }));
      // The operator's own library is the most relevant when present, and small.
      const local = (localRes?.suggestions || []).map(s => ({ ...s, kind: 'local' }));
      setResults([...local, ...anime, ...shows, ...movies, ...manga]);
    } catch (e) {
      console.error('Unified search failed:', e);
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (queryName.trim().length >= 3) {
      const t = setTimeout(() => fetchSuggestions(queryName), 300);
      return () => clearTimeout(t);
    }
    setResults([]);
    setShowSuggestions(false);
  }, [queryName, fetchSuggestions]);

  return { queryName, setQueryName, results, showSuggestions, setShowSuggestions };
}

export function useTrendingShows() {
  const [trendingShows, setTrendingShows] = useState(() => memGet('trending-shows') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending-shows'));

  useEffect(() => {
    if (memGet('trending-shows')) return;
    (async () => {
      setTrendLoading(true);
      try {
        const res = await apiFetch(`/trending/shows`);
        if (!res.ok) throw new Error('Failed to fetch trending shows.');
        const data = await res.json();
        if (data.success && Array.isArray(data.shows)) {
          setTrendingShows(data.shows);
          memSet('trending-shows', data.shows);
        }
      } catch (e) {
        console.error('Error fetching trending shows:', e);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, []);

  return { trendingShows, trendLoading };
}

export function useShowOverview(tmdbId) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`show-overview:${tmdbId}`) : null));
  const [loading, setLoading] = useState(() => !(tmdbId && memGet(`show-overview:${tmdbId}`)));
  const [error, setError] = useState(null);

  const [activeSeason, setActiveSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const episodeCache = useRef(new Map());

  useEffect(() => {
    if (!tmdbId) return;
    const cached = memGet(`show-overview:${tmdbId}`);
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
        const res = await apiFetch(`/show-overview/${tmdbId}`);
        if (!res.ok) throw new Error(`Failed to load overview (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`show-overview:${tmdbId}`, data);
        setActiveSeason(data.seasons?.[0]?.season_number ?? null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId]);

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

  return { overview, loading, error, activeSeason, setActiveSeason, episodes, episodesLoading };
}

// Rows come back newest-first, so the first match is the latest episode. Non-anime
// shows also require a null anilist_id, mirroring the backend dedup key.
export function useShowResume({ anilistId = null, tmdbId = null, mediaType = null } = {}) {
  const sessionToken = useSessionToken();
  const [resume, setResume] = useState(null);

  useEffect(() => {
    if (!sessionToken || (anilistId == null && tmdbId == null)) { setResume(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/account/progress`);
        if (!res.ok) return;
        const rows = (await res.json()).progress || [];
        const match = (r) => {
          if (anilistId != null) return String(r.anilist_id) === String(anilistId);
          // Movies share the TMDB id space with shows.
          if (mediaType === 'movie') return String(r.tmdb_id) === String(tmdbId) && r.media_type === 'movie';
          return String(r.tmdb_id) === String(tmdbId) && r.anilist_id == null && r.media_type !== 'movie';
        };
        const latest = rows.find(match) || null;
        if (!cancelled) setResume(latest);
      } catch { /* no banner on failure */ }
    })();
    return () => { cancelled = true; };
  }, [sessionToken, anilistId, tmdbId, mediaType]);

  return resume;
}

export function useShowStreamer(tmdbId, season, episode) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`show-overview:${tmdbId}`) : null));
  const [metadata, setMetadata] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [streamData, setStreamData] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  const [apiError, setApiError] = useState(null);
  const [unaired, setUnaired] = useState(null);

  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);
  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);

  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

  useEffect(() => {
    if (!tmdbId) return;
    const cached = memGet(`show-overview:${tmdbId}`);
    if (cached) { setOverview(cached); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/show-overview/${tmdbId}`);
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`show-overview:${tmdbId}`, data);
      } catch (e) {
        if (!cancelled) setApiError('Could not load show information');
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId]);

  useEffect(() => {
    if (!tmdbId || !season) return;
    let cancelled = false;
    setMetaLoading(true);
    setMetadata(null);
    (async () => {
      try {
        const res = await apiFetch(`/info/${tmdbId}?season=${season}`);
        if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setMetadata(data);
      } catch (e) {
        if (!cancelled) setApiError('Failed to load season data');
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId, season]);

  useEffect(() => {
    if (!tmdbId || !season || !episode) return;
    const controller = new AbortController();

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0);
    setUnaired(null);
    streamsRef.current = [];
    userPickedRef.current = false;

    const dedup = new Map();

    const handleLine = (line, origin = 'backend') => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try { msg = JSON.parse(trimmed); } catch { return; }

      if (msg.type === 'unaired') {
        setUnaired({ airDate: msg.air_date });
        setStreamLoading(false);
      } else if (msg.type === 'meta') {
        setStreamData((prev) => ({ ...(prev || {}), ...msg, streams: prev?.streams || [] }));
      } else if (msg.type === 'stream') {
        const { streams, changed, appended } = mergeStreamLine(
          { streams: streamsRef.current, dedup }, msg, origin,
          { enabled: clientSourcesEnabled() },
        );
        if (changed) {
          streamsRef.current = streams;
          setStreamData((prev) => ({ ...(prev || {}), streams }));
          if (!userPickedRef.current) setActiveStreamIdx(pickBestIdx(streams, getPlaybackPrefs()));
        }
        if (appended) setStreamLoading(false);
      } else if (msg.type === 'done') {
        setStreamLoading(false);
      }
    };

    (async () => {
      try {
        const local = streamLocalSources(
          { tmdbId, mediaType: 'tv', season, episode },
          { signal: controller.signal, onLine: (s) => handleLine(s, 'local') },
        );
        await streamWatchNdjson(`/watch/${tmdbId}/${season}/${episode}`, {
          signal: controller.signal,
          onLine: handleLine,
        });
        await local;
        setStreamLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Stream fetch error:', err);
        setStreamLoading(false);
        setApiError('Failed to load streaming sources');
      }
    })();

    return () => controller.abort();
  }, [tmdbId, season, episode, reloadNonce]);

  return {
    overview, metadata, metaLoading,
    streamData, streamLoading, unaired,
    activeStreamIdx, selectStream,
    apiError,
    reloadStreams,
  };
}
