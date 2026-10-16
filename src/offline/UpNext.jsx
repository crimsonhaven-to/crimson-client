import { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Loader2, Pause, Play } from 'lucide-react';

import { itemLabel } from './items';
import { setPaused } from './queue';
import { moveQueued, queuedOf } from './store';

const nameOf = (entry) => (entry.kind === 'movie' ? entry.titleName : `${entry.titleName} · ${itemLabel(entry)}`);

const arrow = 'p-1.5 rounded-lg text-crimson-400 hover:text-crimson-100 hover:bg-crimson-900/40 disabled:opacity-30 disabled:hover:bg-transparent';

// The downloads still to run, in the order they will. Drag and drop does not
// fire on touch screens, so the arrows reorder there.
export default function UpNext({ entries, progress, paused, hidden }) {
  const [dragged, setDragged] = useState(null);
  const running = Object.values(entries).find((e) => e.status === 'downloading' && !hidden.has(e.id));
  const all = queuedOf(entries);
  const queued = all.filter((e) => !hidden.has(e.id));
  if (!running && !queued.length) return null;

  // Hidden entries still hold their place in the queue, so moves aim at the
  // visible neighbour's place in the whole queue.
  const placeOf = (id) => all.findIndex((e) => e.id === id);
  const share = running && progress[running.id]?.total
    ? Math.floor((progress[running.id].done / progress[running.id].total) * 100)
    : null;

  return (
    <section className="space-y-3 p-5 rounded-3xl bg-crimson-950/40 border border-crimson-900/40">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-crimson-50">
          Up next <span className="text-crimson-400 tabular-nums">{queued.length + (running ? 1 : 0)}</span>
        </h2>
        <button onClick={() => setPaused(!paused)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-crimson-900/40 hover:bg-crimson-900/70 text-xs font-black uppercase tracking-widest text-crimson-100">
          {paused ? <Play className="w-3.5 h-3.5" fill="currentColor" /> : <Pause className="w-3.5 h-3.5" fill="currentColor" />}
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {paused && <p className="text-xs font-bold text-amber-300">Paused. Nothing downloads until you resume.</p>}

      <ol className="space-y-1.5">
        {running && (
          <li className="flex items-center gap-3 px-3 py-2 rounded-xl bg-crimson-900/30 border border-crimson-500/30">
            <Loader2 className="w-4 h-4 text-crimson-300 animate-spin shrink-0" />
            <span className="min-w-0 flex-grow text-sm font-bold text-crimson-50 truncate">{nameOf(running)}</span>
            {share != null && <span className="text-xs font-black text-crimson-300 tabular-nums">{share}%</span>}
          </li>
        )}
        {queued.map((entry, i) => (
          <li key={entry.id} draggable
            onDragStart={() => setDragged(entry.id)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={() => dragged && dragged !== entry.id && moveQueued(dragged, placeOf(entry.id))}
            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl bg-crimson-950/50 border cursor-grab active:cursor-grabbing ${
              dragged === entry.id ? 'border-crimson-500/60 opacity-60' : 'border-crimson-900/40'
            }`}>
            <GripVertical className="w-4 h-4 text-crimson-400 shrink-0" aria-hidden="true" />
            <span className="w-5 text-xs font-black text-crimson-400 tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-grow text-sm font-bold text-crimson-100 truncate">{nameOf(entry)}</span>
            <button className={arrow} disabled={i === 0} aria-label={`Move ${nameOf(entry)} up`}
              onClick={() => moveQueued(entry.id, placeOf(queued[i - 1].id))}>
              <ChevronUp className="w-4 h-4" />
            </button>
            <button className={arrow} disabled={i === queued.length - 1} aria-label={`Move ${nameOf(entry)} down`}
              onClick={() => moveQueued(entry.id, placeOf(queued[i + 1].id))}>
              <ChevronDown className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
