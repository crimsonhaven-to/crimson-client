// The phone's share sheet where there is one, the clipboard everywhere else.
import { useState } from 'react';
import { Check, Loader2, Share2 } from 'lucide-react';

import { musicApi } from './hooks';

const CONFIRM_MS = 2000;

async function linkFor(track) {
  if (track.share_url) return track.share_url;
  return (await musicApi.share(track.id)).url;
}

export default function ShareButton({ track, className = '' }) {
  const [phase, setPhase] = useState('idle');

  const share = async () => {
    setPhase('working');
    try {
      const url = await linkFor(track);
      const title = `${track.title} · ${track.artists.join(', ')}`;
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          setPhase('idle');
          return;
        } catch (err) {
          if (err?.name === 'AbortError') {
            setPhase('idle');
            return;
          }
        }
      }
      await navigator.clipboard.writeText(url);
      setPhase('copied');
      setTimeout(() => setPhase('idle'), CONFIRM_MS);
    } catch {
      setPhase('failed');
      setTimeout(() => setPhase('idle'), CONFIRM_MS);
    }
  };

  const label = { copied: 'Link copied', failed: 'Could not share' }[phase] || 'Share song';
  return (
    <button onClick={share} disabled={phase === 'working'} aria-label={label} title={label}
      className={`p-2 transition-colors ${phase === 'failed' ? 'text-amber-400' : 'text-crimson-100/50 hover:text-crimson-200'} ${className}`}>
      {phase === 'working' ? <Loader2 className="w-5 h-5 animate-spin" />
        : phase === 'copied' ? <Check className="w-5 h-5 text-emerald-400" />
          : <Share2 className="w-5 h-5" />}
    </button>
  );
}
