// Connecting a member's own Spotify app, and picking which of their playlists
// to import once connected. There is no server-wide Spotify setting: each
// member registers an app (or is added to someone's) and pastes its client ID.
import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Unplug } from 'lucide-react';
import { Link } from 'react-router-dom';

import { musicApi } from '../hooks';
import { Cover } from './Cover';
import { beginAuthorization, isClientId, redirectUri } from './spotifyAuth';

const DASHBOARD = 'https://developer.spotify.com/dashboard';

function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(value).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
  return (
    <div className="flex items-center gap-2 bg-crimson-950/60 border border-crimson-900/60 rounded-xl pl-3 pr-1 py-1">
      <code className="text-xs text-crimson-200 truncate flex-grow">{value}</code>
      <button type="button" onClick={copy} aria-label="Copy" className="p-2 text-crimson-500 hover:text-white">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function ConnectForm({ scopes }) {
  const [clientId, setClientId] = useState('');
  const [starting, setStarting] = useState(false);
  const valid = isClientId(clientId);

  const connect = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setStarting(true);
    await beginAuthorization(clientId.trim(), scopes);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-200/90">
        <p className="font-black uppercase tracking-widest text-[10px] text-amber-300 mb-1">Spotify Premium needed</p>
        Spotify only opens its developer API to apps owned by a Premium account. Without Premium,
        add a <strong>public</strong> playlist by its link below (first 100 songs), or upload a CSV export.
      </div>

      <ol className="space-y-4 text-sm text-crimson-300">
        <li>
          <span className="font-black text-crimson-500 mr-2">1</span>
          Open the <a href={DASHBOARD} target="_blank" rel="noopener noreferrer" className="text-crimson-400 underline underline-offset-2 hover:text-white">Spotify developer dashboard <ExternalLink className="w-3 h-3 inline" /></a>{' '}
          and create an app. Any name works; tick <em>Web API</em>.
        </li>
        <li className="space-y-2">
          <p><span className="font-black text-crimson-500 mr-2">2</span>Add this exact Redirect URI to the app:</p>
          <CopyField value={redirectUri()} />
        </li>
        <li>
          <span className="font-black text-crimson-500 mr-2">3</span>
          Using someone else&apos;s app instead? They add your Spotify email under <em>User Management</em>.
        </li>
        <li>
          <p className="mb-2"><span className="font-black text-crimson-500 mr-2">4</span>Paste the app&apos;s Client ID. There is no secret to paste.</p>
          <form onSubmit={connect} className="flex gap-2">
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="32 character Client ID"
              spellCheck={false}
              className="flex-grow min-w-0 px-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-700 text-sm font-mono focus:outline-none focus:border-crimson-500"
            />
            <button type="submit" disabled={!valid || starting}
              className="px-5 bg-[#1db954] hover:bg-[#1ed760] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
            </button>
          </form>
        </li>
      </ol>
    </div>
  );
}

function PlaylistPicker({ onImported }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(null);

  const load = () => {
    setError(null);
    musicApi.spotifyPlaylists().then((d) => setList(d.playlists), (e) => setError(e.message));
  };

  const add = async (playlist) => {
    setImporting(playlist.spotify_id);
    setError(null);
    try {
      const result = await musicApi.importPlaylist('spotify', playlist.spotify_id);
      setList((items) => items.map((p) => (
        p.spotify_id === playlist.spotify_id ? { ...p, imported_id: result.playlist.id } : p
      )));
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(null);
    }
  };

  if (!list) {
    return (
      <div className="space-y-2">
        <button onClick={load} className="px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
          Choose playlists
        </button>
        {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
      <ul className="max-h-96 overflow-y-auto divide-y divide-crimson-900/30 rounded-2xl border border-crimson-900/40">
        {list.map((p) => (
          <li key={p.spotify_id} className="flex items-center gap-3 p-2.5">
            <Cover src={p.cover_url} className="w-10 h-10 rounded-md flex-shrink-0" />
            <div className="min-w-0 flex-grow">
              <p className="text-sm font-bold text-crimson-100 truncate">{p.name}</p>
              <p className="text-xs text-crimson-600 truncate">
                {[p.owner, p.track_count != null && `${p.track_count} songs`].filter(Boolean).join(' · ')}
              </p>
            </div>
            {p.imported_id ? (
              <Link to={`/music/playlist/${p.imported_id}`} className="text-[10px] font-black uppercase tracking-widest text-green-400 px-3">Added</Link>
            ) : (
              <button onClick={() => add(p)} disabled={!!importing}
                className="px-3 py-2 rounded-xl bg-crimson-900/50 hover:bg-crimson-700 text-crimson-100 text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
                {importing === p.spotify_id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SpotifyCard({ status, onChanged }) {
  const [busy, setBusy] = useState(false);
  const spotify = status.spotify;

  const disconnect = async () => {
    if (!window.confirm('Disconnect Spotify? Imported playlists stay, but stop syncing.')) return;
    setBusy(true);
    try {
      await musicApi.disconnectSpotify();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-crimson-950/30 border border-crimson-900/40 rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: spotify.connected ? '#1db954' : '#6b1020' }} />
        <h2 className="text-[10px] font-black uppercase tracking-widest text-crimson-400 flex-grow">
          {spotify.connected ? `Spotify: ${spotify.display_name || 'connected'}` : 'Connect Spotify'}
        </h2>
        {spotify.connected && (
          <button onClick={disconnect} disabled={busy} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-crimson-700 hover:text-crimson-400">
            <Unplug className="w-3.5 h-3.5" /> Disconnect
          </button>
        )}
      </div>
      {spotify.connected ? <PlaylistPicker onImported={onChanged} /> : <ConnectForm scopes={status.scopes} />}
    </section>
  );
}
