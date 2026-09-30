import { useCallback, useEffect, useRef, useState } from 'react';

import { clientSourcesEnabled, streamLocalSources } from '../sources/clientSources';
import { apiFetch } from '../api/client';
import { getPlaybackPrefs } from '../account/playbackPrefs';
import { mergeStreamLine, pickBestIdx } from '../watch/streamMerge';

export function useAnimeStreamer(externalProps = {}) {
  const [queryName, setQueryName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedAnilistId, setSelectedAnilistId] = useState(null);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);

  // streamsRef lets the best source be picked synchronously as each arrives;
  // userPickedRef stops an auto-upgrade from overriding an explicit pick.
  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);

  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);


  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [availableExtras, setAvailableExtras] = useState([]);
  const [seasonGroups, setSeasonGroups] = useState(null);
  const [currentSeasonAnilistId, setCurrentSeasonAnilistId] = useState(null);

  const [animeMetadata, setAnimeMetadata] = useState(null);
  const [streamData, setStreamData] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [unaired, setUnaired] = useState(null);

  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

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

const fetchAvailableSeasons = useCallback(async (anilistId) => {
    try {
        const res = await apiFetch(`/seasons/${anilistId}`);
        if (!res.ok) throw new Error('Failed to fetch season information');
        const data = await res.json();

        if (data.success && data.seasons) {
            setAvailableSeasons(data.seasons);
            // A viewer can land on an extra's watch URL directly, and the discovery
            // sources need to know which extra to look for (see extraTitle below).
            setAvailableExtras(data.extras || []);
            let title = data.title;
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

  const initializeFromIds = useCallback(async (anilistId, seasonNumber = 1, episodeNumber = 1) => {
    setMetaLoading(true);
    setApiError(null);
    setAnimeMetadata(null);
    setAvailableSeasons([]);
    setAvailableExtras([]);
    setStreamData(null);

    try {
      const seasons = await fetchAvailableSeasons(anilistId);

      let targetSeason = seasons.find(s => s.season_number === seasonNumber);
      if (!targetSeason && seasons.length) targetSeason = seasons[0];
      if (!targetSeason) throw new Error('No season data found for this anime');

      // An id matching no numbered season is an extra (special/OVA/film). Extras
      // have no TMDB season, so they stream by their own anilist_id.
      const requestedId = parseInt(anilistId);
      const isExtra = seasons.length > 0 && !seasons.some(s => s.anilist_id === requestedId);

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

  useEffect(() => {
    if (externalProps.initialAnilistId) {
      initializeFromIds(
        externalProps.initialAnilistId,
        externalProps.initialSeason || 1,
        externalProps.initialEpisode || 1
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // later externalProps changes are ignored on purpose

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
        if (buffer.trim()) handleLine(buffer);

        setStreamLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Stream fetch error:', err);
        setStreamLoading(false);
        setApiError('Failed to load streaming sources');
      }
    };

    // tmdbId/season let enrichMediaCtx pull the AniList title set from the
    // backend's /scrape-meta grant, exactly as the backend scrapers do.
    const seasonRec =
      availableSeasons.find((s) => s.anilist_id === anilistIdToUse) ||
      availableSeasons.find((s) => s.season_number === currentSeason);
    // For an extra, the ctx keeps the show's titles (they find the show on the
    // target site) and carries the extra's own title to pick it out once there.
    const extraRec = availableExtras.find((x) => x.anilist_id === anilistIdToUse);
    const mediaCtx = {
      tmdbId: seasonRec?.tmdb_id,
      mediaType: 'tv',
      season: seasonRec?.tmdb_season ?? null,
      episode: currentEpisode,
      title: animeMetadata?.title || seasonGroups?.title || undefined,
      anilistId: anilistIdToUse,
      extraTitle: extraRec
        ? (extraRec.title_english || extraRec.title_romaji || null)
        : null,
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
    queryName, setQueryName,
    searchResults, showSuggestions, setShowSuggestions,
    metaLoading, apiError, setApiError,

    currentSeason, setCurrentSeason: updateSeason,
    currentEpisode, setCurrentEpisode,
    activeStreamIdx, setActiveStreamIdx: selectStream,

    animeMetadata, streamData, streamLoading,
    availableSeasons, seasonGroups,
    unaired,

    handleSelectSuggestion,
    initializeFromIds,
    reloadStreams,
  };
}
