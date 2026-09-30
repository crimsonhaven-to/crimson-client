import { useState, useCallback } from 'react';
import { formatPlaybackTime } from './playbackTime';

export default function SeekBar({ current, duration, buffered, seekTo }) {
  const [seekHover, setSeekHover] = useState(null);

  const onScrubStart = useCallback((e) => {
    const bar = e.currentTarget;
    seekTo(e.clientX, bar);
    const move = (ev) => seekTo(ev.clientX, bar);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [seekTo]);

  const onSeekHover = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSeekHover(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  }, []);

  const pct = duration ? (current / duration) * 100 : 0;
  const bufPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;

  return (
    <div
      onPointerDown={onScrubStart}
      onPointerMove={onSeekHover}
      onPointerLeave={() => setSeekHover(null)}
      className="group/seek relative h-6 flex items-center cursor-pointer mb-1"
    >
      {seekHover !== null && duration > 0 && (
        <div
          className="cp-pop absolute -top-9 z-20 px-2.5 py-1 rounded-lg bg-crimson-950/95 border border-crimson-500/40 backdrop-blur-md text-[10px] font-black tabular-nums text-crimson-50 shadow-[0_10px_25px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{ left: `${seekHover * 100}%`, transform: 'translateX(-50%)' }}
        >
          {formatPlaybackTime(seekHover * duration)}
        </div>
      )}
      <div className="absolute inset-x-0 h-1.5 group-hover/seek:h-2.5 rounded-full bg-white/5 overflow-hidden backdrop-blur-sm border border-white/5 shadow-inner transition-all duration-200">
        <div className="absolute inset-y-0 left-0 bg-crimson-500/20 transition-[width] duration-300" style={{ width: `${bufPct}%` }} />
        {seekHover !== null && (
          <div className="absolute inset-y-0 left-0 bg-crimson-400/20" style={{ width: `${seekHover * 100}%` }} />
        )}
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-crimson-800 via-crimson-600 to-crimson-400 shadow-[0_0_20px_rgba(255,0,60,0.8)]" style={{ width: `${pct}%` }} />
      </div>
      {seekHover !== null && (
        <div
          className="absolute w-0.5 h-4 rounded-full bg-crimson-100/70 -translate-x-1/2 pointer-events-none z-[5]"
          style={{ left: `${seekHover * 100}%` }}
        />
      )}
      <div
        className="absolute w-4 h-4 rounded-full bg-white border-[3px] border-crimson-500 shadow-[0_0_15px_rgba(255,0,60,1)] -translate-x-1/2 scale-0 group-hover/seek:scale-100 transition-transform duration-200 z-10"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
