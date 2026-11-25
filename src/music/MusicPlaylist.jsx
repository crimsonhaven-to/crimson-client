// Tracks Spotify has dropped stay listed at the end, marked, because keeping them is
// the point of this whole surface.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowDownToLine, CopyPlus, Pause, Play, Plus, RefreshCw, Shuffle, Trash2, WifiOff, X,
} from 'lucide-react';

import { musicApi, useMusicPlaylist } from './hooks';
import { Cover } from './Cover';
import AddSongsDialog from './AddSongsDialog';
import CoverEditor from './CoverEditor';
import DownloadButton from './DownloadButton';
import NewPlaylistDialog from './NewPlaylistDialog';
import { refreshDownload, savedPlaylist, useDownloads } from './downloads';
import QueueButton from './QueueButton';
import ReviewDialog from './ReviewDialog';
import TrackFilters from './TrackFilters';
import { StatusCell } from './TrackStatus';
import { filterTracks, useTrackFilter } from './trackFilter';
import { formatTime } from './queue';
import { currentTrack, playTracks, toggle, useMusicPlayer } from './player';

const SOURCE_LABEL = { spotify: 'Spotify', public: 'Public link', csv: 'CSV import', local: 'Your playlist' };
const SYNCED_SOURCES = ['spotify', 'public'];

