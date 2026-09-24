// Naming a playlist of your own. It opens straight into the song search, since
// an empty playlist is only a first step.
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { musicApi } from '../hooks';

export default function NewPlaylistDialog({ onClose }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { playlist } = await musicApi.createPlaylist(name.trim());
      navigate(`/music/playlist/${playlist.id}`, { state: { addSongs: true } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <form
        onSubmit={create}
        className="w-full sm:max-w-md bg-crimson-950 border border-crimson-900/60 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="New playlist"
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-grow">
            <p className="text-[10px] font-black uppercase tracking-widest text-crimson-500">New playlist</p>
            <p className="text-[11px] text-crimson-600 mt-1">Kept only here. Add songs to it by searching, no Spotify needed.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-crimson-600 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="Name it"
          autoFocus
          className="w-full px-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-700 text-sm focus:outline-none focus:border-crimson-500"
        />
        {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-crimson-400 hover:text-white text-[10px] font-black uppercase tracking-widest">
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim()}
            className="px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
