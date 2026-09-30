import { Download, Loader2 } from 'lucide-react';

export default function DownloadButton({ downloading, progress, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90 ${downloading ? 'text-crimson-400' : ''}`}
      aria-label={downloading ? 'Cancel download' : 'Download video'}
      title={downloading ? 'Click to cancel download' : 'Download this source'}
    >
      {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
      {downloading && (
        <span className="text-[10px] font-black tabular-nums tracking-tighter">
          {progress == null ? '…' : `${Math.round(progress * 100)}%`}
        </span>
      )}
    </button>
  );
}
