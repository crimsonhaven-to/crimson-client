// --- Local media library surface --------------------------------------------
// The browsable/searchable/playable view over the operator's on-disk media, keyed
// by the opaque path token the backend's local_engine uses. Mirrors the shape of
// the anime/show/movie hooks (memCache-seeded list + overview + an NDJSON streamer)
// so the Index's "Local" view and the local watch page reuse the shared UI. All of
// these no-op cleanly when no local source is enabled (backend returns empty /
// enabled:false), so importing them is always safe.
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from './apiClient';
import { memGet, memSet } from './memCache';
import { streamWatchNdjson } from './ndjson';

// The full local library list for the Index's Local view. `enabled` is false when
// no local source is configured (the caller then hides the view).
export function useLocalLibrary() {
  const seed = memGet('local-library');
  const [library, setLibrary] = useState(() => seed || { items: [], kinds: [], genres: [], enabled: false, total: 0 });
  const [loading, setLoading] = useState(() => !seed);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (memGet('local-library')) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/local-library');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const next = {
          items: data.items || [],
          kinds: data.kinds || [],
          genres: data.genres || [],
          enabled: !!data.enabled,
          total: data.total || 0,
        };
        setLibrary(next);
        memSet('local-library', next);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { library, loading, error };
}

// One local title's detail (metadata + episodes for a show, or a play descriptor
// for a movie). Keyed by the directory/file token from the list.
export function useLocalOverview(token) {
  const key = token ? `local-overview:${token}` : null;
  const [overview, setOverview] = useState(() => (key ? memGet(key) : null));
  const [loading, setLoading] = useState(() => !(key && memGet(key)));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    const cached = memGet(`local-overview:${token}`);
    if (cached) { setOverview(cached); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(`/local-overview/${token}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`local-overview:${token}`, data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return { overview, loading, error };
}

// Progressive NDJSON streamer for one local file (the /watch-local route emits the
// same contract as /watch, so the shared WatchView plays it). Local files resolve
// to a single same-origin source; no client engine / dedup needed.
export function useLocalStreamer(token) {
  const [streamData, setStreamData] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);

  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);
  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);

  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

  useEffect(() => {
    if (!token) return undefined;
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
      try { msg = JSON.parse(trimmed); } catch { return; }
      if (msg.type === 'meta') {
        setStreamData((prev) => ({ ...(prev || {}), ...msg, streams: prev?.streams || [] }));
      } else if (msg.type === 'stream') {
        const streams = [...streamsRef.current, {
          source: msg.source, type: msg.streamType, url: msg.url,
          language: msg.language, subtitles: msg.subtitles,
        }];
        streamsRef.current = streams;
        setStreamData((prev) => ({ ...(prev || {}), streams }));
        setStreamLoading(false);
      } else if (msg.type === 'done') {
        setStreamLoading(false);
      }
    };

    (async () => {
      try {
        await streamWatchNdjson(`/watch-local/${token}`, { signal: controller.signal, onLine: handleLine });
        setStreamLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Local stream fetch error:', err);
        setStreamLoading(false);
      }
    })();

    return () => controller.abort();
  }, [token, reloadNonce]);

  return { streamData, streamLoading, activeStreamIdx, selectStream, reloadStreams };
}