export default function MusicPlaylist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const live = useMusicPlaylist(id);
  const downloads = useDownloads();
  // A request that never reached the server has no status: that is being offline.
  const saved = live.error && !live.error.status ? savedPlaylist(id, downloads) : null;
  const offline = !!saved;
  const { playlist, tracks } = saved || live;
  const { loading, error, reload } = live;
  const player = useMusicPlayer();
  const playing = currentTrack(player);
  const [reviewing, setReviewing] = useState(null);
  // A playlist that was just created opens straight into the song search.
  const [adding, setAdding] = useState(!!location.state?.addSongs);
  const [copying, setCopying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const filter = useTrackFilter();

  // Every fresh listing keeps a downloaded copy in step with the server.
  useEffect(() => {
    if (live.playlist) refreshDownload(live.playlist, live.tracks);
  }, [live.playlist, live.tracks]);

  if (loading) {
    return <div className="py-32 text-center text-crimson-400 animate-pulse text-[11px] font-black uppercase tracking-[0.2em]">Opening the playlist...</div>;
  }
  if ((error && !offline) || !playlist) {
    return (
      <div className="py-32 text-center space-y-4">
        <p className="text-crimson-400 text-sm font-bold">{error?.message || 'Playlist not found.'}</p>
        <Link to="/music" className="text-crimson-500 text-[11px] font-black uppercase tracking-widest">Back to your music</Link>
      </div>
    );
  }

  const isPlayable = (t) => t.status === 'ready' && (!offline || downloads.stored.has(t.id));
  const readyCount = tracks.filter(isPlayable).length;
  // Play, shuffle and queue all act on what the filter leaves.
  const shown = filterTracks(tracks, filter);
  const ready = shown.filter(isPlayable);
  const source = { name: playlist.name, path: `/music/playlist/${playlist.id}` };
  const isThisPlaylist = player.source?.path === source.path;
  const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
  const own = playlist.source === 'local' && !offline;

  // Dropping the flag keeps a reload or a step back from opening the search again.
  const closeAdding = () => {
    setAdding(false);
    if (location.state?.addSongs) navigate(location.pathname, { replace: true, state: null });
  };

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
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10">
      <Link to="/music" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300">
        <ArrowLeft className="w-4 h-4" /> Your music
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 sm:items-end">
        {offline
          ? <Cover src={playlist.cover_url} className="w-44 h-44 sm:w-52 sm:h-52 rounded-3xl shadow-2xl flex-shrink-0" />
          : <CoverEditor playlist={playlist} className="w-44 h-44 sm:w-52 sm:h-52" onChanged={reload} onError={setNotice} />}
        <div className="min-w-0 space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-crimson-500">{SOURCE_LABEL[playlist.source] || playlist.source}</p>
          <h1 className="text-3xl sm:text-5xl font-black text-crimson-50 tracking-tighter leading-none break-words">{playlist.name}</h1>
          <p className="text-xs font-bold text-crimson-400">
            {offline && <span className="inline-flex items-center gap-1 text-amber-300 mr-2"><WifiOff className="w-3.5 h-3.5" /> Offline, from this device ·</span>}
            {readyCount} of {tracks.length} on the share · {formatTime(totalMs / 1000)}
            {playlist.last_error && <span className="text-amber-400"> · last sync failed: {playlist.last_error}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              disabled={!ready.length}
              onClick={() => (isThisPlaylist ? toggle() : playTracks(ready, 0, source, { shuffle: false }))}
              className="flex items-center gap-2 px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              {isThisPlaylist && player.playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
              {isThisPlaylist && player.playing ? 'Pause' : 'Play'}
            </button>
            <button
              disabled={!ready.length}
              onClick={() => playTracks(ready, Math.floor(Math.random() * ready.length), source, { shuffle: true })}
              className="flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
            <QueueButton tracks={ready} source={source} label="Queue"
              className="flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40" />
            {own && (
              <button onClick={() => setAdding(true)}
                className="flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[11px] font-black uppercase tracking-widest">
                <Plus className="w-4 h-4" /> Add songs
              </button>
            )}
            {!offline && <DownloadButton playlist={playlist} tracks={tracks} />}
            {!offline && (
              <button onClick={() => setCopying(true)} title={own ? 'Duplicate this playlist' : 'Make a copy you can edit'}
                className="flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[11px] font-black uppercase tracking-widest">
                <CopyPlus className="w-4 h-4" /> {own ? 'Duplicate' : 'Copy to edit'}
              </button>
            )}
            {SYNCED_SOURCES.includes(playlist.source) && !offline && (
              <>
                <button disabled={busy} onClick={() => run(() => musicApi.sync(playlist.id), 'Synced.')}
                  className="flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40">
                  <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Sync now
                </button>
                <label className="flex items-center gap-2 px-3 text-[11px] font-black uppercase tracking-widest text-crimson-500 cursor-pointer select-none">
                  <input type="checkbox" className="accent-crimson-600" checked={playlist.sync_enabled} disabled={busy}
                    onChange={(e) => run(() => musicApi.setSync(playlist.id, e.target.checked))} />
                  Keep in sync
                </label>
              </>
            )}
            {!offline && (
              <button disabled={busy} onClick={remove} aria-label="Remove playlist" title="Remove playlist"
                className="p-3 rounded-2xl text-crimson-400 hover:text-crimson-200 hover:bg-crimson-900/30 disabled:opacity-40">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {notice && <p className="text-xs font-bold text-crimson-300">{notice}</p>}
        </div>
      </div>

      {own && tracks.length === 0 && (
        <div className="py-16 text-center space-y-4 border-t border-crimson-900/30">
          <p className="text-crimson-500 text-sm">No songs yet.</p>
          <button onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest">
            <Plus className="w-4 h-4" /> Add songs
          </button>
        </div>
      )}

      {tracks.length > 0 && <TrackFilters tracks={tracks} filter={filter} />}
      {tracks.length > 0 && shown.length === 0 && (
        <p className="py-10 text-center text-crimson-400 text-sm">Nothing in this playlist matches.</p>
      )}

      <ol className="divide-y divide-crimson-900/30 border-t border-crimson-900/30">
        {shown.map((track, index) => {
          const isCurrent = playing?.id === track.id;
          const playable = isPlayable(track);
          return (
            <li key={track.id} className={`flex items-center gap-3 py-2.5 px-2 rounded-xl ${isCurrent ? 'bg-crimson-600/10' : ''} ${track.removed_upstream ? 'opacity-70' : ''}`}>
              <button
                disabled={!playable}
                onClick={() => (isCurrent ? toggle() : playTracks(ready, ready.indexOf(track), source))}
                className="flex items-center gap-3 min-w-0 flex-grow text-left disabled:cursor-default group"
                aria-label={playable ? `Play ${track.title}` : track.title}
              >
                <span className="w-6 text-right text-[11px] font-bold text-crimson-400 tabular-nums flex-shrink-0">
                  {isCurrent && player.playing ? <Play className="w-3.5 h-3.5 inline text-crimson-500" fill="currentColor" /> : index + 1}
                </span>
                <Cover src={track.cover_url} className="w-10 h-10 rounded-md flex-shrink-0" />
                <span className="min-w-0">
                  <span className={`block text-sm font-bold truncate ${isCurrent ? 'text-crimson-400' : playable ? 'text-crimson-100 group-hover:text-white' : 'text-crimson-500'}`}>
                    {track.title}
                  </span>
                  <span className="block text-xs text-crimson-400 truncate">
                    {track.artists.join(', ')}{track.album ? ` · ${track.album}` : ''}
                    {track.removed_upstream && <span className="ml-2 text-[11px] font-black uppercase tracking-widest text-amber-400/80">Gone from Spotify</span>}
                  </span>
                </span>
                {downloads.stored.has(track.id) && (
                  <span title="On this device" className="text-emerald-400/70 flex-shrink-0"><ArrowDownToLine className="w-3.5 h-3.5" /></span>
                )}
              </button>
              {playable && (
                <QueueButton tracks={[track]} source={source}
                  className="p-1.5 rounded-lg text-crimson-400 hover:text-white hover:bg-crimson-900/40 flex-shrink-0" />
              )}
              <StatusCell
                track={track}
                onReview={() => setReviewing(track)}
                onRetry={() => run(() => musicApi.retry(track.id))}
              />
              {own && (
                <button disabled={busy} onClick={() => run(() => musicApi.removeSong(playlist.id, track.id))}
                  aria-label={`Remove ${track.title}`} title="Remove from playlist"
                  className="p-1.5 rounded-lg text-crimson-400 hover:text-crimson-300 hover:bg-crimson-900/40 disabled:opacity-40 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
              <span className="hidden sm:block w-12 text-right text-[11px] text-crimson-400 tabular-nums flex-shrink-0">{formatTime(track.duration_ms / 1000)}</span>
            </li>
          );
        })}
      </ol>

      {copying && <NewPlaylistDialog from={playlist} onClose={() => setCopying(false)} />}

      {adding && (
        <AddSongsDialog playlist={playlist} onClose={closeAdding} onAdded={reload} />
      )}

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
