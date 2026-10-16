import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownToLine, Clock, Loader2, Play, RotateCcw, Trash2, WifiOff,
} from 'lucide-react';

import PrefToggle from '../account/PrefToggle';
import { HubShell } from '../browse/hubKit';
import { estimate as estimateStorage } from '../deviceCache';
import { formatBytes } from '../formatBytes';
import DownloadFolder from '../native/DownloadFolder';
import { useTitle } from '../useTitle';
import { itemLabel, partWatched } from './items';
import OfflinePoster from './OfflinePoster';
import { retryDownload, retryFailed, setAutoDelete } from './queue';
import StorageBar from './StorageBar';
import { titlesOf, useVideoDownloads } from './store';
import UpNext from './UpNext';
import { usePendingRemoval } from './usePendingRemoval';
import { supported } from './videoStore';

function useStorageEstimate(entries, moves) {
  const [estimate, setEstimate] = useState(null);
  useEffect(() => {
    estimateStorage().then(setEstimate).catch(() => {});
  }, [entries, moves]);
  return estimate;
}

function Notice({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs font-bold text-amber-200/90">
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{children}</span>
    </div>
  );
}

function Status({ entry, progress }) {
  if (entry.status === 'done') {
    return <span className="text-[11px] text-crimson-400 font-bold">{[entry.source, formatBytes(entry.bytes)].filter(Boolean).join(' · ')}</span>;
  }
  if (entry.status === 'failed') {
    return <span className="text-[11px] text-amber-400 font-bold">{entry.error || 'Download failed.'}</span>;
  }
  if (entry.status === 'queued') {
    return <span className="text-[11px] text-crimson-400 font-bold">Queued · {entry.wanted.source}</span>;
  }
  const fraction = progress?.total ? progress.done / progress.total : null;
  return (
    <span className="block space-y-1.5">
      <span className="block text-[11px] text-crimson-400 font-bold">
        Saving from {entry.wanted.source}
        {fraction != null && ` · ${Math.floor(fraction * 100)}%`}
        {progress?.bytes ? ` · ${formatBytes(progress.bytes)}` : ''}
      </span>
      <span className="block h-1 rounded-full bg-crimson-900/60 overflow-hidden">
        <span
          className={`block h-full bg-crimson-500 ${fraction == null ? 'w-1/3 animate-pulse' : ''}`}
          style={fraction == null ? undefined : { width: `${Math.max(2, fraction * 100)}%` }}
        />
      </span>
    </span>
  );
}

