// --- Live TV surface (iptv-org) ----------------------------------------------
// The browsable/searchable/playable view over the backend's Live TV catalogue —
// the iptv-org public index of free-to-air broadcasts, joined + cached server-side
// by iptv_engine. Nothing is hosted by us; the backend relays playlists/segments
// through its signed /iptv_proxy so plain-http and CORS-less broadcasts play.
//
// One quirk this layer smooths over: the catalogue warms in the background on a
// fresh backend boot, and until it lands the routes answer `ready: false` instead
// of blocking. Both hooks below poll gently while warming, so the hub shows its
// "tuning" state and then fills in by itself. All of these no-op cleanly when the
// surface is disabled (backend answers 503 → surfaced as an error).
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from './apiClient';
import { memGet, memSet } from './memCache';

const WARMING_POLL_MS = 4000;

// Trailing-edge debounce for a fast-changing value (the hub's search box —
// server-side search should fire once per pause, not once per keystroke).
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// The browse facets: categories + countries (each with channel counts) and the
// catalogue total. memCached — they only change on the twice-daily refresh.
export function useLiveTvBrowse() {
  const seed = memGet('livetv-browse');
  const [facets, setFacets] = useState(() => seed || { categories: [], countries: [], total: 0, ready: false });
  const [loading, setLoading] = useState(() => !seed);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (memGet('livetv-browse')) return undefined;
    let cancelled = false;
    let timer = null;
    const load = async () => {
      try {
        const res = await apiFetch('/iptv/browse');
        if (!res.ok) throw new Error(res.status === 503 ? 'Live TV is not enabled on this haven' : `HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const next = {
          categories: data.categories || [],
          countries: data.countries || [],
          total: data.total || 0,
          ready: !!data.ready,
        };
        setFacets(next);
        if (next.ready) {
          memSet('livetv-browse', next);
          setLoading(false);
        } else {
          timer = setTimeout(load, WARMING_POLL_MS); // catalogue still warming
        }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  return { facets, loading, error };
}

// Paged channel cards, filtered server-side by category/country/search. Filter
// changes re-query page 1; `loadMore` appends the next page (the hub's "Reveal
// More"). Not memCached — the filter space is huge and queries are cheap.
export function useLiveTvChannels({ category = null, country = null, q = '' } = {}) {
  const [channels, setChannels] = useState([]);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const pageRef = useRef(1);
  // Monotonic id so a slow page-1 response can't clobber a newer filter's list.
  const queryIdRef = useRef(0);

  const buildPath = useCallback((page) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (country) params.set('country', country);
    if (q) params.set('q', q);
    params.set('page', String(page));
    return `/iptv/channels?${params.toString()}`;
  }, [category, country, q]);

  useEffect(() => {
    const id = ++queryIdRef.current;
    let timer = null;
    pageRef.current = 1;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const res = await apiFetch(buildPath(1));
        if (!res.ok) throw new Error(res.status === 503 ? 'Live TV is not enabled on this haven' : `HTTP ${res.status}`);
        const data = await res.json();
        if (id !== queryIdRef.current) return; // superseded by a newer filter
        setReady(!!data.ready);
        if (!data.ready) {
          timer = setTimeout(load, WARMING_POLL_MS);
          return;
        }
        setChannels(data.channels || []);
        setTotal(data.total || 0);
        setLoading(false);
      } catch (e) {
        if (id === queryIdRef.current) { setError(e.message); setLoading(false); }
      }
    };
    load();
    return () => { if (timer) clearTimeout(timer); };
  }, [buildPath]);

  const loadMore = useCallback(async () => {
    const id = queryIdRef.current;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const res = await apiFetch(buildPath(nextPage));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (id !== queryIdRef.current) return;
      pageRef.current = nextPage;
      setChannels((prev) => [...prev, ...(data.channels || [])]);
    } catch {
      // A failed "load more" keeps the already-shown grid; the button retries.
    } finally {
      if (id === queryIdRef.current) setLoadingMore(false);
    }
  }, [buildPath]);

  const hasMore = channels.length < total;
  return { channels, total, ready, loading, loadingMore, error, hasMore, loadMore };
}

// One channel's full detail for the watch page — every known feed, best quality
// first, each with its signed same-origin proxy path.
export function useLiveTvChannel(channelId) {
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!channelId) return undefined;
    let cancelled = false;
    let timer = null;
    setLoading(true);
    setError(null);
    setChannel(null);
    const load = async () => {
      try {
        const res = await apiFetch(`/iptv/channel/${encodeURIComponent(channelId)}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? 'No such channel graces the crimson airwaves'
              : res.status === 503 ? 'Live TV is not enabled on this haven'
                : `HTTP ${res.status}`,
          );
        }
        const data = await res.json();
        if (cancelled) return;
        if (!data.ready) {
          timer = setTimeout(load, WARMING_POLL_MS);
          return;
        }
        setChannel(data.channel);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [channelId]);

  return { channel, loading, error };
}
