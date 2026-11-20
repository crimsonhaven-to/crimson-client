// A long playlist must not turn Now Playing into an endless page. On a phone only
// the next few songs show until the list is opened, and then it scrolls inside a
// box; beside the player on a wide screen it is a panel with its own scrollbar.
import { useState } from 'react';
import { ChevronDown, ChevronUp, ListMusic } from 'lucide-react';

import { Cover } from './Cover';
import { formatTime } from './queue';
import { playAt } from './player';

const PREVIEW = 3;
// Rendering a thousand rows costs more than anyone scrolls through.
const SHOWN = 100;

export default function UpNext({ state }) {
  const [open, setOpen] = useState(false);
  const remaining = Math.max(0, state.order.length - state.position - 1);
  const upcoming = state.order.slice(state.position + 1, state.position + 1 + SHOWN);

  return (
    <section className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] flex flex-col">
      <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-crimson-500 mb-3 flex-shrink-0">
        <ListMusic className="w-4 h-4" /> Up next
        {remaining > 0 && <span className="text-crimson-400 normal-case tracking-normal font-bold">· {remaining} {remaining === 1 ? 'song' : 'songs'}</span>}
      </h2>

      {upcoming.length === 0 ? (
        <p className="text-crimson-400 text-sm italic">The queue ends after this track.</p>
      ) : (
        <>
          <ol className={`space-y-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1 ${open ? 'max-lg:max-h-[60vh] max-lg:overflow-y-auto max-lg:pr-1' : ''}`}>
            {upcoming.map((index, offset) => {
              const t = state.tracks[index];
              return (
                <li key={`${t.id}-${offset}`} className={!open && offset >= PREVIEW ? 'max-lg:hidden' : ''}>
                  <button onClick={() => playAt(state.position + 1 + offset)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-crimson-900/30 text-left transition-colors">
                    <Cover src={t.cover_url} className="w-10 h-10 rounded-md flex-shrink-0" />
                    <div className="min-w-0 flex-grow">
                      <p className="text-sm font-bold text-crimson-100 truncate">{t.title}</p>
                      <p className="text-xs text-crimson-500 truncate">{t.artists.join(', ')}</p>
                    </div>
                    <span className="text-[11px] text-crimson-400 tabular-nums">{formatTime(t.duration_ms / 1000)}</span>
                  </button>
                </li>
              );
            })}
            {remaining > SHOWN && (
              <li className={`px-2 pt-2 text-xs text-crimson-400 italic ${open ? '' : 'max-lg:hidden'}`}>
                and {remaining - SHOWN} more after these
              </li>
            )}
          </ol>
          {upcoming.length > PREVIEW && (
            <button onClick={() => setOpen(!open)}
              className="lg:hidden mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-crimson-900/60 text-[11px] font-black uppercase tracking-widest text-crimson-400 hover:text-crimson-200 hover:bg-crimson-900/30 transition-colors">
              {open ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show the whole queue</>}
            </button>
          )}
        </>
      )}
    </section>
  );
}
