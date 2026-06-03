import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8000';

export function useAnimeSearch() {
    const [queryName, setQueryName] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [metaLoading, setMetaLoading] = useState(false);
    const [animeMetadata, setAnimeMetadata] = useState(null);
    const [apiError, setApiError] = useState(null);

    const fetchSuggestions = useCallback(async (query) => {
        if (!query || query.trim().length < 3) return;
        try {
            const res = await fetch(`${API_BASE_URL}/search/anime?query_name=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            const data = await res.json();
            setSearchResults(Array.isArray(data.suggestions) ? data.suggestions : (Array.isArray(data) ? data : []));
        } catch (e) {
            console.error("Search fetch failed:", e);
            setSearchResults([]);
        }
    }, []);

    // Debounce tracking effect
    useEffect(() => {
        if (queryName.trim().length >= 3) {
            const delayDebounceFn = setTimeout(() => fetchSuggestions(queryName), 300);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setSearchResults([]);
            setShowSuggestions(false);
        }
    }, [queryName, fetchSuggestions]);

    return {
        queryName, setQueryName,
        searchResults, setSearchResults,
        showSuggestions, setShowSuggestions,
        metaLoading, setMetaLoading,
        animeMetadata, setAnimeMetadata,
        apiError, setApiError
    };
}

export function useTrendingAnime() {
    const [trendingAnimes, setTrendingAnimes] = useState([]);
    const [trendLoading, setTrendLoading] = useState(true);

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/trending`);
                if (!res.ok) throw new Error('Failed to fetch trending data.');
                const data = await res.json();
                if (data.success && Array.isArray(data.animes)) {
                    setTrendingAnimes(data.animes);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setTrendLoading(false);
            }
        };
        fetchTrending();
    }, []);

    return { trendingAnimes, trendLoading };
}