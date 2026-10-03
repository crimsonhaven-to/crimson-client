import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';

import { posterKey, read } from './videoStore';

// The device's copy of the poster, so it shows offline; the original while
// that copy is missing.
export default function OfflinePoster({ titleKey, fallback, className = '' }) {
  const [local, setLocal] = useState(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    read(posterKey(titleKey)).then(async (res) => {
      if (!res || cancelled) return;
      url = URL.createObjectURL(await res.blob());
      if (cancelled) URL.revokeObjectURL(url);
      else setLocal(url);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [titleKey]);

  const src = local || fallback;
  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-crimson-950/60 border border-crimson-900/40 ${className}`}>
        <Film className="w-8 h-8 text-crimson-800" />
      </div>
    );
  }
  return <img src={src} alt="" onError={() => setBroken(true)} className={`object-cover ${className}`} />;
}
