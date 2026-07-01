// External player tracks: OpenSubtitles subtitles + AniSkip intro/outro times.
// Both are best-effort backend reads that resolve to []/null on any error so
// playback is never blocked by a missing extra. Lifted verbatim from hooks.js.
import { API_BASE_URL } from './config';
import { apiFetch } from './apiClient';
import { cleanSubtitleLanguages } from './playbackPrefs';

// Fetch OpenSubtitles tracks for a title from the backend (GET /subtitles), as
// `[{ url, lang, label }]` ready to merge into CrimsonPlayer's `subtitles` prop.
// `url` is absolutised to API_BASE_URL because the player's <track> loads it
// cross-origin (the backend is a separate origin). Best-effort: any error (incl.
// the 503 when OpenSubtitles isn't configured) resolves to [] so playback is never
// blocked by missing subtitles. Pass the SHOW's tmdb id for episodes.
export async function fetchSubtitles({ tmdbId, season = null, episode = null, isMovie = false, languages = [] } = {}) {
  const langs = cleanSubtitleLanguages(languages);
  if (!tmdbId || !langs.length) return [];
  const p = new URLSearchParams({ tmdb_id: String(tmdbId), languages: langs.join(',') });
  if (isMovie) p.set('is_movie', 'true');
  else {
    if (season != null) p.set('season', String(season));
    if (episode != null) p.set('episode', String(episode));
  }
  try {
    const res = await apiFetch(`/subtitles?${p.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const subs = Array.isArray(data?.subtitles) ? data.subtitles : [];
    return subs
      .filter((s) => s && s.url)
      .map((s) => ({
        url: s.url.startsWith('http') ? s.url : `${API_BASE_URL}${s.url}`,
        lang: s.lang,
        label: s.label || (s.lang || '').toUpperCase(),
      }));
  } catch {
    return [];
  }
}

// Fetch AniSkip intro/outro (OP/ED) skip timestamps for an anime episode from the
// backend (GET /skiptimes), as `{ op:{start,end}, ed:{start,end} }` (either may be
// null). AniList-keyed, so this is anime-only — non-anime titles have no
// `anilist_id` and the caller simply won't invoke it. Best-effort: any error, or a
// title/episode AniSkip has no submissions for, resolves to null so the player just
// shows no skip affordances.
export async function fetchSkipTimes({ anilistId, episode, episodeLength = 0 } = {}) {
  if (!anilistId || !episode) return null;
  const p = new URLSearchParams({ anilist_id: String(anilistId), episode: String(episode) });
  if (episodeLength) p.set('episode_length', String(Math.round(episodeLength)));
  try {
    const res = await apiFetch(`/skiptimes?${p.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.found) return null;
    return { op: data.op || null, ed: data.ed || null };
  } catch {
    return null;
  }
}
