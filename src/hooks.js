import { useState, useEffect, useCallback, useRef } from 'react';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as ed from '@noble/ed25519';
import { Buffer } from 'buffer';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend.crimsonhaven.to';

// Utility for hex conversion
const toHex = (arr) => Buffer.from(arr).toString('hex');

// --- Lightweight in-memory cache (per page session) -------------------------
// Trending and the catalogue are global, slow-changing payloads. Without this,
// navigating away and back re-downloads them on every mount (the catalogue can
// be large). A short TTL keeps them fresh enough while removing the repeat
// fetches. Lives in module scope so it persists across component remounts.
const _memCache = new Map();
const MEM_TTL_MS = 5 * 60 * 1000; // 5 minutes

function memGet(key) {
  const hit = _memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiry) {
    _memCache.delete(key);
    return null;
  }
  return hit.data;
}

function memSet(key, data, ttlMs = MEM_TTL_MS) {
  _memCache.set(key, { data, expiry: Date.now() + ttlMs });
}

// --- Stream source preference ----------------------------------------------
// Sources resolve in a race and arrive in arbitrary order. This ranks them so
// the most reliable/performant one is auto-selected as the active source the
// moment it lands (lower rank = preferred). Voe is the standout — fast and
// dependable — so it wins whenever it resolves. The list itself stays in
// arrival order; only which source plays by default is affected.
const STREAM_PRIORITY = [
  { match: 'voe', rank: 0 },
];

function streamPriority(source) {
  const s = (source || '').toLowerCase();
  for (const { match, rank } of STREAM_PRIORITY) {
    if (s.includes(match)) return rank;
  }
  return 100;
}


// --- Reactive session token -------------------------------------------------
// The session token lives in localStorage, which isn't reactive. useAuth and
// useAccount are independent hook instances, so a login/logout in one wouldn't
// update the others without a remount. We bridge them with a window event:
// auth mutations go through setAuthStorage (which dispatches 'crimson-auth'),
// and every useSessionToken subscriber re-reads — so all instances stay in sync
// within the tab (and across tabs via the native 'storage' event).
const SESSION_KEY = 'crimson_session';
const PUBKEY_KEY = 'crimson_public_key';

function setAuthStorage(sessionToken, publicKey) {
  if (sessionToken) localStorage.setItem(SESSION_KEY, sessionToken);
  else localStorage.removeItem(SESSION_KEY);
  if (publicKey) localStorage.setItem(PUBKEY_KEY, publicKey);
  else localStorage.removeItem(PUBKEY_KEY);
  window.dispatchEvent(new Event('crimson-auth'));
}

