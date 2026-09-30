import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function PlaybackError({ message, onRetry }) {
  return (
    <div className="cp-rise absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 text-center p-8 backdrop-blur-xl z-30">
      <div className="relative grid place-items-center mb-6">
        <div className="absolute w-28 h-28 rounded-full bg-crimson-500/15 blur-2xl cp-breathe" />
        <div className="relative p-5 rounded-full bg-crimson-500/10 border border-crimson-500/20">
          <AlertTriangle className="w-12 h-12 text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.5)]" />
        </div>
      </div>
      <p className="text-crimson-50 font-black text-lg sm:text-2xl mb-2 uppercase tracking-tighter">Playback Link Severed</p>
      <p className="text-crimson-400/80 text-xs sm:text-sm max-w-sm mb-8 font-medium leading-relaxed">{message}</p>
      <button onClick={onRetry} className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_20px_rgba(255,0,60,0.3)] active:scale-95">
        <RotateCcw className="w-4 h-4" /> Re-Establish Node
      </button>
    </div>
  );
}
