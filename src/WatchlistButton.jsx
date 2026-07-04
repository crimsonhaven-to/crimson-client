import { useState, useRef, useEffect } from 'react';
import { Heart, Check, Plus, ListPlus } from 'lucide-react';
import { useWatchlists, listLabel, DEFAULT_LIST, useSessionToken } from './hooks';

// Per-show "add to list(s)" control used on the overview and watch pages. Opens a
// popover of every watchlist with a check next to the ones this show belongs to;
// toggling a row adds/removes it, and a footer input creates a brand-new list and
// drops the show straight into it.
//
// `item` is the minimal show identity ({ tmdb_id?, anilist_id?, title, poster }).
// `variant` ('overview' | 'watch') only tunes the trigger styling and which side
// the popover anchors to, so it sits naturally in either layout.
const WatchlistButton = ({ item, variant = 'overview' }) => {
  const sessionToken = useSessionToken();
  const { lists, listsForItem, toggleInList, createList, addToList } = useWatchlists();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const rootRef = useRef(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Saving requires a linked account; without one the control is hidden so the
  // overview/watch layouts simply omit it (matching the old behaviour).
  if (!item || !sessionToken) return null;

  const current = listsForItem(item);
  const savedCount = current.length;
  const isSaved = savedCount > 0;

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createList(name);
    await addToList(item, name);
    setNewName('');
  };

  const isOverview = variant === 'overview';
  const triggerBase = isOverview
    ? 'group inline-flex items-center gap-3 font-black uppercase tracking-[0.2em] text-xs px-8 py-4 rounded-2xl border transition-all active:scale-95'
    : 'ml-auto flex items-center gap-2.5 px-5 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest';
  const triggerActive = isOverview
    ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_15px_30px_rgba(255,0,60,0.3)] hover:bg-crimson-500'
    : 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.3)]';
  const triggerIdle = isOverview
    ? 'bg-crimson-950/40 border-crimson-900/60 text-crimson-300 hover:text-white hover:border-crimson-600 hover:bg-crimson-900/30 backdrop-blur-sm'
    : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-500 hover:text-white hover:border-crimson-600';

  const label = isSaved
    ? (isOverview
        ? `In ${savedCount} list${savedCount === 1 ? '' : 's'}`
        : `Saved${savedCount > 1 ? ` ·${savedCount}` : ''}`)
    : (isOverview ? 'Save to Watchlist' : 'Save');

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${triggerBase} ${isSaved ? triggerActive : triggerIdle}`}
      >
        <Heart className={`w-4 h-4 transition-transform group-hover:scale-110 ${isSaved ? 'fill-white' : ''}`} />
        <span>{label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 mt-2 w-64 max-w-[80vw] ${isOverview ? 'left-0' : 'right-0'}
            rounded-2xl border border-crimson-900/60 bg-crimson-950/95 backdrop-blur-xl
            shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="px-4 py-3 border-b border-crimson-900/50">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-crimson-500">Add to Watchlist</p>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {lists.map((l) => {
              const active = current.includes(l.name);
              return (
                <button
                  key={l.name}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={active}
                  onClick={() => toggleInList(item, l.name)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-crimson-900/40 group/row"
                >
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded-md border transition-all shrink-0 ${
                      active
                        ? 'bg-crimson-500 border-crimson-400 text-white'
                        : 'border-crimson-800 text-transparent group-hover/row:border-crimson-600'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                  <span className={`flex-1 text-sm font-bold tracking-tight truncate ${active ? 'text-crimson-50' : 'text-crimson-200'}`}>
                    {listLabel(l.name)}
                  </span>
                  {l.name === DEFAULT_LIST && (
                    <Heart className="w-3 h-3 text-crimson-700 fill-crimson-800 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCreate} className="flex items-center gap-2 p-3 border-t border-crimson-900/50">
            <div className="relative flex-1">
              <ListPlus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-crimson-700 pointer-events-none" />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
                placeholder="New list…"
                className="w-full pl-8 pr-2 py-2 text-xs font-bold bg-crimson-950/60 border border-crimson-900/60 rounded-lg text-crimson-50 placeholder:text-crimson-700 focus:outline-none focus:border-crimson-600 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!newName.trim()}
              aria-label="Create list and add"
              className="shrink-0 p-2 rounded-lg bg-crimson-600 text-white hover:bg-crimson-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default WatchlistButton;
