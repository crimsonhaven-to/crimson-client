// Where a shared song link lands. Any signed-in member may open it, with or
// without music of their own, so nothing here assumes a library.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Music, Pause, Play } from 'lucide-react';

import { useTitle } from '../useTitle';
import { Cover } from './Cover';
import { musicApi } from './hooks';
import { currentTrack, playTracks, toggle, useMusicPlayer } from './player';
import { formatTime } from './queue';
import ShareButton from './ShareButton';
import { SendSongButton } from '../messages/SendButtons';

export default function MusicSharedSong() {
  const { token } = useParams();
  const navigate = useNavigate();
  const player = useMusicPlayer();
  const [track, setTrack] = useState(null);
  const [error, setError] = useState(null);
  useTitle(track ? `${track.title} · ${track.artists.join(', ')}` : 'Shared song');

  useEffect(() => {
    let live = true;
    musicApi.shared(token).then(
      ({ track: shared, url }) => { if (live) setTrack({ ...shared, share_url: url, share_token: token }); },
      (err) => { if (live) setError(err.message); },
    );
    return () => { live = false; };
  }, [token]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-32 px-6 text-center space-y-4">
        <Music className="w-10 h-10 text-crimson-400 mx-auto" />
        <p className="text-crimson-300 font-bold">{error}</p>
        <Link to="/" className="inline-block text-[11px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300">
          Back to the Archives
        </Link>
      </div>
    );
  }
  if (!track) {
    return <div className="py-32 flex justify-center"><Loader2 className="w-8 h-8 text-crimson-500 animate-spin" /></div>;
  }

  const isPlaying = currentTrack(player)?.id === track.id;
  const press = () => {
    if (isPlaying) {
      toggle();
      return;
    }
    playTracks([track], 0, { name: 'Shared with you', path: `/music/song/${token}` }, { shuffle: false });
    navigate('/music/now');
  };

  return (
    <div className="max-w-sm w-full mx-auto px-4 py-12 sm:py-20 space-y-6 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-crimson-500">A song was shared with you</p>
      <Cover src={track.cover_url} className="w-full aspect-square rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)]" />
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-crimson-50 leading-tight">{track.title}</h1>
        <p className="text-crimson-400 font-bold mt-1">{track.artists.join(', ')}</p>
        <p className="text-crimson-400 text-sm mt-0.5">
          {track.album && <>{track.album} · </>}{formatTime(track.duration_ms / 1000)}
        </p>
      </div>
      <div className="flex items-center justify-center gap-4">
        <button onClick={press} aria-label={isPlaying && player.playing ? 'Pause' : 'Play'}
          className="w-16 h-16 rounded-full bg-crimson-600 hover:bg-crimson-500 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(255,0,60,0.35)] transition-all">
          {isPlaying && player.playing ? <Pause className="w-7 h-7" fill="currentColor" />
            : <Play className="w-7 h-7 translate-x-0.5" fill="currentColor" />}
        </button>
        <SendSongButton track={track} />
        <ShareButton track={track} />
      </div>
    </div>
  );
}
