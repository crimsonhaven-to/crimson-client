import { useState } from 'react';
import { Search, X } from 'lucide-react';

import { genreCounts } from './trackFilter';

// Spotify hands out micro genres by the dozen; past this many the chips hide
// behind a button instead of filling the screen.
const CHIPS_SHOWN = 12;

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-colors ${active
        ? 'bg-crimson-600 border-crimson-500 text-white'
        : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-300 hover:text-white hover:border-crimson-600'}`}>
      {children}
    </button>
  );
}

export default function TrackFilters({ tracks, filter }) {
  const [allGenres, setAllGenres] = useState(false);
  const genres = genreCounts(tracks);
  const shown = allGenres ? genres : genres.slice(0, CHIPS_SHOWN);
  // A genre picked from the full list stays visible after the list folds.
  if (filter.genre && !shown.some((g) => g.name === filter.genre)) {
    const picked = genres.find((g) => g.name === filter.genre);
    if (picked) shown.push(picked);
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-crimson-950/60 border border-crimson-900/60 focus-within:border-crimson-600">
        <Search className="w-4 h-4 text-crimson-400 flex-shrink-0" />
        <input type="search" value={filter.query} onChange={(e) => filter.setQuery(e.target.value)}
          placeholder="Search title, artist, album or genre"
          className="min-w-0 flex-grow bg-transparent text-sm text-crimson-100 placeholder:text-crimson-400 outline-none" />
        {filter.query && (
          <button onClick={() => filter.setQuery('')} aria-label="Clear search" className="p-1 rounded-lg text-crimson-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </label>
      {genres.length > 0 && (
        <div className={`flex gap-2 pb-1 ${allGenres ? 'flex-wrap' : 'overflow-x-auto'}`}>
          <Chip active={!filter.genre} onClick={() => filter.setGenre('')}>All genres</Chip>
          {shown.map((g) => (
            <Chip key={g.name} active={filter.genre === g.name}
              onClick={() => filter.setGenre(filter.genre === g.name ? '' : g.name)}>
              {g.name} <span className="opacity-60 tabular-nums">{g.count}</span>
            </Chip>
          ))}
          {genres.length > CHIPS_SHOWN && (
            <button onClick={() => setAllGenres(!allGenres)}
              className="flex-shrink-0 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-crimson-400 hover:text-crimson-200">
              {allGenres ? 'Fewer' : `All ${genres.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
