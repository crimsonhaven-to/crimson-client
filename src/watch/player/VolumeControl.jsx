import { Volume2, VolumeX } from 'lucide-react';

// The invisible native range on top keeps drag and keyboard behaviour.
export default function VolumeControl({ muted, volume, onToggleMute, onChangeVolume }) {
  return (
    <div className="flex items-center group/vol ml-0.5">
      <button onClick={onToggleMute} className="p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90" aria-label="Mute">
        {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
      <div className="overflow-hidden w-0 group-hover/vol:w-20 sm:group-hover/vol:w-24 transition-all duration-300 ease-out flex items-center">
        <div className="relative h-1.5 w-full mx-2 rounded-full bg-white/10 border border-white/5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-crimson-600 to-crimson-400 shadow-[0_0_10px_rgba(255,0,60,0.7)]"
            style={{ width: `${(muted ? 0 : volume) * 100}%` }}
          />
          <div
            className="absolute top-1/2 w-3 h-3 rounded-full bg-white border-2 border-crimson-500 shadow-[0_0_8px_rgba(255,0,60,0.9)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${(muted ? 0 : volume) * 100}%` }}
          />
          <input
            type="range" min="0" max="1" step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
