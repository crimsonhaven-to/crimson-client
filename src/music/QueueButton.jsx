import { useEffect, useState } from 'react';
import { Check, ListPlus } from 'lucide-react';

import { queueTracks } from './player';

const CONFIRM_MS = 1500;

// One song as a small icon on its row, or a whole list as a labelled button.
export default function QueueButton({ tracks, source = null, label = null, className = '' }) {
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    if (!queued) return undefined;
    const timer = setTimeout(() => setQueued(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [queued]);

  const playable = tracks.filter((t) => t.stream_url);
  const Icon = queued ? Check : ListPlus;
  const title = playable.length === 1 ? 'Add to queue' : `Add ${playable.length} songs to the queue`;

  return (
    <button
      disabled={!playable.length}
      onClick={() => setQueued(queueTracks(playable, source) > 0)}
      aria-label={label ? undefined : title}
      title={title}
      className={className}
    >
      <Icon className={`w-4 h-4 ${queued ? 'text-emerald-400' : ''}`} />
      {label && (queued ? 'Queued' : label)}
    </button>
  );
}
