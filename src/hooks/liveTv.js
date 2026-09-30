// The catalogue is built in the browser (liveTvCatalog.js). The backend's /iptv/*
// endpoints are the fallback when that fails or is pinned off, and they poll
// while the backend catalogue warms.
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from './apiClient';
import { memGet, memSet } from './memCache';
import { getCatalog, browseFacets, listChannels, getChannel } from './liveTvCatalog';

const WARMING_POLL_MS = 4000;
const PAGE_SIZE = 60;

// Escape hatch to exercise the server path, mirroring clientSources' flag.
function clientLiveTvEnabled() {
  try {
    if (import.meta.env?.VITE_CLIENT_LIVETV === 'false') return false;
    if (localStorage.getItem('crimson:clientLiveTv') === '0') return false;
  } catch { /* no localStorage (SSR/sandbox): default on */ }
  return true;
}

export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useLiveTvBrowse() {
  const seed = memGet('livetv-browse');
  const [facets, setFacets] = useState(() => seed || { categories: [], countries: [], total: 0, ready: false });
  const [loading, setLoading] = useState(() => !seed);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (memGet('livetv-browse')) return undefined;
    let cancelled = false;
    let timer = null;

    const commit = (next) => {
      if (cancelled) return;
      setFacets(next);
      if (next.ready) { memSet('livetv-browse', next); setLoading(false); }
    };

    const loadBackend = async () => {
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
        if (next.ready) commit(next);
        else { setFacets(next); timer = setTimeout(loadBackend, WARMING_POLL_MS); }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    };

    const run = async () => {
      if (clientLiveTvEnabled()) {
        try {
          const f = browseFacets(await getCatalog());
          commit({ categories: f.categories, countries: f.countries, total: f.total, ready: true });
          return;
        } catch { /* client catalogue unavailable: fall back to the backend */ }
      }
      if (!cancelled) loadBackend();
    };
    run();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  return { facets, loading, error };
}

export function useLiveTvChannels({ category = null, country = null, q = '' } = {}) {
  const [channels, setChannels] = useState([]);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const pageRef = useRef(1);
  // Stops a slow page-1 response clobbering a newer filter's list.
  const queryIdRef = useRef(0);
  // Lets loadMore page the client catalogue without network. Null on the backend path.
  const catalogRef = useRef(null);

  const filters = { category, country, q };

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

    const loadBackend = async () => {
      catalogRef.current = null;
      try {
        const res = await apiFetch(buildPath(1));
        if (!res.ok) throw new Error(res.status === 503 ? 'Live TV is not enabled on this haven' : `HTTP ${res.status}`);
        const data = await res.json();
        if (id !== queryIdRef.current) return;
        setReady(!!data.ready);
        if (!data.ready) { timer = setTimeout(loadBackend, WARMING_POLL_MS); return; }
        setChannels(data.channels || []);
        setTotal(data.total || 0);
        setLoading(false);
      } catch (e) {
        if (id === queryIdRef.current) { setError(e.message); setLoading(false); }
      }
    };

    const run = async () => {
      if (clientLiveTvEnabled()) {
        try {
          const catalog = await getCatalog();
          if (id !== queryIdRef.current) return;
          catalogRef.current = catalog;
          const data = listChannels(catalog, { category, country, q, page: 1, pageSize: PAGE_SIZE });
          setReady(true);
          setChannels(data.channels);
          setTotal(data.total);
          setLoading(false);
          return;
        } catch { /* client catalogue unavailable: fall back to the backend */ }
      }
      if (id === queryIdRef.current) loadBackend();
    };
    run();
    return () => { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildPath]);

  const loadMore = useCallback(async () => {
    const id = queryIdRef.current;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      if (catalogRef.current) {
        const data = listChannels(catalogRef.current, { ...filters, page: nextPage, pageSize: PAGE_SIZE });
        if (id !== queryIdRef.current) return;
        pageRef.current = nextPage;
        setChannels((prev) => [...prev, ...data.channels]);
        return;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildPath, category, country, q]);

  const hasMore = channels.length < total;
  return { channels, total, ready, loading, loadingMore, error, hasMore, loadMore };
}

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

    const loadBackend = async () => {
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
        if (!data.ready) { timer = setTimeout(loadBackend, WARMING_POLL_MS); return; }
        setChannel(normaliseBackendChannel(data.channel));
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    };

    const run = async () => {
      if (clientLiveTvEnabled()) {
        try {
          const detail = getChannel(await getCatalog(), channelId);
          if (cancelled) return;
          if (!detail) throw new Error('No such channel graces the crimson airwaves');
          setChannel(detail);
          setLoading(false);
          return;
        } catch (e) {
          // "No such channel" is a real answer, not a reason to ask the backend.
          if (/No such channel/.test(e.message)) { if (!cancelled) { setError(e.message); setLoading(false); } return; }
        }
      }
      if (!cancelled) loadBackend();
    };
    run();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [channelId]);

  return { channel, loading, error };
}

// The backend bakes the feed's Referer/UA into its signed proxy_path instead of
// returning them, so a backend-sourced feed plays direct or via that proxy, never
// through the extension.
function normaliseBackendChannel(ch) {
  if (!ch) return ch;
  return {
    ...ch,
    streams: (ch.streams || []).map((s) => ({
      quality: s.quality,
      label: s.label,
      url: s.direct_url,
      referrer: '',
      user_agent: '',
      direct_ok: !!s.direct_ok,
      proxy_path: s.proxy_path || null,
    })),
  };
}
