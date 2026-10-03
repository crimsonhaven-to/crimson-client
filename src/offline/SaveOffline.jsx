import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, Check, Loader2 } from 'lucide-react';

import Dialog from '../library/Dialog';
import { isDownloadable } from '../watch/streamDownload';
import { groupStreams, streamVariantLabel } from '../watch/streamUtils';
import { itemLabel } from './items';
import { saveOffline } from './queue';
import { useVideoDownloads } from './store';
import { supported } from './videoStore';

const buttonClass = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all';

function SourceOption({ stream, label, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-3 ${
        selected
          ? 'bg-crimson-600 border-crimson-400 text-white'
          : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-300 hover:border-crimson-600'
      }`}
    >
      <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected ? 'border-white bg-white/80' : 'border-crimson-700'}`} />
      <span className="min-w-0 flex-grow">
        <span className="block text-xs font-black text-crimson-50 truncate">{label}</span>
        <span className="block text-[9px] font-black uppercase tracking-widest opacity-70">
          {[stream.type, stream.language].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );
}

function SaveDialog({ streams, activeStreamIdx, items, onClose }) {
  const choices = useMemo(() => groupStreams(streams)
    .map((group) => ({ ...group, items: group.items.filter(({ stream }) => isDownloadable(stream)) }))
    .filter((group) => group.items.length), [streams]);
  const [picked, setPicked] = useState(() =>
    (isDownloadable(streams[activeStreamIdx]) ? activeStreamIdx : choices[0]?.items[0]?.idx ?? null));
  const [wholeSeason, setWholeSeason] = useState(false);
  const [busy, setBusy] = useState(false);

  const stream = picked == null ? null : streams[picked];
  const chosen = wholeSeason ? items : items.slice(0, 1);

  const save = async () => {
    setBusy(true);
    await saveOffline(chosen, { stream, wanted: { source: stream.source, language: stream.language || null } });
    onClose();
  };

  return (
    <Dialog icon={ArrowDownToLine} title="Save offline" subtitle={itemLabel(items[0])} onClose={onClose}>
      {choices.length === 0 ? (
        <p className="text-xs text-crimson-300/70 font-medium">
          None of these sources can be saved. Embedded players never hand over their video; try a rescan or another episode.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-crimson-500">Source</p>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {choices.map((group) => group.items.map(({ stream: s, idx }) => (
                <SourceOption
                  key={idx}
                  stream={s}
                  label={group.stacked ? `${group.label} · ${streamVariantLabel(s)}` : s.source}
                  selected={picked === idx}
                  onSelect={() => setPicked(idx)}
                />
              )))}
            </div>
          </div>

          {items.length > 1 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-crimson-500">What to save</p>
              <div className="flex flex-wrap gap-2">
                {[[false, 'This episode'], [true, `This and the next ${items.length - 1}`]].map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setWholeSeason(value)}
                    aria-pressed={wholeSeason === value}
                    className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
                      wholeSeason === value
                        ? 'bg-crimson-600 border-crimson-400 text-white'
                        : 'border-crimson-900/60 text-crimson-400 hover:border-crimson-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {wholeSeason && (
                <p className="text-[11px] text-crimson-300/60 font-medium">
                  Each later episode is looked up on {stream?.source || 'this source'} when its turn comes.
                  That lookup would interrupt a video you are watching, so it waits until no player is open.
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-crimson-300/60 font-medium">
            Downloads run in this tab while Crimson Haven is open and continue the next time you open it.
          </p>
        </>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-crimson-400 hover:text-white text-[10px] font-black uppercase tracking-widest">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!stream || busy}
          className="px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" />
            : items[0].kind === 'movie' ? 'Save movie'
              : chosen.length > 1 ? `Save ${chosen.length} episodes` : 'Save episode'}
        </button>
      </div>
    </Dialog>
  );
}

// items[0] is the movie or episode on screen; the rest of its season follows.
export default function SaveOffline({ streams, activeStreamIdx, items }) {
  const { entries, progress } = useVideoDownloads();
  const [open, setOpen] = useState(false);
  if (!supported() || !items.length) return null;

  const entry = entries[items[0].id];
  if (entry?.status === 'done') {
    return (
      <Link to={`/downloads/watch/${entry.id}`} className={`${buttonClass} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}>
        <Check className="w-4 h-4" /> Saved
      </Link>
    );
  }
  if (entry?.status === 'queued' || entry?.status === 'downloading') {
    const p = progress[entry.id];
    return (
      <Link to="/downloads" className={`${buttonClass} border-crimson-700 text-crimson-300 hover:border-crimson-500`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        {p?.total ? `Saving ${Math.floor((p.done / p.total) * 100)}%` : entry.status === 'queued' ? 'Queued' : 'Saving'}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!streams.length}
        title="Keep a copy on this device to watch without a connection"
        className={`${buttonClass} border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 disabled:opacity-40`}
      >
        <ArrowDownToLine className="w-4 h-4" /> {entry?.status === 'failed' ? 'Save again' : 'Save offline'}
      </button>
      {/* Portaled: the watch page's info card has a backdrop blur, which makes it
          the containing block of fixed children, so the dialog would sit inside
          the card and be clipped by its overflow. */}
      {open && createPortal(
        <SaveDialog streams={streams} activeStreamIdx={activeStreamIdx} items={items} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}
