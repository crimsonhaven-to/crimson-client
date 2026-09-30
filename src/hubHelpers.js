// Kept apart from hubKit.jsx because React Fast Refresh needs component-only modules.
import { API_BASE_URL } from './hooks';

export const posterSrc = (poster) =>
  poster ? (poster.startsWith('/') ? `${API_BASE_URL}${poster}` : poster) : null;

export const KIND_STYLE = {
  anime: { label: 'Anime', badge: 'bg-crimson-500/15 border-crimson-500/40 text-crimson-300' },
  show:  { label: 'Show',  badge: 'bg-sky-500/15 border-sky-400/40 text-sky-300' },
  movie: { label: 'Movie', badge: 'bg-amber-500/15 border-amber-400/40 text-amber-200' },
  manga: { label: 'Manga', badge: 'bg-violet-500/15 border-violet-400/40 text-violet-300' },
  local: { label: 'Local', badge: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' },
};
export const kindStyle = (kind) => KIND_STYLE[kind] || KIND_STYLE.anime;

export function applyBrowse(items, { searchTerm = '', genre = null, sort = null } = {}) {
  let out = items;
  if (searchTerm) {
    const lower = searchTerm.trim().toLowerCase();
    out = out.filter((it) => (it.title || '').toLowerCase().includes(lower));
  }
  if (genre) {
    const g = genre.toLowerCase();
    out = out.filter((it) => (it.genres || []).some((x) => x.toLowerCase() === g));
  }
  if (sort) {
    const by = [...out];
    if (sort === 'title') by.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (sort === 'year') by.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    else if (sort === 'rating') by.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    // 'popular' keeps the server order (popularity desc), so no client re-sort.
    if (sort !== 'popular') out = by;
  }
  return out;
}
