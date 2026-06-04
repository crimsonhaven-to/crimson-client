import { useState, useEffect, useCallback } from 'react';

//TODO: add production URL when deploying
const API_BASE_URL = 'http://localhost:8000';

/**
 * Custom hook to handle state-based navigation
 */
export function useRouter(initialView = 'landing') {
    const [currentView, setCurrentView] = useState(initialView);
    return {
        currentView,
        setCurrentView,
        isLanding: currentView === 'landing',
        isWatch: currentView === 'watch',
        isAbout: currentView === 'about'
    };
}

/**
 * Custom hook managing autocomplete searches, metadata mappings, and stream resolutions
 */
export function useAnimeStreamer() {
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

    // Handle suggestions by querying the backend /search/anime endpoint
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

    // Debounce search input changes
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

    // Fetch available seasons for an anime
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

    // Handle initial item selection with season grouping
    const handleSelectSuggestion = async (suggestion, navigateToWatchView) => {
        const displayTitle = suggestion.name || suggestion.title || "Selected Anime";
        setQueryName(displayTitle); 
        setShowSuggestions(false);
        setMetaLoading(true);
        setApiError(null);
        setAnimeMetadata(null);
        setAvailableSeasons([]);

        const tmdbId = suggestion.tmdb_id;
        const anilistId = suggestion.anilist_id;
        
        if (!tmdbId && !anilistId) {
            setApiError('Selection failed: Identifiers missing.');
            setMetaLoading(false);
            return;
        }

        try {
            // First, fetch available seasons using the anilist_id
            let seasons = [];
            if (anilistId) {
                seasons = await fetchAvailableSeasons(anilistId);
            }
            
            // Determine which season to load initially
            let initialSeason = null;
            let initialAnilistId = anilistId;
            let initialTmdbId = tmdbId;
            let initialSeasonNumber = 1;
            
            if (seasons && seasons.length > 0) {
                // Use the first season from the group
                initialSeason = seasons[0];
                initialAnilistId = initialSeason.anilist_id;
                initialTmdbId = initialSeason.tmdb_id;
                initialSeasonNumber = initialSeason.season_number;
            }
            
            // Fetch metadata for the initial season
            const res = await fetch(`${API_BASE_URL}/info/${initialTmdbId}?season=${initialSeason.tmdb_season || 1}`);
            if (!res.ok) throw new Error("Anime metadata mapping not found in database.");
            
            const data = await res.json();
            setAnimeMetadata(data);
            setSelectedTmdbId(data.tmdb_id); 
            setSelectedAnilistId(initialAnilistId);
            setCurrentSeasonAnilistId(initialAnilistId);
            setCurrentSeason(initialSeasonNumber);
            setCurrentEpisode(1);
            
            if (navigateToWatchView) navigateToWatchView();
        } catch (err) {
            console.error("Metadata fetch error:", err);
            setApiError('Metadata mapping failed to load.');
        } finally {
            setMetaLoading(false);
        }
    };

    // Update metadata when season changes
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
            }
        } catch (err) {
            console.error("Season update error:", err);
            setApiError('Failed to load season data');
        } finally {
            setMetaLoading(false);
        }
    }, [availableSeasons]);

    // Dynamically fetch updated show data whenever the season choice changes
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

    // Formulate stream scraper requests using the season-specific AniList ID
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
        queryName, setQueryName,
        searchResults, showSuggestions, setShowSuggestions,
        currentSeason, setCurrentSeason: updateSeason,
        currentEpisode, setCurrentEpisode,
        activeStreamIdx, setActiveStreamIdx,
        animeMetadata, streamData,
        metaLoading, streamLoading, apiError, setApiError,
        availableSeasons, seasonGroups,
        handleSelectSuggestion
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