export function useSessionToken() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY));
  useEffect(() => {
    const sync = () => setToken(localStorage.getItem(SESSION_KEY));
    window.addEventListener('crimson-auth', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-auth', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return token;
}

export function useAuth() {
  // Reactive across all hook instances in the tab (see useSessionToken).
  const sessionToken = useSessionToken();
  const [publicKey, setPublicKey] = useState(() => localStorage.getItem(PUBKEY_KEY));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep publicKey in sync when auth changes in another hook instance / tab.
  useEffect(() => {
    const sync = () => setPublicKey(localStorage.getItem(PUBKEY_KEY));
    window.addEventListener('crimson-auth', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-auth', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

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
      // Persist + broadcast: updates this hook (via the event) and every other
      // useAuth / useAccount instance in the tab.
      setAuthStorage(session_token, pubKey);
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
    setAuthStorage(null, null);
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
  const [recentlyWatched, setRecentlyWatched] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reactive: re-runs the fetch effect when the user logs in/out (see useAuth).
  const sessionToken = useSessionToken();

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
        setContinueWatching(data.items || []);
      }
    } catch (e) {
      console.error("Continue watching fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  const fetchRecent = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/account/recent`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentlyWatched(data.items || []);
      }
    } catch (e) {
      console.error("Recent fetch error:", e);
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
      fetchRecent();
    }
  }, [sessionToken, fetchProfile, fetchFavorites, fetchContinueWatching, fetchRecent]);

  return {
    profile,
    favorites,
    continueWatching,
    recentlyWatched,
    loading,
    toggleFavorite,
    updateProgress,
    refreshFavorites: fetchFavorites,
    refreshContinueWatching: fetchContinueWatching,
    refreshRecent: fetchRecent
  };
}

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
    streamsRef.current = [];
    userPickedRef.current = false;

    const handleLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        console.warn('Skipping malformed stream line:', trimmed);
        return;
      }

      if (msg.type === 'meta') {
        // Initialise the container as soon as metadata flushes (before any scraper).
        setStreamData((prev) => ({ ...(prev || {}), ...msg, streams: prev?.streams || [] }));
      } else if (msg.type === 'stream') {
        // Append each source the instant it resolves. Normalise `streamType` -> `type`
        // so the existing player/sidebar rendering keeps working unchanged.
        // `language` is optional (only some scrapers know it) and stays undefined
        // otherwise, so the UI simply shows nothing for sources without one.
        const next = [
          ...streamsRef.current,
          { source: msg.source, type: msg.streamType, url: msg.url, language: msg.language },
        ];
        streamsRef.current = next;
        setStreamData((prev) => ({ ...(prev || {}), streams: next }));

        // Auto-select the most preferred source available (Voe first) unless the
        // user has already picked one manually. The list keeps its arrival order;
        // only the active/playing source is upgraded.
        if (!userPickedRef.current) {
          let bestIdx = 0;
          let bestRank = Infinity;
          next.forEach((s, i) => {
            const r = streamPriority(s.source);
            if (r < bestRank) { bestRank = r; bestIdx = i; }
          });
          setActiveStreamIdx(bestIdx);
        }
        // First playable source is in — drop the loading veil so it renders immediately.
        setStreamLoading(false);
      } else if (msg.type === 'done') {
        setStreamLoading(false);
      }
    };

    const consumeStream = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/watch/${anilistIdToUse}/${currentEpisode}`, {
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

    consumeStream();

    return () => controller.abort();
  }, [currentSeasonAnilistId, selectedAnilistId, currentEpisode]);

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
    animeMetadata, streamData,
    availableSeasons, seasonGroups,
    
    // actions
    handleSelectSuggestion,
    initializeFromIds
  };
}

export function useTrendingAnime() {
  // Seed from the in-memory cache so a remount within the TTL paints instantly
  // and skips the fetch (no setState in the effect body).
  const [trendingAnimes, setTrendingAnimes] = useState(() => memGet('trending') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending'));

  useEffect(() => {
    if (memGet('trending')) return; // already seeded from cache
    const fetchTrending = async () => {
      setTrendLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/trending`);
        if (!res.ok) throw new Error('Failed to fetch trending data.');
        const data = await res.json();
        if (data.success && Array.isArray(data.animes)) {
          setTrendingAnimes(data.animes);
          memSet('trending', data.animes);
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
  // Seed from the in-memory cache so a remount within the TTL paints instantly
  // and skips the fetch (no setState in the effect body).
  const [catalogue, setCatalogue] = useState(() => memGet('catalogue') || { animes: [], categories: [], total: 0 });
  const [loading, setLoading] = useState(() => !memGet('catalogue'));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (memGet('catalogue')) return; // already seeded from cache
    const fetchCatalogue = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/catalogue`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          const next = {
            animes: data.animes || [],
            categories: data.categories || [],
            total: data.total || 0
          };
          setCatalogue(next);
          memSet('catalogue', next);
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

export function useSupporters() {
  const [supporters, setSupporters] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSupportersData = async () => {
      setLoading(true);
      try {
        const [suppRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/supporters`),
          fetch(`${API_BASE_URL}/supporters/stats`)
        ]);

        if (!suppRes.ok) throw new Error(`Supporters: ${suppRes.status}`);
        if (!statsRes.ok) throw new Error(`Stats: ${statsRes.status}`);

        const suppData = await suppRes.json();
        const statsData = await statsRes.json();

        // Handle both array-only and {success, supporters} formats
        if (Array.isArray(suppData)) {
          setSupporters(suppData);
        } else if (suppData && Array.isArray(suppData.supporters)) {
          setSupporters(suppData.supporters);
        } else {
          setSupporters([]);
        }

        setStats(statsData);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSupportersData();
  }, []);

  return { supporters, stats, loading, error };
}