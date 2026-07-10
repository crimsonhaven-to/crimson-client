// --- Live TV surface (iptv-org) ----------------------------------------------
// The browsable/searchable/playable view over the iptv-org index of free-to-air
// broadcasts. The catalogue is now built and cached IN THE BROWSER (see
// liveTvCatalog.js) — the six iptv-org JSON files are fetched straight from
// GitHub Pages, joined locally and kept in IndexedDB for 12h, so browsing costs
// the backend nothing. Playback likewise prefers the CDN directly / the
// crimson-extension companion, and only falls back to the backend's signed
// /iptv_proxy when neither can serve the feed (see LiveTvWatch.jsx).
//
// The backend's /iptv/* endpoints are left untouched and serve as a fallback:
// if the client catalogue can't load (a network hiccup on the iptv-org fetch, or
// the surface pinned to the backend via `crimson:clientLiveTv=0`), these hooks
// transparently fall back to the old server-side path, which polls gently while
// the backend catalogue warms. All of them no-op cleanly when the surface is
// disabled (backend answers 503 → surfaced as an error).
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from './apiClient';
import { memGet, memSet } from './memCache';
import { getCatalog, browseFacets, listChannels, getChannel } from './liveTvCatalog';

const WARMING_POLL_MS = 4000;
const PAGE_SIZE = 60;

// Client catalogue is the default. Pin to the backend with localStorage
// `crimson:clientLiveTv=0` or a build-time `VITE_CLIENT_LIVETV=false` (an escape
// hatch mirroring clientSources' flag), e.g. to exercise the server path.
function clientLiveTvEnabled() {
  try {
    if (import.meta.env?.VITE_CLIENT_LIVETV === 'false') return false;
    if (localStorage.getItem('crimson:clientLiveTv') === '0') return false;
  } catch { /* no localStorage (SSR/sandbox) => default on */ }
  return true;
}

// Trailing-edge debounce for a fast-changing value (the hub's search box —
// search should fire once per pause, not once per keystroke).
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

    const commit = (next) => {
      if (cancelled) return;
      setFacets(next);
      if (next.ready) { memSet('livetv-browse', next); setLoading(false); }
    };

    // Backend fallback: warming-aware fetch of /iptv/browse (the original path).
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
        } catch { /* client catalogue unavailable — fall back to the backend */ }
      }
      if (!cancelled) loadBackend();
    };
    run();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  return { facets, loading, error };
}

// Paged channel cards, filtered by category/country/search. Filter changes
// re-query page 1; `loadMore` appends the next page (the hub's "Reveal More").
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
  // The client catalogue (when in play) — held so loadMore can page it locally
  // with no further network. Null while on the backend path.
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

    // Backend fallback: warming-aware fetch of /iptv/channels page 1.
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
        } catch { /* client catalogue unavailable — fall back to the backend */ }
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
      // Client path: page the in-memory catalogue — no network at all.
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

// One channel's full detail for the watch page — every known feed, best quality
// first. Each feed carries its raw upstream url + Referer/User-Agent demands; the
// watch page turns those into a direct / extension / proxy playback plan.
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

    // Backend fallback: warming-aware fetch of /iptv/channel/{id}.
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
          // A genuine "no such channel" is a real answer, not a reason to hammer
          // the backend — surface it. Any other failure falls back to the server.
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

// The backend's channel detail pre-signs a proxy_path per stream and exposes
// direct_url/direct_ok. Normalise it to the same shape the client catalogue
// yields (raw url + referrer/user_agent) so the watch page's playback plan is
// path-agnostic. The Referer/UA the feed demands aren't returned by the backend
// (they're baked into the signed proxy_path), so a backend-sourced feed simply
// can't use the extension's zero-copy rules — it plays direct or via the proxy,
// which is exactly the backend-path behaviour anyway.
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
      // Carry the backend's ready-made signed proxy so the watch page can use it
      // without a second round-trip when it needs the proxy tier.
      proxy_path: s.proxy_path || null,
    })),
  };
}
