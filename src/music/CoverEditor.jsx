// The cover is its own edit button, since that is where a member looks first. On a
// touch screen there is no hover to reveal it, so a small badge says it is tappable.
import { useRef, useState } from 'react';
import { ImageOff, ImagePlus, Loader2 } from 'lucide-react';

import { Cover } from './Cover';
import { shrinkCover } from './coverImage';
import { musicApi } from './hooks';

export default function CoverEditor({ playlist, className = '', onChanged, onError }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (e) => {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again still fires a change.
    e.target.value = '';
    if (file) run(async () => musicApi.setCover(playlist.id, await shrinkCover(file)));
  };

  return (
    <div className={`relative group flex-shrink-0 ${className}`}>
      <Cover src={playlist.cover_url} className="w-full h-full rounded-3xl shadow-2xl" />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        aria-label="Change cover"
        className={`absolute inset-0 rounded-3xl flex flex-col items-center justify-center gap-2 bg-crimson-950/70 text-crimson-100 text-[11px] font-black uppercase tracking-widest transition-opacity ${
          busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
        {busy ? 'Saving' : 'Change cover'}
      </button>
      {!busy && (
        <span className="hidden pointer-coarse:flex absolute bottom-2 right-2 w-8 h-8 rounded-full bg-crimson-950/80 text-crimson-200 items-center justify-center pointer-events-none">
          <ImagePlus className="w-4 h-4" />
        </span>
      )}
      {playlist.custom_cover && !busy && (
        <button
          type="button"
          onClick={() => run(() => musicApi.removeCover(playlist.id))}
          aria-label="Back to the original cover"
          title="Back to the original cover"
          className="absolute top-2 right-2 p-2 rounded-full bg-crimson-950/80 text-crimson-300 hover:text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 transition-opacity"
        >
          <ImageOff className="w-4 h-4" />
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}
