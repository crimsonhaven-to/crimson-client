// Filling one of your own playlists: search, then add as many results as you
// like. The dialog stays open, so a whole playlist can be built in one go.
import { useState } from 'react';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';

import { musicApi } from '../hooks';
import SearchResult from './SearchResult';

export default function AddSongsDialog({ playlist, onClose, onAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  // url -> 'adding' | 'added' | 'already'
  const [added, setAdded] = useState({});
  const [error, setError] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults((await musicApi.search(query.trim())).results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const add = async (result) => {
    setAdded((a) => ({ ...a, [result.url]: 'adding' }));
    setError(null);
    try {
      const { url, title, channel, duration_ms, thumbnail_url } = result;
      const response = await musicApi.addSong(playlist.id, { url, title, channel, duration_ms, thumbnail_url });
      setAdded((a) => ({ ...a, [result.url]: response.added ? 'added' : 'already' }));
      onAdded();
    } catch (err) {
      setAdded((a) => ({ ...a, [result.url]: undefined }));
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col bg-crimson-950 border border-crimson-900/60 rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add songs"
      >
        <div className="p-5 border-b border-crimson-900/40 flex items-start gap-4">
          <div className="min-w-0 flex-grow">
            <p className="text-[10px] font-black uppercase tracking-widest text-crimson-500">Add songs</p>
            <p className="text-crimson-50 font-bold truncate mt-1">{playlist.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-crimson-600 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={search} className="p-4 flex gap-2 border-b border-crimson-900/30">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Artist and song..." autoFocus
            className="flex-grow min-w-0 px-4 py-2.5 bg-crimson-950/40 border border-crimson-900/60 rounded-xl text-sm text-crimson-50 placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
          <button type="submit" disabled={searching || !query.trim()} className="px-4 rounded-xl bg-crimson-900/60 hover:bg-crimson-800 text-crimson-200 disabled:opacity-40" aria-label="Search">
            <Search className="w-4 h-4" />
          </button>
        </form>

        <div className="overflow-y-auto flex-grow p-2 min-h-[12rem]">
          {error && <p className="px-3 py-2 text-xs font-bold text-amber-400">{error}</p>}
          {searching ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 text-crimson-600 animate-spin" /></div>
          ) : results === null ? (
            <p className="py-12 text-center text-crimson-700 text-sm italic">Search for a song to add it here.</p>
          ) : results.length === 0 ? (
            <p className="py-12 text-center text-crimson-700 text-sm italic">Nothing found. Try other words.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((r) => {
                const state = added[r.url];
                return (
                  <SearchResult key={r.url} result={r} note={state === 'already' ? 'Already in this playlist.' : null}>
                    <button onClick={() => add(r)} disabled={!!state} aria-label={state ? 'Added' : 'Add to playlist'}
                      className={`p-2 rounded-lg text-white disabled:cursor-default ${state ? 'bg-crimson-900/60' : 'bg-crimson-600 hover:bg-crimson-500'}`}>
                      {state === 'adding' ? <Loader2 className="w-4 h-4 animate-spin" /> : state ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </SearchResult>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-crimson-900/40 flex items-center justify-between gap-3">
          <p className="text-[11px] text-crimson-600">Added songs download in the background.</p>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-black uppercase tracking-widest">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
