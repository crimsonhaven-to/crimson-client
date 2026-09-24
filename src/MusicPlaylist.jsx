// One playlist: its tracks in order, what state each is in on the server, and
// playback. Tracks Spotify has dropped stay listed at the end, marked, because
// keeping them is the point of this whole surface.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CircleAlert, Clock, Loader2, Pause, Play, RefreshCw, RotateCw, Search, Shuffle, Trash2,
} from 'lucide-react';

import { musicApi, useMusicPlaylist } from './hooks';
import { Cover } from './music/Cover';
import ReviewDialog from './music/ReviewDialog';
import { formatTime } from './music/queue';
import { currentTrack, playTracks, toggle, useMusicPlayer } from './music/player';

const SOURCE_LABEL = { spotify: 'Spotify', public: 'Public link', csv: 'CSV import' };

function StatusCell({ track, onReview, onRetry }) {
  switch (track.status) {
    case 'ready':
      return null;
    case 'pending':
      return <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-crimson-600"><Clock className="w-3 h-3" /> Queued</span>;
    case 'working':
      return <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-crimson-400"><Loader2 className="w-3 h-3 animate-spin" /> Fetching</span>;
    case 'review':
      return (
        <button onClick={onReview} className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20">
          Pick recording
        </button>
      );
    default:
      return (
        <span className="flex items-center gap-1.5">
          <span title={track.error || ''} className="text-crimson-500"><CircleAlert className="w-4 h-4" /></span>
          <button onClick={onReview} aria-label="Find it by hand" title="Find it by hand" className="p-1.5 rounded-lg text-crimson-400 hover:text-white hover:bg-crimson-900/40"><Search className="w-4 h-4" /></button>
          <button onClick={onRetry} aria-label="Try again" title="Try again" className="p-1.5 rounded-lg text-crimson-400 hover:text-white hover:bg-crimson-900/40"><RotateCw className="w-4 h-4" /></button>
        </span>
      );
  }
}

export default function MusicPlaylist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playlist, tracks, loading, error, reload } = useMusicPlaylist(id);
  const player = useMusicPlayer();
  const playing = currentTrack(player);
  const [reviewing, setReviewing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  if (loading) {
    return <div className="py-32 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Opening the playlist...</div>;
  }
  if (error || !playlist) {
    return (
      <div className="py-32 text-center space-y-4">
        <p className="text-crimson-400 text-sm font-bold">{error?.message || 'Playlist not found.'}</p>
        <Link to="/music" className="text-crimson-500 text-[10px] font-black uppercase tracking-widest">Back to your music</Link>
      </div>
    );
  }

  const ready = tracks.filter((t) => t.status === 'ready');
  const source = { name: playlist.name, path: `/music/playlist/${playlist.id}` };
  const isThisPlaylist = player.source?.path === source.path;
  const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);

  const run = async (action, doneMessage) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (doneMessage) setNotice(doneMessage);
      await reload();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove "${playlist.name}" from your music? Its songs stay on the share.`)) return;
    setBusy(true);
    try {
      await musicApi.deletePlaylist(playlist.id);
      navigate('/music');
    } catch (err) {
      setNotice(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10 animate-in fade-in duration-700">
      <Link to="/music" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300">
        <ArrowLeft className="w-4 h-4" /> Your music
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 sm:items-end">
        <Cover src={playlist.cover_url} className="w-44 h-44 sm:w-52 sm:h-52 rounded-3xl shadow-2xl flex-shrink-0" />
        <div className="min-w-0 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-crimson-500">{SOURCE_LABEL[playlist.source] || playlist.source}</p>
          <h1 className="text-3xl sm:text-5xl font-black text-crimson-50 tracking-tighter leading-none break-words">{playlist.name}</h1>
          <p className="text-xs font-bold text-crimson-400">
            {ready.length} of {tracks.length} on the share · {formatTime(totalMs / 1000)}
            {playlist.last_error && <span className="text-amber-400"> · last sync failed: {playlist.last_error}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              disabled={!ready.length}
              onClick={() => (isThisPlaylist ? toggle() : playTracks(ready, 0, source, { shuffle: false }))}
              className="flex items-center gap-2 px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              {isThisPlaylist && player.playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
              {isThisPlaylist && player.playing ? 'Pause' : 'Play'}
            </button>
            <button
              disabled={!ready.length}
              onClick={() => playTracks(ready, Math.floor(Math.random() * ready.length), source, { shuffle: true })}
              className="flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
            {playlist.source !== 'csv' && (
              <>
                <button disabled={busy} onClick={() => run(() => musicApi.sync(playlist.id), 'Synced.')}
                  className="flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
                  <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Sync now
                </button>
                <label className="flex items-center gap-2 px-3 text-[10px] font-black uppercase tracking-widest text-crimson-500 cursor-pointer select-none">
                  <input type="checkbox" className="accent-crimson-600" checked={playlist.sync_enabled} disabled={busy}
                    onChange={(e) => run(() => musicApi.setSync(playlist.id, e.target.checked))} />
                  Keep in sync
                </label>
              </>
            )}
            <button disabled={busy} onClick={remove} aria-label="Remove playlist" title="Remove playlist"
              className="p-3 rounded-2xl text-crimson-700 hover:text-crimson-400 hover:bg-crimson-900/30 disabled:opacity-40">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {notice && <p className="text-xs font-bold text-crimson-300">{notice}</p>}
        </div>
      </div>

      <ol className="divide-y divide-crimson-900/30 border-t border-crimson-900/30">
        {tracks.map((track, index) => {
          const isCurrent = playing?.id === track.id;
          const playable = track.status === 'ready';
          return (
            <li key={track.id} className={`flex items-center gap-3 py-2.5 px-2 rounded-xl ${isCurrent ? 'bg-crimson-600/10' : ''} ${track.removed_upstream ? 'opacity-70' : ''}`}>
              <button
                disabled={!playable}
                onClick={() => (isCurrent ? toggle() : playTracks(ready, ready.indexOf(track), source))}
                className="flex items-center gap-3 min-w-0 flex-grow text-left disabled:cursor-default group"
                aria-label={playable ? `Play ${track.title}` : track.title}
              >
                <span className="w-6 text-right text-[11px] font-bold text-crimson-700 tabular-nums flex-shrink-0">
                  {isCurrent && player.playing ? <Play className="w-3.5 h-3.5 inline text-crimson-500" fill="currentColor" /> : index + 1}
                </span>
                <Cover src={track.cover_url} className="w-10 h-10 rounded-md flex-shrink-0" />
                <span className="min-w-0">
                  <span className={`block text-sm font-bold truncate ${isCurrent ? 'text-crimson-400' : playable ? 'text-crimson-100 group-hover:text-white' : 'text-crimson-500'}`}>
                    {track.title}
                  </span>
                  <span className="block text-xs text-crimson-600 truncate">
                    {track.artists.join(', ')}{track.album ? ` · ${track.album}` : ''}
                    {track.removed_upstream && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-amber-400/80">Gone from Spotify</span>}
                  </span>
                </span>
              </button>
              <StatusCell
                track={track}
                onReview={() => setReviewing(track)}
                onRetry={() => run(() => musicApi.retry(track.id))}
              />
              <span className="hidden sm:block w-12 text-right text-[11px] text-crimson-700 tabular-nums flex-shrink-0">{formatTime(track.duration_ms / 1000)}</span>
            </li>
          );
        })}
      </ol>

      {reviewing && (
        <ReviewDialog
          track={reviewing}
          onClose={() => setReviewing(null)}
          onChosen={() => { setReviewing(null); reload(); }}
        />
      )}
    </div>
  );
}
