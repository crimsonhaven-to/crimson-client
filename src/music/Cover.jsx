import { useState } from 'react';
import { Disc3 } from 'lucide-react';

// A cover image with a placeholder for tracks that have none, or whose image
// fails to load (a Spotify cover taken down, an expired signed link).
export function Cover({ src, className = '', alt = '' }) {
  // Remembered per src, so the mini player's next track gets its own chance.
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) {
    return (
      <div className={`bg-crimson-900/40 border border-crimson-900/60 flex items-center justify-center ${className}`}>
        <Disc3 className="w-1/2 h-1/2 text-crimson-700" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailedSrc(src)} className={`object-cover ${className}`} />;
}
