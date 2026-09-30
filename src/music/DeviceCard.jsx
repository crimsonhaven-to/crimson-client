// Per device, so a phone and a laptop on the same account can choose differently.
import { useEffect, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';

import { formatBytes } from '../admin/format';
import { forgetDownloads, useDownloads } from './downloads';
import { PRELOAD_CHOICES, preloadCount, setPreloadCount } from './preload';
import { supported } from './trackStore';

function useStorageUsed(stored) {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? null), () => {});
  }, [stored]);
  return usage;
}

export default function DeviceCard() {
  const downloads = useDownloads();
  const [preload, setPreload] = useState(preloadCount);
  const usage = useStorageUsed(downloads.stored);
  const playlistCount = Object.keys(downloads.saved).length;

  if (!supported()) return null;

  const choosePreload = (count) => {
    setPreloadCount(count);
    setPreload(count);
  };

  const removeAll = () => {
    if (window.confirm('Remove every downloaded song from this device? The playlists stay in your library.')) {
      forgetDownloads();
    }
  };

  return (
    <section className="bg-crimson-950/30 border border-crimson-900/40 rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Smartphone className="w-4 h-4 text-crimson-500" />
        <h2 className="text-[10px] font-black uppercase tracking-widest text-crimson-400 flex-grow">On this device</h2>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-crimson-100">Preload upcoming songs</p>
        <p className="text-xs text-crimson-600">
          Keeps the next songs of the queue here, so a patchy connection does not stop the music.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {PRELOAD_CHOICES.map((count) => (
            <button
              key={count}
              onClick={() => choosePreload(count)}
              aria-pressed={preload === count}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                preload === count
                  ? 'bg-crimson-600 border-crimson-600 text-white'
                  : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-300 hover:border-crimson-600'
              }`}
            >
              {count === 0 ? 'Off' : `${count} songs`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-crimson-100">Downloads</p>
        <p className="text-xs text-crimson-600">
          {playlistCount === 0
            ? 'Open a playlist and press Download to play it without a connection.'
            : `${playlistCount} ${playlistCount === 1 ? 'playlist' : 'playlists'}, ${downloads.stored.size} songs`}
          {usage != null && ` · ${formatBytes(usage)} used by crimsonhaven here`}
        </p>
        {downloads.progress && (
          <p className="flex items-center gap-2 text-xs font-bold text-crimson-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Downloading {downloads.progress.done} of {downloads.progress.total}
          </p>
        )}
        {downloads.failed > 0 && !downloads.progress && (
          <p className="text-xs font-bold text-amber-400">
            {downloads.failed} {downloads.failed === 1 ? 'song' : 'songs'} could not be downloaded. They are tried again next time the app opens online.
          </p>
        )}
        {playlistCount > 0 && (
          <button onClick={removeAll} className="text-[10px] font-black uppercase tracking-widest text-crimson-700 hover:text-crimson-400">
            Remove all downloads
          </button>
        )}
      </div>
    </section>
  );
}
