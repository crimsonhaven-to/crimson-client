import { useState, useEffect, useCallback } from 'react';

// TODO: add production URL when deploying
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Custom hook to handle autocomplete searches, metadata mappings, and stream resolutions.
 * Supports external initialisation for URL-driven navigation.
 */
export function useAnimeStreamer(externalProps = {}) {
  // Search & Autocomplete state
  const [queryName, setQueryName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Trackers
  const [selectedTmdbId, setSelectedTmdbId] = useState(null);
  const [selectedAnilistId, setSelectedAnilistId] = useState(null);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  
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

  // ---------- Helper: fetch search suggestions ----------
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3) return;
    try {
      const res = await fetch(`${API_BASE_URL}/search/anime?query_name=${encodeURIComponent(query)}`);
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
      const res = await fetch(`${API_BASE_URL}/seasons/${anilistId}`);
      if (!res.ok) throw new Error('Failed to fetch season information');
      const data = await res.json();
      
      if (data.success && data.seasons) {
        setAvailableSeasons(data.seasons);
        setSeasonGroups({
          title: data.title,
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

      // 3. Fetch metadata for that season using tmdb_id + tmdb_season
      const res = await fetch(`${API_BASE_URL}/info/${targetSeason.tmdb_id}?season=${targetSeason.tmdb_season}`);
      if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
      const data = await res.json();

      setAnimeMetadata(data);
      setSelectedTmdbId(data.tmdb_id);
      setSelectedAnilistId(targetSeason.anilist_id);
      setCurrentSeasonAnilistId(targetSeason.anilist_id);
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
      const res = await fetch(`${API_BASE_URL}/info/${selectedSeason.tmdb_id}?season=${selectedSeason.tmdb_season}`);
      if (res.ok) {
        const data = await res.json();
        setAnimeMetadata(data);
        setSelectedTmdbId(data.tmdb_id);
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

  // ---------- Auto-refetch metadata when currentSeason changes (if using internal state) ----------
  useEffect(() => {
    if (!selectedTmdbId || !currentSeason) return;

    const updateSeasonMetadata = async () => {
      try {
        const selectedSeason = availableSeasons.find(s => s.season_number === currentSeason);
        const tmdbSeason = selectedSeason?.tmdb_season || currentSeason;
        
        const res = await fetch(`${API_BASE_URL}/info/${selectedTmdbId}?season=${tmdbSeason}`);
        if (res.ok) {
          const data = await res.json();
          setAnimeMetadata(data);
          if (data.anilist_id) setSelectedAnilistId(data.anilist_id);
        }
      } catch (e) {
        console.error("Failed to sync structural seasonal updates:", e);
      }
    };

    updateSeasonMetadata();
  }, [currentSeason, selectedTmdbId, availableSeasons]);

  // ---------- Fetch streams when anilistId + episode changes ----------
  useEffect(() => {
    const anilistIdToUse = currentSeasonAnilistId || selectedAnilistId;
    if (!anilistIdToUse) return;

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0);

    fetch(`${API_BASE_URL}/watch/${anilistIdToUse}/${currentEpisode}`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not resolve streaming sources.');
        return res.json();
      })
      .then((data) => {
        setStreamData(data);
        setStreamLoading(false);
      })
      .catch((err) => {
        console.error('Stream fetch error:', err);
        setStreamLoading(false);
        setApiError('Failed to load streaming sources');
      });
  }, [currentSeasonAnilistId, selectedAnilistId, currentEpisode]);

  return {
    // search & suggestions
    queryName, setQueryName,
    searchResults, showSuggestions, setShowSuggestions,
    metaLoading, apiError, setApiError,
    
    // season & episode
    currentSeason, setCurrentSeason: updateSeason,
    currentEpisode, setCurrentEpisode,
    activeStreamIdx, setActiveStreamIdx,
    
    // data
    animeMetadata, streamData,
    availableSeasons, seasonGroups,
    
    // actions
    handleSelectSuggestion,
    initializeFromIds
  };
}

/**
 * Independent custom hook to manage trending items
 */
export function useTrendingAnime() {
  const [trendingAnimes, setTrendingAnimes] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      setTrendLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/trending`);
        if (!res.ok) throw new Error('Failed to fetch trending data.');
        const data = await res.json();
        if (data.success && Array.isArray(data.animes)) {
          setTrendingAnimes(data.animes);
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