import { useEffect, useState } from 'react';
import { apiFetch, useSessionToken } from '../api/client';

// Rows come back newest-first, so the first match is the latest episode. Non-anime
// shows also require a null anilist_id, mirroring the backend dedup key.
export function useShowResume({ anilistId = null, tmdbId = null, mediaType = null } = {}) {
  const sessionToken = useSessionToken();
  const [resume, setResume] = useState(null);

  useEffect(() => {
    if (!sessionToken || (anilistId == null && tmdbId == null)) { setResume(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/account/progress`);
        if (!res.ok) return;
        const rows = (await res.json()).progress || [];
        const match = (r) => {
          if (anilistId != null) return String(r.anilist_id) === String(anilistId);
          // Movies share the TMDB id space with shows.
          if (mediaType === 'movie') return String(r.tmdb_id) === String(tmdbId) && r.media_type === 'movie';
          return String(r.tmdb_id) === String(tmdbId) && r.anilist_id == null && r.media_type !== 'movie';
        };
        const latest = rows.find(match) || null;
        if (!cancelled) setResume(latest);
      } catch { /* no banner on failure */ }
    })();
    return () => { cancelled = true; };
  }, [sessionToken, anilistId, tmdbId, mediaType]);

  return resume;
}
