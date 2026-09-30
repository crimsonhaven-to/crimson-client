import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Layers, MonitorPlay } from 'lucide-react';
import { groupStreams, streamVariantLabel } from '../streamUtils';

// Mounted only while the settings panel is open, so each opening starts with the
// active source's group expanded.
export default function SourceMenu({ sources, activeSourceIdx, onPick, onReportBroken, onClose }) {
  const sourceGroups = useMemo(() => groupStreams(sources), [sources]);
  const [openGroup, setOpenGroup] = useState(
    () => sourceGroups.find((g) => g.items.some((it) => it.idx === activeSourceIdx))?.key ?? null
  );

  return (
    <div className="p-2">
      <p className="flex items-center gap-2 px-2 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">
        <MonitorPlay className="w-3.5 h-3.5" /> Sources
      </p>
      <div className="space-y-1">
        {sourceGroups.map((group) => {
          if (!group.stacked) {
            const { stream, idx } = group.items[0];
            return (
              <button
                key={group.key}
                onClick={() => onPick(idx)}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSourceIdx === idx ? 'bg-crimson-600 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
              >
                <span className="truncate">{stream.source}</span>
                {activeSourceIdx === idx && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          }
          const containsActive = group.items.some((it) => it.idx === activeSourceIdx);
          const open = openGroup === group.key;
          return (
            <div key={group.key}>
              <button
                onClick={() => setOpenGroup(open ? null : group.key)}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${containsActive && !open ? 'bg-crimson-600/80 text-crimson-50' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Layers className="w-3 h-3 shrink-0 text-crimson-500" />
                  <span className="truncate">{group.label}</span>
                  <span className="text-crimson-500/80">· {group.items.length}</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="cp-rise mt-1 ml-3 pl-2 border-l border-crimson-900/60 space-y-1">
                  {group.items.map(({ stream, idx }) => (
                    <button
                      key={idx}
                      onClick={() => onPick(idx)}
                      className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg text-[10px] font-bold tracking-wide transition-all ${activeSourceIdx === idx ? 'bg-crimson-600 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="text-[8px] uppercase font-black px-1.5 py-0.5 rounded bg-crimson-500/10 border border-crimson-500/20 text-crimson-500">{stream.type}</span>
                        {stream.language && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 rounded bg-crimson-900 text-crimson-400">{stream.language}</span>}
                        <span className="truncate">{streamVariantLabel(stream)}</span>
                      </span>
                      {activeSourceIdx === idx && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {onReportBroken && activeSourceIdx >= 0 && (
        <button
          onClick={() => { onReportBroken(activeSourceIdx); onClose(); }}
          title="This source won't play: report it and switch to the next"
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-crimson-400 hover:text-white hover:bg-crimson-500/20 transition-all"
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Report broken · try next
        </button>
      )}
    </div>
  );
}
