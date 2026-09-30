import { Play } from 'lucide-react';

export default function BigPlayButton({ onPlay }) {
  return (
    <div className="absolute inset-0 grid place-items-center z-10 pointer-events-none">
      <div className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-crimson-500/10 blur-2xl cp-breathe" />
      <div className="absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-dashed border-crimson-500/30 cp-ring" />
      <div className="absolute w-[10.5rem] h-[10.5rem] sm:w-44 sm:h-44 rounded-full border border-crimson-500/10 cp-ring-rev" />
      <button
        onClick={onPlay}
        className="pointer-events-auto relative grid place-items-center w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-crimson-950/50 border border-crimson-500/30 backdrop-blur-md text-crimson-50 shadow-[0_0_60px_rgba(255,0,60,0.4)] hover:bg-crimson-500/20 hover:border-crimson-400 hover:scale-110 transition-all duration-300 active:scale-95 group"
        aria-label="Play"
      >
        <Play className="w-10 h-10 sm:w-12 sm:h-12 translate-x-0.5 fill-current drop-shadow-[0_0_15px_rgba(255,0,60,0.8)]" />
      </button>
    </div>
  );
}
