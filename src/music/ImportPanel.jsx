// Every way to a new playlist: a playlist of your own filled by search, a
// Spotify link, and a CSV export. Without a Spotify connection a link is read
// from the public page; with one it goes through the Web API, which reads
// private playlists and every song.
import { useRef, useState } from 'react';
import { ExternalLink, FileUp, Link2, ListPlus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { musicApi } from '../hooks';

const EXPORTIFY = 'https://exportify.app';

export default function ImportPanel({ connected }) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const opened = (result) => navigate(`/music/playlist/${result.playlist.id}`);

  const addLink = async (e) => {
    e.preventDefault();
    if (!link.trim()) return;
    setBusy('link');
    setError(null);
    try {
      opened(await musicApi.importPlaylist(connected ? 'spotify' : 'public', link.trim()));
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('create');
    setError(null);
    try {
      opened(await musicApi.createPlaylist(name.trim()));
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  const addCsv = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('csv');
    setError(null);
    try {
      const name = file.name.replace(/\.csv$/i, '') || 'Imported playlist';
      opened(await musicApi.importCsv(name, await file.text()));
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  return (
    <section className="bg-crimson-950/30 border border-crimson-900/40 rounded-3xl p-5 sm:p-6 space-y-5">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-crimson-400">Add a playlist</h2>

      <form onSubmit={create} className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-grow min-w-0">
            <ListPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-700" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="Name a new playlist"
              className="w-full pl-11 pr-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-700 text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>
          <button type="submit" disabled={!!busy || !name.trim()}
            className="px-5 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
            {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
          </button>
        </div>
        <p className="text-[11px] text-crimson-600 leading-relaxed">
          Your own playlist, kept only here. Add songs to it by searching, no Spotify needed.
        </p>
      </form>

      <form onSubmit={addLink} className="border-t border-crimson-900/30 pt-5 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-grow min-w-0">
            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-700" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              className="w-full pl-11 pr-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-700 text-sm focus:outline-none focus:border-crimson-500"
            />
          </div>
          <button type="submit" disabled={!!busy || !link.trim()}
            className="px-5 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
            {busy === 'link' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
          </button>
        </div>
        <p className="text-[11px] text-crimson-600 leading-relaxed">
          {connected
            ? 'Read through your Spotify connection: private playlists work, and every song comes across.'
            : 'Without a Spotify connection only public playlists can be read, and only their first 100 songs, without album names.'}
        </p>
      </form>

      <div className="border-t border-crimson-900/30 pt-5 space-y-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={addCsv} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={!!busy}
          className="flex items-center gap-2 px-5 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
          {busy === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} Upload a CSV
        </button>
        <p className="text-[11px] text-crimson-600 leading-relaxed">
          Export a playlist with <a href={EXPORTIFY} target="_blank" rel="noopener noreferrer" className="text-crimson-400 underline underline-offset-2 hover:text-white">Exportify <ExternalLink className="w-3 h-3 inline" /></a>{' '}
          and upload the file as it is. A CSV is a one-off: it does not sync.
        </p>
      </div>

      {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
    </section>
  );
}
