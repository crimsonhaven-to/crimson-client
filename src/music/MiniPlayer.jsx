// The persistent bottom bar. Mounted once in the App shell, next to Lumi, so the
// music keeps going and stays reachable on every page. It sets --music-bar on
// the root while visible, which Lumi's summon button reads to sit above it.
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, Pause, Play, SkipForward, X } from 'lucide-react';

import { close, currentTrack, next, restoreQueue, toggle, useMusicPlayer } from './player';
import { Cover } from './Cover';

const BAR_HEIGHT = '4.5rem';

export default function MiniPlayer() {
  const state = useMusicPlayer();
  const track = currentTrack(state);
  const { pathname } = useLocation();
  // The video watch pages own the bottom of the screen for their own controls.
  const hidden = !track || pathname.startsWith('/watch') || pathname === '/music/now';

  useEffect(() => { restoreQueue(); }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--music-bar', hidden ? '0px' : BAR_HEIGHT);
    return () => root.style.setProperty('--music-bar', '0px');
  }, [hidden]);

  if (hidden) return null;
  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <>
      {/* Keeps the footer's last line from ending up under the bar. */}
      <div style={{ height: BAR_HEIGHT }} aria-hidden="true" />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] bg-crimson-950/95 backdrop-blur-xl border-t border-crimson-900/60 shadow-[0_-10px_30px_rgba(0,0,0,0.4)]"
        style={{ height: BAR_HEIGHT, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="absolute top-0 left-0 h-0.5 bg-crimson-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 flex items-center gap-3">
          <Link to="/music/now" className="flex items-center gap-3 min-w-0 flex-grow group" aria-label="Open Now Playing">
            <Cover src={track.cover_url} className="w-12 h-12 rounded-lg flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-crimson-50 truncate group-hover:text-crimson-300 transition-colors">{track.title}</p>
              <p className="text-xs text-crimson-400 truncate">
                {state.error ? <span className="text-amber-400">{state.error}</span> : track.artists.join(', ')}
              </p>
            </div>
          </Link>
          <button
            onClick={toggle}
            aria-label={state.playing ? 'Pause' : 'Play'}
            className="w-11 h-11 rounded-full bg-crimson-600 hover:bg-crimson-500 text-white flex items-center justify-center transition-all flex-shrink-0"
          >
            {state.loading ? <Loader2 className="w-5 h-5 animate-spin" />
              : state.playing ? <Pause className="w-5 h-5" fill="currentColor" />
                : <Play className="w-5 h-5 translate-x-px" fill="currentColor" />}
          </button>
          <button onClick={next} aria-label="Next" className="p-2 text-crimson-300 hover:text-white transition-colors flex-shrink-0">
            <SkipForward className="w-5 h-5" fill="currentColor" />
          </button>
          <button onClick={close} aria-label="Stop and close" className="hidden sm:block p-2 text-crimson-700 hover:text-crimson-300 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
