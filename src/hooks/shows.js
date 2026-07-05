// --- Non-anime TV shows (secondary surface) ---------------------------------
// These mirror the anime hooks but key off tmdb_id and the TMDB-keyed backend
// endpoints (/search/shows, /trending/shows, /show-overview, and the existing
// /info + 3-segment /watch). The anime hooks are deliberately left untouched —
// shows are a separate, parallel surface so anime stays priority 1. Also hosts the
// unified landing-page search (anime + shows + movies). Lifted verbatim from hooks.js.
import { useCallback, useEffect, useRef, useState } from 'react';

import { clientSourcesEnabled, streamLocalSources } from '../clientSources';
import { apiFetch, useSessionToken } from './apiClient';
import { memGet, memSet } from './memCache';
import { getPlaybackPrefs } from './playbackPrefs';
import { streamWatchNdjson } from './ndjson';
import { mergeStreamLine, pickBestIdx } from './streamMerge';

// Unified search for the landing page: queries the anime AND show endpoints in
// parallel and returns a merged suggestion list with anime FIRST (priority 1),
// each item tagged with `kind` ('anime' | 'show') so the UI can route it to the
// right overview page. Replaces the search half of useAnimeStreamer on the
// landing page (which never used the streaming half there).
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
        // Manga is optional (503 when disabled) — the catch turns that into no rows.
        apiFetch(`/search/manga?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        // Local library is optional too — returns an empty list (not an error) when
        // no local source is enabled, so this is always safe to fire.
        apiFetch(`/search/local?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const anime = (animeRes?.suggestions || []).map(s => ({ ...s, kind: 'anime' }));
      const shows = (showRes?.suggestions || []).map(s => ({ ...s, kind: 'show' }));
      const movies = (movieRes?.suggestions || []).map(s => ({ ...s, kind: 'movie' }));
      const manga = (mangaRes?.suggestions || []).map(s => ({ ...s, kind: 'manga' }));
      // The operator's own library first — it's the most relevant when present and
      // usually a small set — then the online surfaces, then manga.
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

// Trending non-anime shows for the landing page's secondary row.
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

// TMDB-keyed twin of useAnimeOverview: fetches /show-overview/{tmdbId} (same shape
// as /overview) and lazily loads each season's episodes via /info.
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

// Latest watch-progress row for ONE show, so an overview page can surface a
// "continue where you left off" banner. Anime match on anilist_id; non-anime shows
// match on tmdb_id (and a null anilist_id, mirroring the backend dedup key). Rows
// come back newest-first (updated_at DESC), so the first match is the most recent
// episode. Returns the row (with season/episode/status/position) or null. Reactive
// to login/logout; best-effort and silent on failure.
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
          // Movies share the TMDB id space with shows — disambiguate by media_type.
          if (mediaType === 'movie') return String(r.tmdb_id) === String(tmdbId) && r.media_type === 'movie';
          return String(r.tmdb_id) === String(tmdbId) && r.anilist_id == null && r.media_type !== 'movie';
        };
        const latest = rows.find(match) || null;
        if (!cancelled) setResume(latest);
      } catch { /* best-effort: no banner on failure */ }
    })();
    return () => { cancelled = true; };
  }, [sessionToken, anilistId, tmdbId, mediaType]);

  return resume;
}

// TMDB-keyed twin of useAnimeStreamer's playback half. Season/episode are driven
// by the URL (the show watch page passes them in), so this is simpler than the
// anime version: no anilist->season mapping. Loads the season list + season
// metadata, and streams sources via the 3-segment /watch/{tmdb}/{season}/{episode}.
export function useShowStreamer(tmdbId, season, episode) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`show-overview:${tmdbId}`) : null));
  const [metadata, setMetadata] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [streamData, setStreamData] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  const [apiError, setApiError] = useState(null);
  // Set (to { airDate }) when the backend reports the episode hasn't aired yet.
  const [unaired, setUnaired] = useState(null);

  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);
  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);

  // Manual "rescan sources" — bump to re-run the resolution effect from scratch.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

  // Season list + title (reuses the overview payload / its cache).
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

  // Season metadata (episode list, summary) via /info.
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

  // Progressive NDJSON source streaming via the 3-segment /watch route.
  useEffect(() => {
    if (!tmdbId || !season || !episode) return;
    const controller = new AbortController();

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0);
    setUnaired(null);
    streamsRef.current = [];
    userPickedRef.current = false;

    // When the client engine is on, a source may resolve both locally and on the
    // backend. Dedup by (source, language) and PREFER the local line: it streams
    // straight from the CDN, so it supersedes a backend duplicate even if the
    // backend arrived first. Guarded so default behavior is untouched when off.
    //   key -> { idx, origin: 'local' | 'backend' }
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
        // Dedup by (source, language) — distinct dub/sub variants stay separate
        // (e.g. VOE English Sub vs German Dub) — preferring local over a backend
        // duplicate, then auto-select by preference. See ./streamMerge.
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
        // E3/E2 client-side resolution (no-op unless opted in). Runs alongside the
        // backend stream and feeds the same handleLine; the backend stays the floor.
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
