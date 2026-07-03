// The anime watch page's search + multi-season + progressive-stream state machine.
// The anime surface is priority 1 and deliberately keeps its own inline NDJSON
// reader (the show/movie streamers share ./ndjson instead). Lifted verbatim from
// hooks.js.
import { useCallback, useEffect, useRef, useState } from 'react';

import { clientSourcesEnabled, streamLocalSources } from '../clientSources';
import { apiFetch } from './apiClient';
import { getPlaybackPrefs } from './playbackPrefs';
import { mergeStreamLine, pickBestIdx } from './streamMerge';

export function useAnimeStreamer(externalProps = {}) {
  // Search & Autocomplete state
  const [queryName, setQueryName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Trackers
  const [selectedAnilistId, setSelectedAnilistId] = useState(null);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);

  // Mirror of the streams array (so we can pick the best source synchronously as
  // each one arrives) + whether the user has manually chosen a source (so an
  // auto-upgrade to a preferred source never overrides an explicit pick).
  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);

  // Manual source selection from the sidebar — pins the choice so later-arriving
  // preferred sources don't yank it away.
  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);


  // Multi-season support
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [seasonGroups, setSeasonGroups] = useState(null);
  const [currentSeasonAnilistId, setCurrentSeasonAnilistId] = useState(null);

  // Dynamic state loaders
  const [animeMetadata, setAnimeMetadata] = useState(null);
  const [streamData, setStreamData] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  // Set (to { airDate }) when the backend reports the episode hasn't aired yet, so
  // the watch UI shows a "not yet aired" notice instead of resolving zero sources.
  const [unaired, setUnaired] = useState(null);

  // Bumping this re-runs the stream-resolution effect (a manual "rescan sources"),
  // re-resolving the current episode from scratch — for when every source is dead.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

  // ---------- Helper: fetch search suggestions ----------
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3) return;
    try {
      const res = await apiFetch(`/search/anime?query_name=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Failed to fetch search suggestions. HTTP Status: ${res.status}`);
      const data = await res.json();

      if (data && Array.isArray(data.suggestions)) {
        setSearchResults(data.suggestions);
      } else if (Array.isArray(data)) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      console.error("Search suggestion fetch failed:", e);
      setSearchResults([]);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    if (queryName.trim().length >= 3) {
      const delayDebounceFn = setTimeout(() => {
        fetchSuggestions(queryName);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  }, [queryName, fetchSuggestions]);

  // ---------- Helper: fetch available seasons for an anime ----------
const fetchAvailableSeasons = useCallback(async (anilistId) => {
    try {
        const res = await apiFetch(`/seasons/${anilistId}`);
        if (!res.ok) throw new Error('Failed to fetch season information');
        const data = await res.json();

        if (data.success && data.seasons) {
            setAvailableSeasons(data.seasons);
            let title = data.title;
            // If title is missing or "Unknown Anime", try to get it from first season's metadata
            if ((!title || title === "Unknown Anime") && data.seasons.length > 0) {
                const firstSeason = data.seasons[0];
                const metaRes = await apiFetch(`/info/${firstSeason.tmdb_id}?season=${firstSeason.tmdb_season}`);
                if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    title = metaData.title;
                }
            }
            setSeasonGroups({
                title: title || 'Unknown Anime',
                totalSeasons: data.total_seasons
            });
            return data.seasons;
        }
        return [];
    } catch (err) {
        console.error("Season fetch error:", err);
        setApiError('Could not load season information');
        return [];
    }
}, []);

  // ---------- Core: initialise everything from anilistId, season, episode ----------
  const initializeFromIds = useCallback(async (anilistId, seasonNumber = 1, episodeNumber = 1) => {
    setMetaLoading(true);
    setApiError(null);
    setAnimeMetadata(null);
    setAvailableSeasons([]);
    setStreamData(null);

    try {
      // 1. Fetch available seasons
      const seasons = await fetchAvailableSeasons(anilistId);

      // 2. Find the requested season (or fallback to first)
      let targetSeason = seasons.find(s => s.season_number === seasonNumber);
      if (!targetSeason && seasons.length) targetSeason = seasons[0];
      if (!targetSeason) throw new Error('No season data found for this anime');

      // An anilist_id that matches none of the numbered seasons is an extra
      // (special/OVA/movie). Those have no TMDB season, so we stream them
      // directly through the 2-segment /watch/{anilist_id}/{episode} route by
      // pinning selectedAnilistId to the requested id (the show's numbered
      // seasons are still shown for metadata/context).
      const requestedId = parseInt(anilistId);
      const isExtra = seasons.length > 0 && !seasons.some(s => s.anilist_id === requestedId);

      // 3. Fetch metadata for that season using tmdb_id + tmdb_season
      const res = await apiFetch(`/info/${targetSeason.tmdb_id}?season=${targetSeason.tmdb_season}`);
      if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
      const data = await res.json();

      setAnimeMetadata(data);
      if (isExtra) {
        setSelectedAnilistId(requestedId);
        setCurrentSeasonAnilistId(null);
      } else {
        setSelectedAnilistId(targetSeason.anilist_id);
        setCurrentSeasonAnilistId(targetSeason.anilist_id);
      }
      setCurrentSeason(targetSeason.season_number);
      setCurrentEpisode(episodeNumber);

    } catch (err) {
      console.error("Initialization error:", err);
      setApiError(err.message || 'Failed to load anime data');
    } finally {
      setMetaLoading(false);
    }
  }, [fetchAvailableSeasons]);

  // If external initial props are provided, run initialisation once on mount
  useEffect(() => {
    if (externalProps.initialAnilistId) {
      initializeFromIds(
        externalProps.initialAnilistId,
        externalProps.initialSeason || 1,
        externalProps.initialEpisode || 1
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount, externalProps changes are ignored intentionally

  // ---------- Handle selection from search or trending (router-aware) ----------
  const handleSelectSuggestion = async (suggestion, navigateCallback) => {
    const displayTitle = suggestion.title || suggestion.name || "Selected Anime";
    setQueryName(displayTitle);
    setShowSuggestions(false);

    const anilistId = suggestion.anilist_id;
    if (!anilistId) {
      setApiError('Selection failed: No AniList ID found.');
      return;
    }

    try {
      const seasons = await fetchAvailableSeasons(anilistId);
      const firstSeason = seasons?.[0]?.season_number || 1;
      if (navigateCallback) {
        navigateCallback(anilistId, firstSeason, 1);
      }
    } catch (err) {
      setApiError('Could not load season information for this anime.');
    }
  };

  // ---------- Update season manually (used by watch page) ----------
  const updateSeason = useCallback(async (seasonNumber) => {
    if (!availableSeasons.length) return;

    const selectedSeason = availableSeasons.find(s => s.season_number === seasonNumber);
    if (!selectedSeason) return;

    setCurrentSeason(seasonNumber);
    setCurrentSeasonAnilistId(selectedSeason.anilist_id);
    setCurrentEpisode(1);
    setMetaLoading(true);

    try {
      const res = await apiFetch(`/info/${selectedSeason.tmdb_id}?season=${selectedSeason.tmdb_season}`);
      if (res.ok) {
        const data = await res.json();
        setAnimeMetadata(data);
        setSelectedAnilistId(selectedSeason.anilist_id);
      } else {
        throw new Error('Season metadata fetch failed');
      }
    } catch (err) {
      console.error("Season update error:", err);
      setApiError('Failed to load season data');
    } finally {
      setMetaLoading(false);
    }
  }, [availableSeasons]);

  // NOTE: metadata for a season is fetched by initializeFromIds (on mount / URL
  // change) and by updateSeason (when the user switches season). A previous
  // effect here re-fetched /info on every currentSeason change too, which simply
  // duplicated those requests — removed so each season switch hits /info once.

  // ---------- Stream sources progressively (NDJSON) when anilistId + episode changes ----------
  // The backend now streams one JSON object per line: a `meta` line first, then a
  // `stream` line the instant each scraper resolves, then a final `done` line.
  // We read the body incrementally and append sources as they land instead of
  // waiting for a single aggregated JSON blob.
  useEffect(() => {
    const anilistIdToUse = currentSeasonAnilistId || selectedAnilistId;
    if (!anilistIdToUse) return;

    const controller = new AbortController();

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0);
    setUnaired(null);
    streamsRef.current = [];
    userPickedRef.current = false;

    // When the client engine is on, an anime source may resolve both locally and on
    // the backend. Dedup by (source, language) and PREFER the local line: it streams
    // straight from the CDN (token minted from the viewer's own ASN), so it
    // supersedes a backend duplicate even if the backend arrived first. Guarded by
    // clientSourcesEnabled() so default behavior is untouched when the engine is off.
    //   key -> { idx, origin: 'local' | 'backend' }
    const dedup = new Map();

    const handleLine = (line, origin = 'backend') => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        console.warn('Skipping malformed stream line:', trimmed);
        return;
      }

      if (msg.type === 'unaired') {
        // Episode is dated in the future — no scraping happened server-side. Show
        // the "coming soon" state instead of an empty sources list.
        setUnaired({ airDate: msg.air_date });
        setStreamLoading(false);
      } else if (msg.type === 'meta') {
        // Initialise the container as soon as metadata flushes (before any scraper).
        setStreamData((prev) => ({ ...(prev || {}), ...msg, streams: prev?.streams || [] }));
      } else if (msg.type === 'stream') {
        // Fold the resolved source into the list: prefer-local dedup + append (see
        // ./streamMerge, pinned by streamMerge.test.js), then auto-select the most
        // preferred source unless the user has already picked one manually. Ranking
        // is purely the viewer's language/dub-sub preference; ties fall back to
        // arrival order (see streamRank).
        const { streams, changed, appended } = mergeStreamLine(
          { streams: streamsRef.current, dedup }, msg, origin,
          { enabled: clientSourcesEnabled() },
        );
        if (changed) {
          streamsRef.current = streams;
          setStreamData((prev) => ({ ...(prev || {}), streams }));
          if (!userPickedRef.current) setActiveStreamIdx(pickBestIdx(streams, getPlaybackPrefs()));
        }
        // First playable source is in — drop the loading veil so it renders immediately.
        if (appended) setStreamLoading(false);
      } else if (msg.type === 'done') {
        setStreamLoading(false);
      }
    };

    const consumeStream = async () => {
      try {
        const res = await apiFetch(`/watch/${anilistIdToUse}/${currentEpisode}`, {
          signal: controller.signal,
          headers: { Accept: 'application/x-ndjson' },
        });
        if (!res.ok || !res.body) throw new Error('Could not resolve streaming sources.');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx;
          while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            handleLine(line);
          }
        }
        // Flush any trailing line that wasn't newline-terminated.
        if (buffer.trim()) handleLine(buffer);

        setStreamLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return; // Superseded by a newer episode/season selection.
        console.error('Stream fetch error:', err);
        setStreamLoading(false);
        setApiError('Failed to load streaming sources');
      }
    };

    // E3/E2 client-side resolution for anime (no-op unless opted in via the
    // companion + flag). Runs alongside the backend stream and feeds the SAME
    // handleLine, so a locally-resolved anime source (VOE/AniWorld/S.to, minted from
    // the viewer's own ASN) supersedes the backend duplicate. The backend stays the
    // floor (E0). The engine's discovery sources match by title + synonyms +
    // anilistId; tmdbId/season let enrichMediaCtx pull the AniList title set from
    // the backend /scrape-meta grant exactly as the backend scrapers do.
    const seasonRec =
      availableSeasons.find((s) => s.anilist_id === anilistIdToUse) ||
      availableSeasons.find((s) => s.season_number === currentSeason);
    const mediaCtx = {
      tmdbId: seasonRec?.tmdb_id,
      mediaType: 'tv',
      season: seasonRec?.tmdb_season ?? null,
      episode: currentEpisode,
      title: animeMetadata?.title || seasonGroups?.title || undefined,
      anilistId: anilistIdToUse,
    };

    (async () => {
      const local = streamLocalSources(mediaCtx, {
        signal: controller.signal,
        onLine: (s) => handleLine(s, 'local'),
      });
      await consumeStream();
      await local;
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeasonAnilistId, selectedAnilistId, currentEpisode, reloadNonce]);

  return {
    // search & suggestions
    queryName, setQueryName,
    searchResults, showSuggestions, setShowSuggestions,
    metaLoading, apiError, setApiError,

    // season & episode
    currentSeason, setCurrentSeason: updateSeason,
    currentEpisode, setCurrentEpisode,
    activeStreamIdx, setActiveStreamIdx: selectStream,

    // data
    animeMetadata, streamData, streamLoading,
    availableSeasons, seasonGroups,
    unaired,

    // actions
    handleSelectSuggestion,
    initializeFromIds,
    reloadStreams,
  };
}
