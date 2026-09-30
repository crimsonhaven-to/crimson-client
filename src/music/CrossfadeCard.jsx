import { useState } from 'react';
import { Blend, Check, Info } from 'lucide-react';

import PrefToggle from '../PrefToggle';
import { MAX_SECONDS, MIN_SECONDS, canCrossfade, crossfadeSetting, setCrossfadeSetting } from './crossfade';

export default function CrossfadeCard() {
  const [setting, setSetting] = useState(crossfadeSetting);
  const works = canCrossfade();

  const change = (patch) => {
    const next = { ...setting, ...patch };
    setCrossfadeSetting(next);
    setSetting(next);
  };

  return (
    <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

      <div className="flex items-start justify-between gap-6 relative z-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-crimson-500">
            <Blend className="w-6 h-6" />
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Crossfade</h3>
          </div>
          <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
            Let the last seconds of a song melt into the first of the next, so the music
            never stops between them. The end of a queue, and a song on repeat, still end
            as they always did.
          </p>
        </div>
        <PrefToggle active={setting.on} onClick={() => change({ on: !setting.on })} label="Toggle crossfade" />
      </div>

      <div className={`relative z-10 space-y-3 transition-opacity ${setting.on ? '' : 'opacity-40'}`}>
        <div className="flex items-baseline justify-between">
          <label htmlFor="crossfade-seconds" className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em]">
            Blend length
          </label>
          <span className="text-sm font-black text-crimson-50 tabular-nums">{setting.seconds}s</span>
        </div>
        <input
          id="crossfade-seconds"
          type="range"
          min={MIN_SECONDS}
          max={MAX_SECONDS}
          step={1}
          value={setting.seconds}
          disabled={!setting.on}
          onChange={(e) => change({ seconds: Number(e.target.value) })}
          className="w-full accent-crimson-500"
        />
        <div className="flex justify-between text-[10px] font-black text-crimson-700 uppercase tracking-widest tabular-nums">
          <span>{MIN_SECONDS}s</span>
          <span>{MAX_SECONDS}s</span>
        </div>
      </div>

      <div className="relative z-10 flex items-start gap-4 p-6 bg-crimson-500/5 border border-crimson-500/20 rounded-3xl">
        <div className="p-2.5 rounded-2xl bg-crimson-900/20 shrink-0">
          {works ? <Blend className="w-5 h-5 text-crimson-500" /> : <Info className="w-5 h-5 text-amber-500" />}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-green-500" /> Saved on this device
          </p>
          <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">
            {!works
              ? 'This browser does not let a page fade audio (iPhone and iPad), so songs here switch without a blend.'
              : setting.on
                ? `Each song hands over to the next across ${setting.seconds} seconds.`
                : 'Songs play back to back, each one ending before the next begins.'}
          </p>
        </div>
      </div>
    </div>
  );
}
