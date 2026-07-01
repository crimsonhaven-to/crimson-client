// Assorted account/site hooks: supporters, changelog, the lightweight profile hook
// (which also mirrors the account's playback prefs down), the display-name mutation,
// and the personalized recommendations feed. Lifted verbatim from hooks.js.
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

// --- Changelog ---------------------------------------------------------------
// Public view of the repo's GitHub Releases, surfaced by the backend's changelog
// engine (GET /changelog → { changelog: [{tag, name, body(Markdown),
// published_at, url, prerelease, author}], repo, count, stale }). The endpoint
// 503s until the backend has a GITHUB_TOKEN configured — we treat that as a
// distinct "slumbering" state rather than an error so the page can say so kindly.
// Cached in the shared in-memory store (same TTL as trending/catalogue) so the
// About-page preview and the full page don't double-fetch.
export function useChangelog() {
  const seed = memGet('changelog');
  const [entries, setEntries] = useState(() => seed?.entries || []);
  const [meta, setMeta] = useState(() => seed?.meta || null);
  const [loading, setLoading] = useState(() => !seed);
  const [error, setError] = useState(null);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    if (memGet('changelog')) return; // already seeded from cache
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/changelog`);
        // 503 == backend changelog engine has no GITHUB_TOKEN yet (not an error).
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

// Lightweight profile hook — fetches /account/me only (no favorites/progress).
// Used by the nav to decide whether to surface the Admin link (profile.is_admin)
// without paying for the full useAccount fan-out on every page.
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
          // Mirror the account's saved playback preference into the local cache the
          // stream ranker reads, so it follows the user across devices even before
          // they open the settings page. Best-effort and additive (see helper).
          syncPlaybackPrefsFromAccount(data.preferences);
        })
        .catch(() => {});
    };
    load();
    // Refetch when the profile changes elsewhere (e.g. display name saved on the
    // preferences page) so greetings like "Recommended for you, {username}" update
    // live without a reload.
    window.addEventListener('crimson-profile', load);
    return () => { cancelled = true; window.removeEventListener('crimson-profile', load); };
  }, [sessionToken]);

  return profile;
}

// Save (or clear, with '') the account's cosmetic display name, then broadcast so
// every useProfile instance refetches. Returns the stored value (or null).
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

// Personalized "watch next" feed (anime + shows + movies), ranked by the genres of
// what you've saved and watched (see the backend recommend_engine). Cached briefly
// in-memory so navigating back to the home page paints instantly.
export function useRecommendations(limit = 24) {
  const sessionToken = useSessionToken();
  // Cache key is per-session so switching accounts in one tab never shows the
  // previous user's picks (recommendations are personal, unlike trending).
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
