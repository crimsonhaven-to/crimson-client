import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { memGet, memSet } from '../api/memCache';

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
          apiFetch(`/supporters`),
          apiFetch(`/supporters/stats`)
        ]);

        if (!suppRes.ok) throw new Error(`Supporters: ${suppRes.status}`);
        if (!statsRes.ok) throw new Error(`Stats: ${statsRes.status}`);

        const suppData = await suppRes.json();
        const statsData = await statsRes.json();

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

// memCached so the About-page preview and the full page do not double-fetch.
export function useChangelog() {
  const seed = memGet('changelog');
  const [entries, setEntries] = useState(() => seed?.entries || []);
  const [meta, setMeta] = useState(() => seed?.meta || null);
  const [loading, setLoading] = useState(() => !seed);
  const [error, setError] = useState(null);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    if (memGet('changelog')) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/changelog`);
        // 503 means the backend has no GITHUB_TOKEN yet: a state the page explains
        // kindly, not an error.
        if (res.status === 503) {
          if (!cancelled) setNotConfigured(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data.changelog) ? data.changelog : [];
        const m = { repo: data.repo, stale: !!data.stale, count: data.count ?? list.length };
        setEntries(list);
        setMeta(m);
        memSet('changelog', { entries: list, meta: m });
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { entries, meta, loading, error, notConfigured };
}
