import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeft, Music, Pause, Play, Shuffle, WifiOff } from 'lucide-react';

import { dedupeSavedTracks, splitPlaylistBadges } from './allTitles';
import { Cover } from './Cover';
import { useDownloads } from './downloads';
import { musicApi, useMusicAllTitles } from './hooks';
import { currentTrack, playTracks, toggle, useMusicPlayer } from './player';
import { formatTime } from './queue';
import ReviewDialog from './ReviewDialog';
import { coverKey } from './trackStore';
import { StatusCell } from './TrackStatus';

const SOURCE = { name: 'All titles', path: '/music/all-titles' };

export default function MusicAllTitles() {
  const live = useMusicAllTitles();
  const downloads = useDownloads();
  // A request that never reached the server has no status: that is being offline.
  const offline = !!(live.error && !live.error.status && Object.keys(downloads.saved).length > 0);
  const tracks = offline
    ? dedupeSavedTracks(downloads.saved, (t) => (t.cover_url ? coverKey(t.id) : null))
    : live.tracks;
  const { loading, error, reload } = live;
  const player = useMusicPlayer();
  const playing = currentTrack(player);
  const [reviewing, setReviewing] = useState(null);
  const [notice, setNotice] = useState(null);

  if (loading) {
    return <div className="py-32 text-center text-crimson-400 animate-pulse text-[11px] font-black uppercase tracking-[0.2em]">Gathering all titles...</div>;
  }
  if (error && !offline) {
    return (
      <div className="py-32 text-center space-y-4">
        <p className="text-crimson-400 text-sm font-bold">{error.message || 'Could not load your titles.'}</p>
        <Link to="/music" className="text-crimson-500 text-[11px] font-black uppercase tracking-widest">Back to your music</Link>
      </div>
    );
  }

  const isPlayable = (t) => t.status === 'ready' && (!offline || downloads.stored.has(t.id));
  const ready = tracks.filter(isPlayable);
  const isThisSource = player.source?.path === SOURCE.path;
  const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);

  const retry = async (trackId) => {
    setNotice(null);
    try {
      await musicApi.retry(trackId);
      await reload();
    } catch (err) {
      setNotice(err.message);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10">
      <Link to="/music" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300">
        <ArrowLeft className="w-4 h-4" /> Your music
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 sm:items-end">
        <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-3xl shadow-2xl flex-shrink-0 border border-crimson-700/50 bg-gradient-to-br from-crimson-900/80 via-crimson-950 to-crimson-950 flex items-center justify-center">
          <span className="w-20 h-20 rounded-3xl bg-crimson-600/20 border border-crimson-500/40 text-crimson-300 flex items-center justify-center">
            <Music className="w-10 h-10" />
          </span>
        </div>
        <div className="min-w-0 space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-crimson-500">Library</p>
          <h1 className="text-3xl sm:text-5xl font-black text-crimson-50 tracking-tighter leading-none break-words">All titles</h1>
          <p className="text-xs font-bold text-crimson-400">
            {offline && <span className="inline-flex items-center gap-1 text-amber-300 mr-2"><WifiOff className="w-3.5 h-3.5" /> Offline, from this device ·</span>}
            {ready.length} of {tracks.length} on the share · {formatTime(totalMs / 1000)}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              disabled={!ready.length}
              onClick={() => (isThisSource ? toggle() : playTracks(ready, 0, SOURCE, { shuffle: false }))}
              className="flex items-center gap-2 px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              {isThisSource && player.playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
              {isThisSource && player.playing ? 'Pause' : 'Play'}
            </button>
            <button
              disabled={!ready.length}
              onClick={() => playTracks(ready, Math.floor(Math.random() * ready.length), SOURCE, { shuffle: true })}
              className="flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
          </div>
          {notice && <p className="text-xs font-bold text-crimson-300">{notice}</p>}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="py-16 text-center space-y-4 border-t border-crimson-900/30">
          <p className="text-crimson-400 text-sm">No titles yet. Import or create a playlist to build your library.</p>
          <Link
            to="/music"
            className="inline-flex items-center gap-2 px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest"
          >
            Back to your music
          </Link>
        </div>
      ) : (
        <ol className="divide-y divide-crimson-900/30 border-t border-crimson-900/30">
          {tracks.map((track, index) => {
            const isCurrent = playing?.id === track.id;
            const playable = isPlayable(track);
            const { visible, overflowCount, overflowTitle } = splitPlaylistBadges(track.playlists);
            return (
              <li
                key={track.id}
                className={`flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 py-2.5 px-2 rounded-xl ${isCurrent ? 'bg-crimson-600/10' : ''}`}
              >
                <button
                  disabled={!playable}
                  onClick={() => (isCurrent ? toggle() : playTracks(ready, ready.indexOf(track), SOURCE))}
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
                    </span>
                  </span>
                  {downloads.stored.has(track.id) && (
                    <span title="On this device" className="text-emerald-400/70 flex-shrink-0"><ArrowDownToLine className="w-3.5 h-3.5" /></span>
                  )}
                </button>
                {visible.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-9 sm:pl-0 flex-shrink-0 max-w-full">
                    {visible.map((pl) => (
                      <Link
                        key={pl.id}
                        to={`/music/playlist/${pl.id}`}
                        className="px-2 py-0.5 rounded-full bg-crimson-900/40 border border-crimson-800/60 text-[10px] font-bold text-crimson-300 hover:text-white hover:border-crimson-500/70 transition-colors truncate max-w-[8.5rem]"
                        title={pl.name}
                      >
                        {pl.name}
                      </Link>
                    ))}
                    {overflowCount > 0 && (
                      <span
                        title={overflowTitle}
                        className="px-2 py-0.5 rounded-full bg-crimson-950/80 border border-crimson-900/60 text-[10px] font-bold text-crimson-400 tabular-nums"
                      >
                        +{overflowCount}
                      </span>
                    )}
                  </div>
                )}
                <StatusCell
                  track={track}
                  onReview={() => setReviewing(track)}
                  onRetry={() => retry(track.id)}
                />
                <span className="hidden sm:block w-12 text-right text-[11px] text-crimson-400 tabular-nums flex-shrink-0">
                  {formatTime(track.duration_ms / 1000)}
                </span>
              </li>
            );
          })}
        </ol>
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
