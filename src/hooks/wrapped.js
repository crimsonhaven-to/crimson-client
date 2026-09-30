// "Busiest day" and "longest streak" depend on the viewer's timezone.
// getTimezoneOffset() has the opposite sign of a UTC offset, hence the negation.
import { useEffect, useState } from 'react';

import { apiFetch, useSessionToken } from './apiClient';

export const utcOffsetMinutes = () => -new Date().getTimezoneOffset();

export function useWrapped(year) {
  const sessionToken = useSessionToken();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionToken) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ offset_minutes: String(utcOffsetMinutes()) });
    if (year) params.set('year', String(year));
    apiFetch(`/account/wrapped?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('wrapped unavailable'))))
      .then((payload) => { if (alive) setData(payload); })
      .catch((e) => {
        console.error('Wrapped fetch error:', e);
        if (alive) setError('Your year could not be gathered just now.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sessionToken, year]);

  return { data, loading, error };
}

// The listening half, from the music engine. Only asked for with music access,
// and a failure hides the section rather than the whole page.
export function useMusicWrapped(year, enabled) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    setData(null);
    if (!enabled) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ offset_minutes: String(utcOffsetMinutes()) });
    if (year) params.set('year', String(year));
    apiFetch(`/music/wrapped?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => { if (alive) setData(payload); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [year, enabled]);

  return { data, loading };
}
