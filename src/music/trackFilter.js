// Search and genre filtering for a list of tracks, shared by a playlist and All
// titles. Done here rather than on the server because both views already hold
// every track, and offline there is no server to ask.
import { useSearchParams } from 'react-router-dom';

function haystack(track) {
  return [track.title, track.album, ...(track.artists || []), ...(track.genres || [])]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

// Every word has to appear somewhere, so "daft house" finds Daft Punk's house
// tracks without the words having to sit next to each other.
export function matchesQuery(track, query) {
  const words = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = haystack(track);
  return words.every((word) => text.includes(word));
}

export function filterTracks(tracks, { query = '', genre = '' } = {}) {
  return tracks.filter(
    (t) => (!genre || (t.genres || []).includes(genre)) && matchesQuery(t, query),
  );
}

// Most common first, then by name, so the chips lead with what the list is mostly made of.
export function genreCounts(tracks) {
  const counts = new Map();
  for (const track of tracks) {
    for (const genre of track.genres || []) counts.set(genre, (counts.get(genre) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// The filter lives in the URL, so stepping back from a playlist returns to the
// list as it was filtered.
export function useTrackFilter() {
  const [params, setParams] = useSearchParams();
  const set = (key, value) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: true });
  return {
    query: params.get('q') || '',
    genre: params.get('genre') || '',
    setQuery: (value) => set('q', value),
    setGenre: (value) => set('genre', value),
  };
}
