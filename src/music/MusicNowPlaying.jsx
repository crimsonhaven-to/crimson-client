// A route of its own so Android's back gesture closes it like any other page.
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Loader2, Pause, Play, Radio, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';

import { Cover } from './Cover';
import { currentSet, useDj } from './dj';
import { formatTime, REPEAT_OFF, REPEAT_ONE } from './queue';
import {
  currentTrack, next, previous, seek, toggle, toggleRepeat, toggleShuffle, useMusicPlayer,
} from './player';
import ShareButton from './ShareButton';
import UpNext from './UpNext';

function DjSet({ set, loading }) {
  return (
    <div className="rounded-2xl border border-crimson-700/40 bg-crimson-950/50 p-4 space-y-1.5">
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-crimson-500">
        <Radio className="w-4 h-4" /> Lumi DJ · <span className="text-crimson-300 normal-case tracking-normal">{set.theme}</span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" aria-label="Lumi is picking the next set" />}
      </p>
      {set.intro && <p className="text-sm text-crimson-100 italic leading-relaxed">{set.intro}</p>}
    </div>
  );
}

export default function MusicNowPlaying() {
  const state = useMusicPlayer();
  const track = currentTrack(state);
  const dj = useDj();
  const navigate = useNavigate();

  if (!track) {
    return (
      <div className="max-w-xl mx-auto py-32 text-center space-y-6">
        <p className="text-crimson-400 font-black uppercase tracking-[0.3em] text-xs">Nothing is playing</p>
        <Link to="/music" className="inline-block px-6 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest">
          Open your music
        </Link>
      </div>
    );
  }

  const set = currentSet(dj, state);
  const RepeatIcon = state.repeat === REPEAT_ONE ? Repeat1 : Repeat;

  return (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-14 grid lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start gap-10 lg:gap-14">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} aria-label="Close" className="p-2 -ml-2 text-crimson-400 hover:text-white">
            <ChevronDown className="w-6 h-6" />
          </button>
          {state.source?.path ? (
            <Link to={state.source.path} className="text-[11px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300 truncate max-w-[70%]">
              {state.source.name}
            </Link>
          ) : <span />}
        </div>

        <Cover src={track.cover_url} className="w-full aspect-square rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)]" />

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-grow">
            <h1 className="text-2xl sm:text-3xl font-black text-crimson-50 leading-tight">{track.title}</h1>
            <p className="text-crimson-400 font-bold mt-1">{track.artists.join(', ')}</p>
            {track.album && <p className="text-crimson-400 text-sm mt-0.5">{track.album}</p>}
            {state.error && <p className="text-amber-400 text-xs font-bold mt-2">{state.error}</p>}
          </div>
          <ShareButton track={track} className="-mr-2 flex-shrink-0" />
        </div>

        {set && <DjSet set={set} loading={dj.loading} />}

        <div>
          <input
            type="range"
            min={0}
            max={state.duration || 0}
            step={0.5}
            value={Math.min(state.currentTime, state.duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            className="w-full accent-crimson-500"
          />
          <div className="flex justify-between text-[11px] font-bold text-crimson-400 tabular-nums">
            <span>{formatTime(state.currentTime)}</span>
            <span>{formatTime(state.duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-2">
          <button onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={state.shuffle}
            className={`p-2 transition-colors ${state.shuffle ? 'text-crimson-500' : 'text-crimson-100/50 hover:text-crimson-200'}`}>
            <Shuffle className="w-5 h-5" />
          </button>
          <button onClick={previous} aria-label="Previous" className="p-2 text-crimson-200 hover:text-white">
            <SkipBack className="w-7 h-7" fill="currentColor" />
          </button>
          <button onClick={toggle} aria-label={state.playing ? 'Pause' : 'Play'}
            className="w-16 h-16 rounded-full bg-crimson-600 hover:bg-crimson-500 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(255,0,60,0.35)] transition-all">
            {state.loading ? <Loader2 className="w-7 h-7 animate-spin" />
              : state.playing ? <Pause className="w-7 h-7" fill="currentColor" />
                : <Play className="w-7 h-7 translate-x-0.5" fill="currentColor" />}
          </button>
          <button onClick={next} aria-label="Next" className="p-2 text-crimson-200 hover:text-white">
            <SkipForward className="w-7 h-7" fill="currentColor" />
          </button>
          <button onClick={toggleRepeat} aria-label={`Repeat: ${state.repeat}`}
            className={`p-2 transition-colors ${state.repeat !== REPEAT_OFF ? 'text-crimson-500' : 'text-crimson-100/50 hover:text-crimson-200'}`}>
            <RepeatIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <UpNext state={state} />
    </div>
  );
}
