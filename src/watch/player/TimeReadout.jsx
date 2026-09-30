import { formatPlaybackTime } from './playbackTime';

export default function TimeReadout({ live, current, duration }) {
  if (live) {
    return (
      <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] bg-crimson-950/60 px-3 py-1.5 rounded-lg border border-crimson-500/30 ml-1 text-crimson-50">
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex w-full h-full rounded-full bg-crimson-500 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c]" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span className="text-[11px] font-mono font-black tracking-tighter tabular-nums bg-crimson-950/60 px-3 py-1.5 rounded-lg border border-white/5 ml-1">
      <span className="text-crimson-50">{formatPlaybackTime(current)}</span> <span className="text-crimson-500 mx-0.5">/</span> <span className="text-crimson-300/80">{formatPlaybackTime(duration)}</span>
    </span>
  );
}
