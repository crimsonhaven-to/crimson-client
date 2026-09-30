import { SkipForward } from 'lucide-react';

export default function SkipSegmentButton({ label, onSkip }) {
  return (
    <button
      onClick={onSkip}
      className="cp-rise absolute z-40 bottom-28 right-4 sm:right-6 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-crimson-950/90 border border-crimson-500/40 backdrop-blur-2xl text-crimson-50 shadow-[0_15px_50px_rgba(0,0,0,0.7)] hover:bg-crimson-600 hover:border-crimson-400 hover:scale-[1.03] transition-all active:scale-95"
    >
      <SkipForward className="w-4 h-4 fill-current text-crimson-400" />
      <span className="text-[11px] font-black uppercase tracking-[0.2em]">
        {label}
      </span>
    </button>
  );
}
