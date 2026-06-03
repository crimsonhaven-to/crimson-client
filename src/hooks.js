import { useState, useEffect, useCallback } from 'react';

// Replace with your production URL when deploying
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

    // Handle initial item selection
    const handleSelectSuggestion = async (suggestion, navigateToWatchView) => {
        const displayTitle = suggestion.name || suggestion.title || "Selected Anime";
        setQueryName(displayTitle); 
        setShowSuggestions(false);
        setMetaLoading(true);
        setApiError(null);
        setAnimeMetadata(null);

        const idToUse = suggestion.tmdb_id || suggestion.anilist_id;
        if (!idToUse) {
            setApiError('Selection failed: Identifiers missing.');
            setMetaLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/info/${idToUse}?season=1`);
            if (!res.ok) throw new Error("Anime metadata mapping not found in database.");
            
            const data = await res.json();
            setAnimeMetadata(data);
            setSelectedTmdbId(data.tmdb_id); 
            setSelectedAnilistId(data.anilist_id);
            setCurrentSeason(1);
            setCurrentEpisode(1); 
            if (navigateToWatchView) navigateToWatchView();
        } catch (err) {
            console.error("Metadata fetch error:", err);
            setApiError('Metadata mapping failed to load.');
        } finally {
            setMetaLoading(false);
        }
    };

    // Dynamically fetch updated show data whenever the season choice changes
    useEffect(() => {
        if (!selectedTmdbId) return;

        const updateSeasonMetadata = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/info/${selectedTmdbId}?season=${currentSeason}`);
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
    }, [currentSeason, selectedTmdbId]);

    // Formulate stream scraper requests passing season and episode parameters
    useEffect(() => {
        if (!selectedAnilistId) return;

        setStreamLoading(true);
        setStreamData(null);
        setActiveStreamIdx(0); 

        fetch(`${API_BASE_URL}/watch/${selectedAnilistId}/${currentEpisode}?season=${currentSeason}`)
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
            });
    }, [selectedAnilistId, currentEpisode, currentSeason]);

    return {
        queryName, setQueryName,
        searchResults, showSuggestions, setShowSuggestions,
        currentSeason, setCurrentSeason,
        currentEpisode, setCurrentEpisode,
        activeStreamIdx, setActiveStreamIdx,
        animeMetadata, streamData,
        metaLoading, streamLoading, apiError, setApiError,
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