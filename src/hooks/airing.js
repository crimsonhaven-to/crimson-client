// Airing calendar and per-title follows (backend: notify_engine).
//
// Two separate concerns on purpose, because they are read in different places
// and at different costs:
//
//   useAiringCalendar  the whole week's schedule, one request, calendar page only
//   useSubscriptions   just your follows, cheap enough to mount inside the
//                      per-title follow button as well as the settings list
//
// A follow is keyed by anilist_id alone: the schedule comes from AniList, so a
// title with no AniList id has nothing to be notified about.
import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch, useSessionToken } from './apiClient';
import { groupByLocalDay } from '../airingFormat';

// The backend caps the window at a month; a week is what the page draws.
export const CALENDAR_DAYS = 7;
// One day of already-aired episodes, so "yesterday" is still on screen for
// someone opening the page in the morning.
export const CALENDAR_BACK = 1;

export function useAiringCalendar({ days = CALENDAR_DAYS, back = CALENDAR_BACK } = {}) {
  const sessionToken = useSessionToken();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!sessionToken) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/calendar?days=${days}&back=${back}`);
      if (!res.ok) throw new Error('calendar unavailable');
      setItems((await res.json()).items || []);
    } catch (e) {
      console.error('Calendar fetch error:', e);
      setError('The schedule could not be read just now.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, days, back]);

  useEffect(() => { refresh(); }, [refresh]);

  const byDay = useMemo(() => groupByLocalDay(items), [items]);

  return { items, byDay, loading, error, refresh };
}

export function useSubscriptions() {
  const sessionToken = useSessionToken();
  const [subscriptions, setSubscriptions] = useState([]);
  // Whether a follow can actually mail this account. A mnemonic identity has no
  // address and an unverified one must not be written to, so the UI says why
  // instead of leaving the user waiting for an email that will never come.
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!sessionToken) { setSubscriptions([]); setLoading(false); return; }
    try {
      const res = await apiFetch('/account/subscriptions');
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
        setEmailNotifications(Boolean(data.email_notifications));
      }
    } catch (e) {
      console.error('Subscriptions fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { refresh(); }, [refresh]);

  const isFollowing = useCallback(
    (anilistId) => subscriptions.some((s) => String(s.anilist_id) === String(anilistId)),
    [subscriptions]
  );

  const follow = useCallback(async (item, notifyEmail = true) => {
    if (!sessionToken || item?.anilist_id == null) return false;
    try {
      const res = await apiFetch('/account/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anilist_id: item.anilist_id,
          title: item.title || null,
          poster: item.poster || null,
          notify_email: notifyEmail,
        }),
      });
      if (res.ok) { await refresh(); return true; }
    } catch (e) {
      console.error('Follow error:', e);
    }
    return false;
  }, [sessionToken, refresh]);

  const unfollow = useCallback(async (anilistId) => {
    if (!sessionToken) return false;
    try {
      const res = await apiFetch(`/account/subscriptions/${anilistId}`, { method: 'DELETE' });
      // 404 means it was already gone, which is the state the caller wanted.
      if (res.ok || res.status === 404) { await refresh(); return true; }
    } catch (e) {
      console.error('Unfollow error:', e);
    }
    return false;
  }, [sessionToken, refresh]);

  return {
    subscriptions, emailNotifications, loading,
    isFollowing, follow, unfollow, refresh,
  };
}
