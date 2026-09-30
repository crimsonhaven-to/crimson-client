import { Settings } from 'lucide-react';

export default function QualityMenu({ levels, currentLevel, onPick }) {
  const qLabel = (lvl) => (lvl === -1 ? 'Auto' : (levels[lvl]?.height ? `${levels[lvl].height}p` : `Q${lvl + 1}`));
  return (
    <div className="p-2">
      <p className="flex items-center gap-2 px-2 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">
        <Settings className="w-3.5 h-3.5" /> Quality
      </p>
      <div className="grid grid-cols-3 gap-1">
        {[-1, ...levels.map((_, i) => i)].reverse().map((lvl) => (
          <button
            key={lvl}
            onClick={() => onPick(lvl)}
            className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentLevel === lvl ? 'bg-crimson-600 text-white' : 'bg-crimson-950/60 text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
          >
            {qLabel(lvl)}
          </button>
        ))}
      </div>
    </div>
  );
}
