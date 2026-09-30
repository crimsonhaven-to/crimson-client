import { useMemo } from 'react';
import { ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { groupStreams, streamVariantLabel } from './streamUtils';

const StreamTile = ({ stream, label, active, nested = false, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
      nested ? 'p-3' : 'p-4'
    } ${
      active
        ? 'bg-crimson-600 text-white font-black border-crimson-400 shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
        : 'bg-crimson-950/60 text-crimson-300 border-crimson-900/60 hover:bg-crimson-900/20 hover:border-crimson-600'
    }`}
  >
    <div className="flex flex-col min-w-0 pr-4">
      <div className="flex items-center gap-2 mb-1.5 leading-none">
        <span className={`text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md border ${
          active ? 'bg-white/20 border-white/20 text-crimson-50' : 'bg-crimson-500/10 border-crimson-500/20 text-crimson-500'
        }`}>
          {stream.type}
        </span>
        {stream.language && (
          <span className={`text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md ${
            active ? 'bg-crimson-950/40 text-crimson-50' : 'bg-crimson-900 text-crimson-400'
          }`}>
            {stream.language}
          </span>
        )}
      </div>
      <span className={`font-black tracking-wide text-crimson-50 truncate ${nested ? 'text-[11px]' : 'text-xs'}`}>
        {label}
      </span>
    </div>
    <ChevronRight className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${active ? 'text-crimson-50' : 'text-crimson-800'}`} />
  </button>
);

const SourceGroup = ({ group, activeStreamIdx, onSelectStream, open, onToggle }) => {
  const containsActive = group.items.some((it) => it.idx === activeStreamIdx);
  const count = group.items.length;
  return (
    <div className={`relative ${!open ? 'mb-2' : ''}`}>
      {!open && (
        <>
          <div className="absolute -bottom-1.5 inset-x-3 h-full rounded-2xl bg-crimson-950/40 border border-crimson-900/40" />
          <div className="absolute -bottom-3 inset-x-6 h-full rounded-2xl bg-crimson-950/25 border border-crimson-900/30" />
        </>
      )}
      <button
        onClick={onToggle}
        className={`relative w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
          containsActive
            ? 'bg-crimson-600/90 text-crimson-50 border-crimson-400 shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
            : 'bg-crimson-950/70 text-crimson-300 border-crimson-900/60 hover:bg-crimson-900/20 hover:border-crimson-600'
        }`}
      >
        <div className="flex flex-col min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1.5 leading-none">
            <span className={`flex items-center gap-1 text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md border ${
              containsActive ? 'bg-white/20 border-white/20 text-crimson-50' : 'bg-crimson-500/10 border-crimson-500/20 text-crimson-500'
            }`}>
              <Layers className="w-2.5 h-2.5" /> {count} sources
            </span>
          </div>
          <span className="text-xs font-black tracking-wide text-crimson-50 truncate">{group.label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''} ${containsActive ? 'text-crimson-50' : 'text-crimson-700'}`} />
      </button>
      {open && (
        <div className="mt-2 pl-3 ml-1.5 border-l border-crimson-900/50 space-y-2 animate-in slide-in-from-top-1 fade-in duration-300">
          {group.items.map(({ stream, idx }) => (
            <StreamTile
              key={idx}
              stream={stream}
              label={streamVariantLabel(stream)}
              active={activeStreamIdx === idx}
              nested
              onClick={() => onSelectStream(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// openGroups holds only explicit expand/collapse choices; an unset group is open iff it
// holds the active source.
const SourcePicker = ({ streams, activeStreamIdx, onSelectStream, openGroups, onOpenGroupsChange }) => {
  const sourceGroups = useMemo(() => groupStreams(streams), [streams]);
  return (
    <>
      {sourceGroups.map((group) => {
        if (!group.stacked) {
          const { stream, idx } = group.items[0];
          return (
            <StreamTile
              key={group.key}
              stream={stream}
              label={stream.source}
              active={activeStreamIdx === idx}
              onClick={() => onSelectStream(idx)}
            />
          );
        }
        const containsActive = group.items.some((it) => it.idx === activeStreamIdx);
        const open = group.key in openGroups ? openGroups[group.key] : containsActive;
        return (
          <SourceGroup
            key={group.key}
            group={group}
            activeStreamIdx={activeStreamIdx}
            onSelectStream={onSelectStream}
            open={open}
            onToggle={() => onOpenGroupsChange((m) => ({ ...m, [group.key]: !open }))}
          />
        );
      })}
    </>
  );
};

export default SourcePicker;
