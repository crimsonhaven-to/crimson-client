// Profile + watch-history layer. Watchlists are intentionally NOT fetched here —
// they live in useWatchlists() (used by the Watchlists page and the per-show
// WatchlistButton), so watch/account pages don't pay for an unused fetch. Lifted
// verbatim from hooks.js.
import { useCallback, useEffect, useState } from 'react';

import { apiFetch, useSessionToken } from './apiClient';

export function useAccount() {
  const [profile, setProfile] = useState(null);
  const [continueWatching, setContinueWatching] = useState([]);
  const [recentlyWatched, setRecentlyWatched] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reactive: re-runs the fetch effect when the user logs in/out (see useAuth).
  const sessionToken = useSessionToken();

  const fetchProfile = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await apiFetch(`/account/me`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  }, [sessionToken]);

  const fetchContinueWatching = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/account/continue-watching`);
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
      // Pull the full history (server caps at 100) so the History page's search
      // and filters operate over everything, not just the latest handful.
      const res = await apiFetch(`/account/recent?limit=100`);
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

  // Remove a show from watch history entirely. The history is collapsed to one
  // card per show, but a show can have many episode-level progress rows — so we
  // fetch the full progress list and delete every row for this show, otherwise it
  // would just reappear carrying an older episode. Optimistically drops it from
  // the visible list first for a snappy feel.
  const removeFromHistory = useCallback(async (item) => {
    if (!sessionToken) return false;
    const matches = (r) => {
      if (item.media_type === 'local') return String(r.local_id) === String(item.local_id) && r.media_type === 'local';
      if (item.anilist_id != null) return String(r.anilist_id) === String(item.anilist_id);
      if (item.media_type === 'movie') return String(r.tmdb_id) === String(item.tmdb_id) && r.media_type === 'movie';
      return String(r.tmdb_id) === String(item.tmdb_id) && r.anilist_id == null && r.media_type !== 'movie';
    };
    setRecentlyWatched(prev => prev.filter(r => !matches(r)));
    try {
      const res = await apiFetch(`/account/progress`);
      const rows = res.ok ? ((await res.json()).progress || []) : [];
      const targets = rows.filter(matches);
      await Promise.all(targets.map(r =>
        apiFetch(`/account/progress?item_key=${encodeURIComponent(r.item_key)}`, { method: 'DELETE' }).catch(() => {})
      ));
      return true;
    } catch (e) {
      console.error("Remove from history error:", e);
      // Re-sync so the optimistic removal doesn't desync from the server.
      fetchRecent();
      return false;
    }
  }, [sessionToken, fetchRecent]);


  // useCallback so the reference is stable across renders: the watch page keys a
  // periodic-save effect on this, and an unstable identity would re-run that
  // effect every render (redundant POSTs + losing the tracked playback position).
  const updateProgress = useCallback(async (progressData) => {
    if (!sessionToken) return;
    try {
      await apiFetch(`/account/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      });
    } catch (e) {
      console.error("Progress update error:", e);
    }
  }, [sessionToken]);

  // Saved playback position for one specific episode, so the watch page can seek
  // the player to where the user left off ("resume"). Returns the position in
  // seconds, or null when there's nothing meaningful to resume to — no row, a
  // finished episode, a position right at the start, or one within the last few
  // seconds of the runtime (treat those as "done", start fresh).
  const fetchResumePosition = useCallback(async (anilistId, season, episode) => {
    if (!sessionToken) return null;
    try {
      const res = await apiFetch(`/account/progress`);
      if (!res.ok) return null;
      const data = await res.json();
      const row = (data.progress || []).find(p =>
        String(p.anilist_id) === String(anilistId) &&
        Number(p.season_number) === Number(season) &&
        Number(p.episode_number) === Number(episode)
      );
      if (!row || row.status === 'completed') return null;
      const pos = row.position_seconds || 0;
      const dur = row.duration_seconds || 0;
      if (pos < 5) return null;
      if (dur && pos > dur - 15) return null;
      return pos;
    } catch (e) {
      console.error("Resume position fetch error:", e);
      return null;
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken) {
      fetchProfile();
      fetchContinueWatching();
      fetchRecent();
    }
  }, [sessionToken, fetchProfile, fetchContinueWatching, fetchRecent]);

  return {
    profile,
    continueWatching,
    recentlyWatched,
    loading,
    updateProgress,
    fetchResumePosition,
    removeFromHistory,
    refreshContinueWatching: fetchContinueWatching,
    refreshRecent: fetchRecent
  };
}
