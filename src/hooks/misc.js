import { useEffect, useState } from 'react';

import { apiFetch, extractError, useSessionToken } from './apiClient';
import { memGet, memSet } from './memCache';
import { syncPlaybackPrefsFromAccount } from './playbackPrefs';

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

// /account/me only, so the nav can check is_admin without the full useAccount
// fan-out on every page.
export function useProfile() {
  const sessionToken = useSessionToken();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!sessionToken) { setProfile(null); return; }
    let cancelled = false;
    const load = () => {
      apiFetch('/account/me')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (cancelled || !data) return;
          setProfile(data);
          // Always mounted, so prefs follow the user to a new device before they ever
          // open settings.
          syncPlaybackPrefsFromAccount(data.preferences);
        })
        .catch(() => {});
    };
    load();
    // A display name saved elsewhere updates greetings without a reload.
    window.addEventListener('crimson-profile', load);
    return () => { cancelled = true; window.removeEventListener('crimson-profile', load); };
  }, [sessionToken]);

  return profile;
}

// '' clears the display name. Returns the stored value or null.
export async function updateUsername(username) {
  const res = await apiFetch('/account/username', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(extractError(data, 'Could not save your display name'));
  }
  const data = await res.json();
  window.dispatchEvent(new Event('crimson-profile'));
  return data.username ?? null;
}

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
