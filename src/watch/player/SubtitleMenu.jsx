import { Captions, Check } from 'lucide-react';

export default function SubtitleMenu({ tracks, selectedIdx, onSelect }) {
  return (
    <div className="p-2">
      <p className="flex items-center gap-2 px-2 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">
        <Captions className="w-3.5 h-3.5" /> Subtitles
      </p>
      <div className="space-y-1">
        <button
          onClick={() => onSelect(-1)}
          className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedIdx === -1 ? 'bg-crimson-600 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
        >
          <span>Off</span>
          {selectedIdx === -1 && <Check className="w-3.5 h-3.5 shrink-0" />}
        </button>
        {tracks.map((s, i) => (
          <button
            key={`${s.url}-${i}`}
            onClick={() => onSelect(i)}
            className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedIdx === i ? 'bg-crimson-600 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
          >
            <span className="truncate">{s.label || s.lang || `Track ${i + 1}`}</span>
            {selectedIdx === i && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}
