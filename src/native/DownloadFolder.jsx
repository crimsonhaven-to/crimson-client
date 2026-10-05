import { useEffect, useState } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';

// IPC errors arrive wrapped as "Error invoking remote method '...': Error: ...".
const plainMessage = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

// The desktop app keeps downloads as files in a folder that can move, for
// example to a bigger drive. The web build has no such folder.
export default function DownloadFolder({ onMoved }) {
  const media = window.CrimsonNative?.media;
  const [root, setRoot] = useState(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    media?.usage().then((usage) => setRoot(usage.root), () => {});
  }, [media]);

  if (!media) return null;

  const change = async () => {
    setMoving(true);
    setError(null);
    try {
      const moved = await media.chooseRoot();
      if (moved) {
        setRoot(moved);
        onMoved?.();
      }
    } catch (err) {
      setError(plainMessage(err));
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] text-crimson-600 font-bold break-all">Saved in {root || '...'}</span>
        <button onClick={change} disabled={moving}
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300 disabled:opacity-50">
          {moving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
          {moving ? 'Moving' : 'Change folder'}
        </button>
      </div>
      {error && <p className="text-[11px] font-bold text-amber-400">{error}</p>}
    </div>
  );
}
