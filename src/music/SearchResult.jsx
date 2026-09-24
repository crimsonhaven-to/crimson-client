// One recording the server found, as both pickers show it: picking the
// recording for an imported song, and adding songs to your own playlist.
import { ExternalLink } from 'lucide-react';

import { formatTime } from './queue';

export default function SearchResult({ result, detail, note, children }) {
  return (
    <li className="flex items-center gap-3 p-2 rounded-xl hover:bg-crimson-900/20">
      {result.thumbnail_url
        ? <img src={result.thumbnail_url} alt="" className="w-20 h-12 object-cover rounded-md flex-shrink-0" loading="lazy" />
        : <div className="w-20 h-12 rounded-md bg-crimson-900/40 flex-shrink-0" />}
      <div className="min-w-0 flex-grow">
        <p className="text-sm font-bold text-crimson-100 truncate">{result.title}</p>
        <p className="text-xs text-crimson-500 truncate">
          {result.channel} · {formatTime(result.duration_ms / 1000)}{detail}
        </p>
        {note && <p className="text-[11px] text-crimson-700 truncate" title={note}>{note}</p>}
      </div>
      <a href={result.url} target="_blank" rel="noopener noreferrer" aria-label="Open the source" className="p-2 text-crimson-700 hover:text-crimson-300">
        <ExternalLink className="w-4 h-4" />
      </a>
      {children}
    </li>
  );
}
