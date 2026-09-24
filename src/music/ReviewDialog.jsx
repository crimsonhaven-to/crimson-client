// Picking the recording for a track the matcher would not decide by itself.
// Shows what it found with its reasons, lets the member search again, or paste
// a link. A pick is remembered on the server and never second-guessed.
import { useEffect, useState } from 'react';
import { Check, Link2, Loader2, Search, X } from 'lucide-react';

import { musicApi } from '../hooks';
import SearchResult from './SearchResult';
import { formatTime } from './queue';

function deltaLabel(candidateMs, trackMs) {
  if (!candidateMs || !trackMs) return null;
  const seconds = Math.round((candidateMs - trackMs) / 1000);
  if (Math.abs(seconds) <= 1) return 'exact length';
  return `${Math.abs(seconds)}s ${seconds > 0 ? 'longer' : 'shorter'}`;
}

export default function ReviewDialog({ track, onClose, onChosen }) {
  const [candidates, setCandidates] = useState(null);
  const [query, setQuery] = useState(`${track.artists[0] || ''} ${track.title}`.trim());
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    musicApi.candidates(track.id)
      .then((d) => setCandidates(d.candidates))
      .catch((e) => { setCandidates([]); setError(e.message); });
  }, [track.id]);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setCandidates((await musicApi.search(query.trim())).results);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const choose = async (url) => {
    setBusy(true);
    setError(null);
    try {
      await musicApi.chooseMatch(track.id, url);
      onChosen();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col bg-crimson-950 border border-crimson-900/60 rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Pick a recording"
      >
        <div className="p-5 border-b border-crimson-900/40 flex items-start gap-4">
          <div className="min-w-0 flex-grow">
            <p className="text-[10px] font-black uppercase tracking-widest text-crimson-500">Pick the recording</p>
            <p className="text-crimson-50 font-bold truncate mt-1">{track.title}</p>
            <p className="text-xs text-crimson-400 truncate">
              {track.artists.join(', ')}{track.album ? ` · ${track.album}` : ''} · {formatTime(track.duration_ms / 1000)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-crimson-600 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={search} className="p-4 flex gap-2 border-b border-crimson-900/30">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search again..."
            className="flex-grow min-w-0 px-4 py-2.5 bg-crimson-950/40 border border-crimson-900/60 rounded-xl text-sm text-crimson-50 placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
          <button type="submit" disabled={busy} className="px-4 rounded-xl bg-crimson-900/60 hover:bg-crimson-800 text-crimson-200 disabled:opacity-40" aria-label="Search">
            <Search className="w-4 h-4" />
          </button>
        </form>

        <div className="overflow-y-auto flex-grow p-2">
          {error && <p className="px-3 py-2 text-xs font-bold text-amber-400">{error}</p>}
          {candidates === null || busy ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 text-crimson-600 animate-spin" /></div>
          ) : candidates.length === 0 ? (
            <p className="py-12 text-center text-crimson-700 text-sm italic">Nothing found. Search again or paste a link below.</p>
          ) : (
            <ul className="space-y-1">
              {candidates.map((c) => {
                const delta = deltaLabel(c.duration_ms, track.duration_ms);
                return (
                  <SearchResult
                    key={c.url}
                    result={c}
                    detail={`${delta ? ` · ${delta}` : ''}${c.score > 0 ? ` · ${Math.round(c.score * 100)}%` : ''}`}
                    note={c.reasons?.join(' ')}
                  >
                    <button onClick={() => choose(c.url)} disabled={busy} aria-label="Use this recording"
                      className="p-2 rounded-lg bg-crimson-600 hover:bg-crimson-500 text-white disabled:opacity-40">
                      <Check className="w-4 h-4" />
                    </button>
                  </SearchResult>
                );
              })}
            </ul>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (link.trim()) choose(link.trim()); }}
          className="p-4 border-t border-crimson-900/40 flex gap-2">
          <div className="relative flex-grow min-w-0">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-700" />
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste a YouTube, SoundCloud or Bandcamp link"
              className="w-full pl-9 pr-3 py-2.5 bg-crimson-950/40 border border-crimson-900/60 rounded-xl text-sm text-crimson-50 placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
          </div>
          <button type="submit" disabled={busy || !link.trim().startsWith('https://')}
            className="px-4 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
            Use
          </button>
        </form>
      </div>
    </div>
  );
}
