import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as ed from '@noble/ed25519';
import { Buffer } from 'buffer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://dev-backend.crimsonhaven.to';

// Utility for hex conversion
const toHex = (arr) => Buffer.from(arr).toString('hex');

export function useAuth() {
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('crimson_session'));
  const [publicKey, setPublicKey] = useState(localStorage.getItem('crimson_public_key'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAuthenticated = !!sessionToken;

  const deriveKeypair = async (mnemonic) => {
    const seed = mnemonicToSeedSync(mnemonic).slice(0, 32);
    const pubKeyArr = await ed.getPublicKeyAsync(seed);
    const pubKeyHex = toHex(pubKeyArr);
    return { seed, publicKey: pubKeyHex };
  };

  const login = async (mnemonic) => {
    setLoading(true);
    setError(null);
    try {
      const { seed, publicKey: pubKey } = await deriveKeypair(mnemonic);
      
      // 1. Get challenge
      const challRes = await fetch(`${API_BASE_URL}/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: pubKey })
      });
      if (!challRes.ok) throw new Error('Failed to get auth challenge');
      const { challenge } = await challRes.json();

      // 2. Sign challenge
      const signatureArr = await ed.signAsync(new TextEncoder().encode(challenge), seed);
      const signature = toHex(signatureArr);

      // 3. Login or Register
      // We try login first, if it fails because account doesn't exist, we might need a register step
      // But usually /login or /register work similarly. Let's try /login.
      let res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: pubKey, challenge, signature })
      });

      if (!res.ok) {
        // Try register if login failed
        res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_key: pubKey, challenge, signature })
        });
      }

      if (!res.ok) throw new Error('Authentication failed');
      
      const { session_token } = await res.json();
      setSessionToken(session_token);
      setPublicKey(pubKey);
      localStorage.setItem('crimson_session', session_token);
      localStorage.setItem('crimson_public_key', pubKey);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (sessionToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
      } catch (e) {
        console.error("Logout error:", e);
      }
    }
    setSessionToken(null);
    setPublicKey(null);
    localStorage.removeItem('crimson_session');
    localStorage.removeItem('crimson_public_key');
  };

  const createNewMnemonic = () => {
    return generateMnemonic(wordlist);
  };

  return {
    sessionToken,
    publicKey,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    createNewMnemonic
  };
}

export function useAccount() {
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const sessionToken = localStorage.getItem('crimson_session');

  const fetchProfile = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/account/me`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  }, [sessionToken]);

  const fetchFavorites = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/account/favorites`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (e) {
      console.error("Favorites fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  const fetchContinueWatching = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/account/continue-watching`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContinueWatching(data.continue_watching || []);
      }
    } catch (e) {
      console.error("Continue watching fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  const toggleFavorite = async (anime) => {
    if (!sessionToken) return;
    const isFavorite = favorites.some(f => f.anilist_id === anime.anilist_id || f.tmdb_id === anime.tmdb_id);
    const method = isFavorite ? 'DELETE' : 'POST';
    
    try {
      const res = await fetch(`${API_BASE_URL}/account/favorites`, {
        method,
        headers: { 
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tmdb_id: anime.tmdb_id,
          anilist_id: anime.anilist_id,
          title: anime.title || anime.name,
          poster: anime.poster
        })
      });
      if (res.ok) {
        fetchFavorites();
        return true;
      }
    } catch (e) {
      console.error("Favorite toggle error:", e);
    }
    return false;
  };

  const updateProgress = async (progressData) => {
    if (!sessionToken) return;
    try {
      await fetch(`${API_BASE_URL}/account/progress`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(progressData)
      });
    } catch (e) {
      console.error("Progress update error:", e);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      fetchProfile();
      fetchFavorites();
      fetchContinueWatching();
    }
  }, [sessionToken, fetchProfile, fetchFavorites, fetchContinueWatching]);

  return {
    profile,
    favorites,
    continueWatching,
    loading,
    error,
    toggleFavorite,
    updateProgress,
    refreshFavorites: fetchFavorites,
    refreshContinueWatching: fetchContinueWatching
  };
}

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
            let title = data.title;
            // If title is missing or "Unknown Anime", try to get it from first season's metadata
            if ((!title || title === "Unknown Anime") && data.seasons.length > 0) {
                const firstSeason = data.seasons[0];
                const metaRes = await fetch(`${API_BASE_URL}/info/${firstSeason.tmdb_id}?season=${firstSeason.tmdb_season}`);
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

export function useHealthStatus() {
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch(e => setHealthError(e.message))
      .finally(() => setHealthLoading(false));
  }, []);

  return { health, healthLoading, healthError };
}

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState({ animes: [], categories: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCatalogue = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/catalogue`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          setCatalogue({
            animes: data.animes || [],
            categories: data.categories || [],
            total: data.total || 0
          });
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalogue();
  }, []);

  return { catalogue, loading, error };
}

export function useTitle(title) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} | Crimsonhaven` : 'Crimsonhaven | Your Anime Sanctuary';
    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}