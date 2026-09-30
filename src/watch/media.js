// Both fetches are best-effort and resolve to []/null on any error, so playback is
// never blocked by a missing extra.
import { API_BASE_URL } from '../api/config';
import { apiFetch } from '../api/client';
import { cleanSubtitleLanguages } from '../account/playbackPrefs';

// Pass the SHOW's tmdb id for episodes. `url` is made absolute because the
// player's <track> loads it from the backend's separate origin.
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

// AniSkip is AniList-keyed, so this is anime-only. Returns
// `{ op: {start, end} | null, ed: {start, end} | null }`, or null when unknown.
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
