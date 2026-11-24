import { CircleAlert, Clock, Loader2, RotateCw, Search } from 'lucide-react';

export function StatusCell({ track, onReview, onRetry }) {
  switch (track.status) {
    case 'ready':
      return null;
    case 'pending':
      return <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-crimson-400"><Clock className="w-3 h-3" /> Queued</span>;
    case 'working':
      return <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-crimson-400"><Loader2 className="w-3 h-3 animate-spin" /> Fetching</span>;
    case 'review':
      return (
        <button onClick={onReview} className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-[11px] font-black uppercase tracking-widest hover:bg-amber-500/20">
          Pick recording
        </button>
      );
    default:
      return (
        <span className="flex items-center gap-1.5">
          <span title={track.error || ''} className="text-crimson-500"><CircleAlert className="w-4 h-4" /></span>
          <button onClick={onReview} aria-label="Find it by hand" title="Find it by hand" className="p-1.5 rounded-lg text-crimson-400 hover:text-white hover:bg-crimson-900/40"><Search className="w-4 h-4" /></button>
          <button onClick={onRetry} aria-label="Try again" title="Try again" className="p-1.5 rounded-lg text-crimson-400 hover:text-white hover:bg-crimson-900/40"><RotateCw className="w-4 h-4" /></button>
        </span>
      );
  }
}
