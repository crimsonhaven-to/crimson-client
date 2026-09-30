import { Film, Tv, Sparkles, BookOpen } from 'lucide-react';

// Mirrors the routing. Manga rows also carry an AniList id, so media_type 'manga' must be checked first.
export const kindOf = (it) =>
  it.media_type === 'manga' ? 'manga'
    : it.anilist_id != null ? 'anime'
      : it.media_type === 'movie' ? 'movie' : 'show';

// Same key scheme the backend de-dupes on.
export const itemKey = (it) =>
  it.media_type === 'manga' ? `g:${it.anilist_id}`
    : it.anilist_id != null ? `a:${it.anilist_id}`
      : (it.media_type === 'movie' ? `m:${it.tmdb_id}` : `t:${it.tmdb_id}`);

export const overviewHref = (it) =>
  it.media_type === 'manga' ? `/manga/${it.anilist_id}`
    : it.anilist_id ? `/anime/${it.anilist_id}`
      : it.media_type === 'movie' ? `/movie/${it.tmdb_id}` : `/show/${it.tmdb_id}`;

export const TYPE_META = {
  anime: { label: 'Anime', icon: Sparkles },
  show: { label: 'Shows', icon: Tv },
  movie: { label: 'Movies', icon: Film },
  manga: { label: 'Manga', icon: BookOpen },
};
export const TYPE_ORDER = ['anime', 'show', 'movie', 'manga'];