function EntryRow({ entry, progress, onRemove }) {
  const resumed = entry.status === 'done' && partWatched(entry);
  return (
    <li className="flex items-center gap-3 p-3 rounded-2xl bg-crimson-950/50 border border-crimson-900/40">
      {entry.status === 'done' ? (
        <Link to={`/downloads/watch/${entry.id}`} aria-label={`Play ${itemLabel(entry)}`}
          className="w-10 h-10 rounded-full bg-crimson-600 hover:bg-crimson-500 text-white flex items-center justify-center flex-shrink-0">
          <Play className="w-4 h-4 translate-x-px" fill="currentColor" />
        </Link>
      ) : (
        <span className="w-10 h-10 rounded-full border border-crimson-900/60 text-crimson-400 flex items-center justify-center flex-shrink-0">
          {entry.status === 'failed' ? <AlertTriangle className="w-4 h-4 text-amber-400" />
            : entry.status === 'queued' ? <Clock className="w-4 h-4" />
              : <Loader2 className="w-4 h-4 animate-spin" />}
        </span>
      )}
      <div className="min-w-0 flex-grow">
        <p className="text-sm font-bold text-crimson-50 truncate">
          {entry.kind === 'movie' ? 'Movie' : itemLabel(entry)}
          {resumed && <span className="text-[11px] text-crimson-300 font-black ml-2">resumes at {Math.floor(entry.position / 60)} min</span>}
        </p>
        <Status entry={entry} progress={progress} />
      </div>
      {entry.status === 'failed' && (
        <button onClick={() => retryDownload(entry.id)} aria-label="Try again" title="Try again"
          className="p-2 text-crimson-300 hover:text-white">
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
      <button onClick={onRemove} aria-label="Remove from this device" title="Remove from this device"
        className="p-2 text-crimson-400 hover:text-crimson-200">
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

function TitleCard({ title, progress, onRemove }) {
  return (
    <section className="flex flex-col sm:flex-row gap-5 p-5 rounded-3xl bg-crimson-950/40 border border-crimson-900/40">
      <OfflinePoster titleKey={title.key} fallback={title.poster} className="w-24 sm:w-28 aspect-[2/3] rounded-2xl flex-shrink-0" />
      <div className="min-w-0 flex-grow space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-grow">
            <Link to={title.href} className="text-lg font-black text-crimson-50 hover:text-crimson-300 tracking-tight">{title.name}</Link>
            <p className="text-xs text-crimson-400 font-bold">{formatBytes(title.bytes)} on this device</p>
          </div>
          <button onClick={() => onRemove(title.entries.map((e) => e.id), title.name)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-crimson-400 hover:text-crimson-200 hover:bg-crimson-900/30">
            <Trash2 className="w-3.5 h-3.5" /> Remove all
          </button>
        </div>
        <ul className="space-y-2">
          {title.entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} progress={progress[entry.id]}
              onRemove={() => onRemove([entry.id], entry.kind === 'movie' ? title.name : `${title.name} ${itemLabel(entry)}`)} />
          ))}
        </ul>
      </div>
    </section>
  );
}

const SORTS = [['added', 'Newest'], ['size', 'Largest']];

function Toolbar({ by, onSort, failed }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex p-1 rounded-xl bg-crimson-950/50 border border-crimson-900/40" role="group" aria-label="Sort downloads">
        {SORTS.map(([key, label]) => (
          <button key={key} onClick={() => onSort(key)} aria-pressed={by === key}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest ${
              by === key ? 'bg-crimson-600 text-white' : 'text-crimson-400 hover:text-crimson-100'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {failed > 0 && (
        <button onClick={retryFailed}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-[11px] font-black uppercase tracking-widest text-amber-300">
          <RotateCcw className="w-3.5 h-3.5" /> Retry {failed} failed
        </button>
      )}
    </div>
  );
}

function UndoBar({ pending, onUndo }) {
  if (!pending) return null;
  return (
    <div role="status"
      className="fixed bottom-[calc(1.5rem+var(--music-bar,0px))] left-1/2 -translate-x-1/2 z-[75] w-[calc(100%-2rem)] max-w-md flex items-center gap-4 px-5 py-3 rounded-2xl bg-crimson-900 border border-crimson-700 shadow-2xl">
      <span className="min-w-0 flex-grow text-sm font-bold text-crimson-50 truncate">Removed {pending.label}</span>
      <button onClick={onUndo} className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-crimson-50 bg-crimson-600 hover:bg-crimson-500">
        Undo
      </button>
    </div>
  );
}

export default function Downloads() {
  useTitle('Downloads');
  const { entries, progress, waiting, prefs } = useVideoDownloads();
  const [moves, setMoves] = useState(0);
  const [by, setBy] = useState('added');
  const { pending, remove, undo } = usePendingRemoval();
  const estimate = useStorageEstimate(entries, moves);

  const hidden = new Set(pending?.ids);
  const shown = Object.fromEntries(Object.entries(entries).filter(([id]) => !hidden.has(id)));
  const titles = titlesOf(shown, { by });
  const failed = Object.values(shown).filter((e) => e.status === 'failed').length;
  const downloadBytes = titlesOf(entries).reduce((sum, t) => sum + t.bytes, 0);

  return (
    <HubShell title="Your" accent="Downloads" icon={<ArrowDownToLine className="w-4 h-4" />}
      subtitle="Kept on this device, playable without a connection">
      <div className="space-y-4">
        {!supported() && <Notice icon={AlertTriangle}>This browser cannot keep videos for offline use.</Notice>}
        {waiting === 'player' && (
          <Notice icon={Clock}>
            The next download starts once no player is open. Looking up its link would interrupt the video you are watching.
          </Notice>
        )}
        {waiting === 'offline' && <Notice icon={WifiOff}>No connection. Downloads carry on once it is back.</Notice>}
      </div>

      <StorageBar estimate={estimate} downloads={downloadBytes} />
      <UpNext entries={entries} progress={progress} paused={prefs.paused} hidden={hidden} />

      {titles.length === 0 ? (
        <p className="text-crimson-300 text-sm max-w-xl">
          Nothing saved yet. Open any movie or episode, press <span className="font-black text-crimson-100">Save offline</span> and pick the source to keep it from.
        </p>
      ) : (
        <div className="space-y-5">
          <Toolbar by={by} onSort={setBy} failed={failed} />
          {titles.map((title) => <TitleCard key={title.key} title={title} progress={progress} onRemove={remove} />)}
        </div>
      )}

      <div className="flex items-center justify-between gap-6 max-w-2xl p-5 rounded-3xl bg-crimson-950/40 border border-crimson-900/40">
        <div className="space-y-1">
          <p className="text-sm font-black text-crimson-50">Delete once watched</p>
          <p className="text-xs font-medium text-crimson-400">
            Removes a download when you leave its player after watching it to the end, so space frees itself up.
          </p>
        </div>
        <PrefToggle active={prefs.autoDelete} onClick={() => setAutoDelete(!prefs.autoDelete)} label="Delete downloads once watched" />
      </div>

      <p className="text-xs text-crimson-400 font-medium max-w-2xl">
        Downloads live {window.CrimsonNative ? 'in a folder on this device' : 'in this browser only'}. They run while
        Crimson Haven is open, pick up where they stopped the next time you open it, and are deleted from the device
        when you sign out.
      </p>
      <DownloadFolder onMoved={() => setMoves((n) => n + 1)} />
      <UndoBar pending={pending} onUndo={undo} />
    </HubShell>
  );
}
