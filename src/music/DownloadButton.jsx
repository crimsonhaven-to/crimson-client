// Download a playlist for offline listening, or remove it from the device.
// Shows how much a download takes before it starts, and its progress after.
import { CircleCheck, Download, Loader2 } from 'lucide-react';

import { formatBytes } from '../admin/format';
import { downloadPlaylist, isDownloaded, removeDownload, useDownloads } from './downloads';
import { supported } from './trackStore';

const BUTTON = 'flex items-center gap-2 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40';

export default function DownloadButton({ playlist, tracks }) {
  const downloads = useDownloads();
  if (!supported()) return null;

  const ready = tracks.filter((t) => t.status === 'ready');
  const missing = ready.filter((t) => !downloads.stored.has(t.id));

  if (!isDownloaded(playlist.id, downloads)) {
    const bytes = missing.reduce((sum, t) => sum + (t.file_size || 0), 0);
    return (
      <button
        disabled={!ready.length}
        onClick={() => downloadPlaylist(playlist, tracks)}
        title={bytes ? `About ${formatBytes(bytes)} on this device` : undefined}
        className={BUTTON}
      >
        <Download className="w-4 h-4" /> Download{bytes ? ` · ${formatBytes(bytes)}` : ''}
      </button>
    );
  }

  const remove = () => {
    if (window.confirm(`Remove "${playlist.name}" from this device? It stays in your library.`)) {
      removeDownload(playlist.id);
    }
  };

  if (missing.length && downloads.progress) {
    return (
      <button onClick={remove} title="Stop and remove from this device" className={BUTTON}>
        <Loader2 className="w-4 h-4 animate-spin" /> {ready.length - missing.length} of {ready.length}
      </button>
    );
  }
  return (
    <button onClick={remove} title="Remove from this device" className={`${BUTTON} !text-emerald-300`}>
      <CircleCheck className="w-4 h-4" />
      {missing.length ? `${missing.length} not downloaded yet` : 'Downloaded'}
    </button>
  );
}
