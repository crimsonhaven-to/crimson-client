import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8000';

// --- NEW: LIGHTWEIGHT CLIENT ROUTER HOOK ---
export function useRouter() {
    const parseLocation = () => {
        const path = window.location.pathname;
        
        if (path === '/about') {
            return { view: 'about', params: {} };
        }
        
        if (path.startsWith('/watch/')) {
            // Pattern: /watch/:anilistId/:episode
            const segments = path.split('/').filter(Boolean); // ['watch', 'id', 'ep']
            return {
                view: 'watch',
                params: {
                    anilistId: segments[1] || null,
                    episode: segments[2] ? parseInt(segments[2], 10) : 1
                }
            };
        }
        
        // Default Fallback
        return { view: 'landing', params: {} };
    };

    const [route, setRoute] = useState(parseLocation);

    // Dynamic clean navigation modifier
    const navigate = useCallback((toPath) => {
        window.history.pushState(null, '', toPath);
        setRoute(parseLocation());
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            setRoute(parseLocation());
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    return { view: route.view, params: route.params, navigate };
}

// --- EXISTING SEARCH HOOK ---
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

// --- EXISTING TRENDING HOOK ---
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