import { SkipForward } from 'lucide-react';
import { AUTO_NEXT_SECONDS } from './useAutoNext';

export default function AutoNextCard({ countdown, nextLabel, onPlayNow, onCancel }) {
  return (
    <div className="cp-rise absolute z-40 bottom-28 right-4 sm:right-6 w-72 max-w-[calc(100%-2rem)] rounded-3xl bg-crimson-950/95 border border-crimson-500/30 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-5">
      <div className="absolute top-0 inset-x-5 h-0.5 rounded-full bg-crimson-500/15 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-crimson-600 to-crimson-400 shadow-[0_0_8px_rgba(255,0,60,0.7)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${(countdown / AUTO_NEXT_SECONDS) * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c] animate-pulse" />
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">Up Next</p>
      </div>
      <p className="text-sm font-black text-crimson-50 truncate mb-1.5">{nextLabel || 'Next Episode'}</p>
      <p className="text-[11px] font-bold text-crimson-300/70 mb-4">
        Manifesting in <span className="text-crimson-400 tabular-nums font-black">{countdown}</span>s
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onPlayNow}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_8px_20px_rgba(255,0,60,0.3)]"
        >
          <SkipForward className="w-3.5 h-3.5 fill-current" /> Play Now
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-crimson-950/60 border border-white/5 text-crimson-300 hover:text-white hover:border-crimson-500/50 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
