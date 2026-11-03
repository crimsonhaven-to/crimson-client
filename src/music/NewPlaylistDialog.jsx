// A new playlist opens straight into the song search, since an empty one is only a
// first step. Given `from`, it copies that playlist instead, which is how an import
// becomes something the member can edit.
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { musicApi } from './hooks';
import Sheet from './Sheet';

export default function NewPlaylistDialog({ from = null, onClose }) {
  const navigate = useNavigate();
  const [name, setName] = useState(from ? `${from.name} (copy)` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (from) {
        const { playlist } = await musicApi.clonePlaylist(from.id, name.trim());
        onClose();
        navigate(`/music/playlist/${playlist.id}`);
      } else {
        const { playlist } = await musicApi.createPlaylist(name.trim());
        navigate(`/music/playlist/${playlist.id}`, { state: { addSongs: true } });
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Sheet as="form" onSubmit={create} label={from ? 'Copy playlist' : 'New playlist'} onClose={onClose} className="sm:max-w-md p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-grow">
          <p className="text-[11px] font-black uppercase tracking-widest text-crimson-500">{from ? 'Copy playlist' : 'New playlist'}</p>
          <p className="text-[11px] text-crimson-400 mt-1">
            {from
              ? 'Your own copy with the same songs, to edit freely. The original keeps following its source.'
              : 'Kept only here. Add songs to it by searching, no Spotify needed.'}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-crimson-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        placeholder="Name it"
        autoFocus
        className="w-full px-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-400 text-sm focus:outline-none focus:border-crimson-500"
      />
      {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose}
          className="px-5 py-2.5 rounded-xl text-crimson-400 hover:text-white text-[11px] font-black uppercase tracking-widest">
          Cancel
        </button>
        <button type="submit" disabled={busy || !name.trim()}
          className="px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : from ? 'Copy' : 'Create'}
        </button>
      </div>
    </Sheet>
  );
}
