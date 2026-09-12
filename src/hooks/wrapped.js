// Crimson Wrapped (backend: account_engine/wrapped).
//
// The endpoint answers in whatever timezone it is asked for, because "busiest
// day" and "longest streak" are the two stats that change meaning with where
// the viewer is. getTimezoneOffset() returns minutes to ADD to local time to
// reach UTC, which is the opposite sign of a UTC offset, so it is negated here
// once rather than in every caller.
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
