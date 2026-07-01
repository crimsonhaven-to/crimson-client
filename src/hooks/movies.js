// --- General (non-anime) movies (secondary surface) -------------------------
// The movie twins of the show hooks. A movie has no seasons/episodes, so these
// are simpler: one /movie-overview payload and a single /watch/movie stream. Anime
// and shows are untouched. Lifted verbatim from hooks.js.
import { useCallback, useEffect, useRef, useState } from 'react';

import { clientSourcesEnabled, streamLocalSources } from '../clientSources';
import { streamRank } from '../streamUtils';
import { apiFetch } from './apiClient';
import { memGet, memSet } from './memCache';
import { getPlaybackPrefs } from './playbackPrefs';
import { streamWatchNdjson } from './ndjson';

// Trending general movies for the landing page's secondary row.
export function useTrendingMovies() {
  const [trendingMovies, setTrendingMovies] = useState(() => memGet('trending-movies') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending-movies'));

  useEffect(() => {
    if (memGet('trending-movies')) return;
    (async () => {
      setTrendLoading(true);
      try {
        const res = await apiFetch(`/trending/movies`);
        if (!res.ok) throw new Error('Failed to fetch trending movies.');
        const data = await res.json();
        if (data.success && Array.isArray(data.movies)) {
          setTrendingMovies(data.movies);
          memSet('trending-movies', data.movies);
        }
      } catch (e) {
        console.error('Error fetching trending movies:', e);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, []);

  return { trendingMovies, trendLoading };
}

// Movie overview: fetches /movie-overview/{tmdbId}. No seasons/episodes — the page
// renders a single "Start Watching" using the shared OverviewView in movie mode.
export function useMovieOverview(tmdbId) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`movie-overview:${tmdbId}`) : null));
  const [loading, setLoading] = useState(() => !(tmdbId && memGet(`movie-overview:${tmdbId}`)));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tmdbId) return;
    const cached = memGet(`movie-overview:${tmdbId}`);
    if (cached) { setOverview(cached); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(`/movie-overview/${tmdbId}`);
        if (!res.ok) throw new Error(`Failed to load overview (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`movie-overview:${tmdbId}`, data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId]);

  return { overview, loading, error };
}

// Movie streamer: loads the overview (title/poster) + streams sources via the
// /watch/movie/{tmdbId} NDJSON route. No season/episode dimension.
export function useMovieStreamer(tmdbId) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`movie-overview:${tmdbId}`) : null));
  const [streamData, setStreamData] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  const [apiError, setApiError] = useState(null);

  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);
  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);

  // Manual "rescan sources" — bump to re-run the resolution effect from scratch.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

  // Movie metadata (title/poster) — reuses the overview payload / its cache.
  useEffect(() => {
    if (!tmdbId) return;
    const cached = memGet(`movie-overview:${tmdbId}`);
    if (cached) { setOverview(cached); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/movie-overview/${tmdbId}`);
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`movie-overview:${tmdbId}`, data);
      } catch (e) {
        if (!cancelled) setApiError('Could not load movie information');
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId]);

  // Progressive NDJSON source streaming via /watch/movie/{tmdbId}.
  useEffect(() => {
    if (!tmdbId) return;
    const controller = new AbortController();

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0);
    streamsRef.current = [];
    userPickedRef.current = false;

    //   key -> { idx, origin: 'local' | 'backend' }; prefer-local dedup, see the
    //   show hook above for the rationale.
    const dedup = new Map();

    const handleLine = (line, origin = 'backend') => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try { msg = JSON.parse(trimmed); } catch { return; }

      if (msg.type === 'meta') {
        setStreamData((prev) => ({ ...(prev || {}), ...msg, streams: prev?.streams || [] }));
      } else if (msg.type === 'stream') {
        const incoming = { source: msg.source, type: msg.streamType, url: msg.url, language: msg.language, subtitles: msg.subtitles };
        const reselect = () => {
          if (userPickedRef.current) return;
          const prefs = getPlaybackPrefs();
          let bestIdx = 0, bestRank = Infinity;
          streamsRef.current.forEach((s, i) => {
            const r = streamRank(s, prefs);
            if (r < bestRank) { bestRank = r; bestIdx = i; }
          });
          setActiveStreamIdx(bestIdx);
        };
        if (clientSourcesEnabled()) {
          // Prefer local over a backend duplicate; distinct dub/sub variants stay
          // separate. A local line supersedes backend even if backend arrived first.
          const key = `${msg.source}|${msg.language || ''}`;
          const prior = dedup.get(key);
          if (prior) {
            if (origin === 'local' && prior.origin !== 'local') {
              const swapped = streamsRef.current.slice();
              swapped[prior.idx] = incoming;
              streamsRef.current = swapped;
              dedup.set(key, { idx: prior.idx, origin });
              setStreamData((prev) => ({ ...(prev || {}), streams: swapped }));
              reselect();
            }
            return;
          }
          dedup.set(key, { idx: streamsRef.current.length, origin });
        }
        const next = [...streamsRef.current, incoming];
        streamsRef.current = next;
        setStreamData((prev) => ({ ...(prev || {}), streams: next }));
        reselect();
        setStreamLoading(false);
      } else if (msg.type === 'done') {
        setStreamLoading(false);
      }
    };

    (async () => {
      try {
        // Client-side resolution (no-op unless opted in); backend stays the floor.
        const local = streamLocalSources(
          { tmdbId, mediaType: 'movie' },
          { signal: controller.signal, onLine: (s) => handleLine(s, 'local') },
        );
        await streamWatchNdjson(`/watch/movie/${tmdbId}`, {
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
  }, [tmdbId, reloadNonce]);

  return { overview, streamData, streamLoading, activeStreamIdx, selectStream, apiError, reloadStreams };
}
