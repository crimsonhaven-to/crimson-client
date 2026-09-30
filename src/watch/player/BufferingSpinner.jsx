import { Sparkles } from 'lucide-react';

export default function BufferingSpinner() {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none z-20">
      <div className="relative grid place-items-center">
        <div className="absolute w-28 h-28 rounded-full bg-crimson-500/10 blur-2xl cp-breathe" />
        <div className="w-20 h-20 rounded-full border-[3px] border-crimson-500/10 border-t-crimson-500 animate-spin shadow-[0_0_50px_rgba(255,0,60,0.3)]" />
        <div className="absolute w-12 h-12 rounded-full border-2 border-crimson-500/10 border-b-crimson-400 cp-ring-rev" />
        <Sparkles className="absolute w-6 h-6 text-crimson-400 animate-pulse" />
      </div>
    </div>
  );
}
