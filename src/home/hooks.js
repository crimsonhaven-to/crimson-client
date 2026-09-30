import { useCallback, useEffect, useState } from 'react';
import { apiFetch, useSessionToken } from '../hooks/apiClient';
import { memGet, memSet } from '../hooks/memCache';

export function useRecommendations(limit = 24) {
  const sessionToken = useSessionToken();
  // Keyed per session so switching accounts in one tab never shows the previous
  // user's picks.
  const key = sessionToken ? `recommendations:${sessionToken}` : null;
  const [recommendations, setRecommendations] = useState(() => (key && memGet(key)?.recs) || []);
  const [basedOn, setBasedOn] = useState(() => (key && memGet(key)?.basedOn) || null);
  const [loading, setLoading] = useState(() => !(key && memGet(key)));

  useEffect(() => {
    if (!key) { setRecommendations([]); setBasedOn(null); setLoading(false); return; }
    const cached = memGet(key);
    if (cached) { setRecommendations(cached.recs); setBasedOn(cached.basedOn); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/recommendations?limit=${limit}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        const recs = data.recommendations || [];
        const based = data.based_on || null;
        setRecommendations(recs);
        setBasedOn(based);
        memSet(key, { recs, basedOn: based });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, limit]);

  return { recommendations, basedOn, loading };
}

export function useUnifiedSearch() {
  const [queryName, setQueryName] = useState('');
  const [results, setResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3) return;
    try {
      const [animeRes, showRes, movieRes, mangaRes, localRes] = await Promise.all([
        apiFetch(`/search/anime?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/search/shows?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/search/movies?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        // 503 when manga is disabled; the catch turns that into no rows.
        apiFetch(`/search/manga?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/search/local?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const anime = (animeRes?.suggestions || []).map(s => ({ ...s, kind: 'anime' }));
      const shows = (showRes?.suggestions || []).map(s => ({ ...s, kind: 'show' }));
      const movies = (movieRes?.suggestions || []).map(s => ({ ...s, kind: 'movie' }));
      const manga = (mangaRes?.suggestions || []).map(s => ({ ...s, kind: 'manga' }));
      // The operator's own library is the most relevant when present, and small.
      const local = (localRes?.suggestions || []).map(s => ({ ...s, kind: 'local' }));
      setResults([...local, ...anime, ...shows, ...movies, ...manga]);
    } catch (e) {
      console.error('Unified search failed:', e);
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (queryName.trim().length >= 3) {
      const t = setTimeout(() => fetchSuggestions(queryName), 300);
      return () => clearTimeout(t);
    }
    setResults([]);
    setShowSuggestions(false);
  }, [queryName, fetchSuggestions]);

  return { queryName, setQueryName, results, showSuggestions, setShowSuggestions };
}
