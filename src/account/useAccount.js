// Watchlists are deliberately not fetched here (see useWatchlists), so watch and
// account pages do not pay for an unused fetch.
import { useCallback, useEffect, useState } from 'react';

import { apiFetch, useSessionToken } from '../api/client';

export function useAccount() {
  const [profile, setProfile] = useState(null);
  const [continueWatching, setContinueWatching] = useState([]);
  const [recentlyWatched, setRecentlyWatched] = useState([]);
  const [loading, setLoading] = useState(false);

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
      // The server caps at 100; the History page filters over all of it.
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

  // History shows one card per show but stores a row per episode. Every row must
  // go, or the show reappears carrying an older episode.
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
      fetchRecent();
      return false;
    }
  }, [sessionToken, fetchRecent]);


  // Must stay referentially stable: the watch page keys its periodic-save effect
  // on it, and re-running that effect loses the tracked playback position.
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

  // Null when there is nothing worth resuming: a finished episode, or a position
  // in the first few or last few seconds.
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
