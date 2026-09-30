import { useState } from 'react';
import { Heart, ListPlus, Plus, X, Layers } from 'lucide-react';
import { listLabel, DEFAULT_LIST, ALL_LIST } from './watchlists';

const WatchlistTabs = ({ lists, collageByList, activeList, onSwitch, onCreate, onDelete }) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {lists.map((l) => {
        const active = l.name === activeList;
        const posters = collageByList[l.name] || [];
        return (
          <button
            key={l.name}
            onClick={() => onSwitch(l.name)}
            className={`group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
              active
                ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_8px_20px_rgba(255,0,60,0.25)]'
                : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600'
            }`}
          >
            {posters.length > 0 && (
              <span aria-hidden="true" className="absolute inset-0 flex pointer-events-none">
                {posters.map((p, i) => (
                  <span key={i} className="flex-1 bg-cover bg-center" style={{ backgroundImage: `url(${p})` }} />
                ))}
                <span className={`absolute inset-0 ${active ? 'bg-crimson-600/80' : 'bg-crimson-950/85 group-hover:bg-crimson-950/75'} transition-colors`} />
              </span>
            )}
            <span className="relative z-10 flex items-center gap-2">
              {l.name === ALL_LIST && <Layers className={`w-3.5 h-3.5 ${active ? 'text-crimson-50' : 'text-crimson-500'}`} />}
              {l.name === DEFAULT_LIST && <Heart className={`w-3.5 h-3.5 ${active ? 'fill-white' : 'fill-crimson-700 text-crimson-500'}`} />}
              <span>{listLabel(l.name)}</span>
              <span className={`text-[10px] tabular-nums ${active ? 'text-crimson-100/90' : 'text-crimson-600'}`}>{l.count}</span>
            </span>
          </button>
        );
      })}

      {creating ? (
        <form onSubmit={handleCreate} className="inline-flex items-center gap-2">
          <div className="relative">
            <ListPlus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-crimson-700 pointer-events-none" />
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => { if (!newName.trim()) setCreating(false); }}
              maxLength={100}
              placeholder="List name…"
              className="w-40 pl-8 pr-2 py-2 text-xs font-bold bg-crimson-950/60 border border-crimson-900/60 rounded-xl text-crimson-50 placeholder:text-crimson-700 focus:outline-none focus:border-crimson-600 transition-colors"
            />
          </div>
          <button type="submit" disabled={!newName.trim()} aria-label="Create list"
            className="p-2 rounded-xl bg-crimson-600 text-white hover:bg-crimson-500 disabled:opacity-40 transition-all active:scale-95">
            <Plus className="w-4 h-4" strokeWidth={3} />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-crimson-800/70 text-crimson-500 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          <span>New List</span>
        </button>
      )}

      {activeList !== DEFAULT_LIST && activeList !== ALL_LIST && (
        <button
          onClick={() => onDelete(activeList)}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-crimson-900/60 text-crimson-600 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-crimson-500 hover:bg-crimson-900/30 transition-all active:scale-95"
        >
          <X className="w-3.5 h-3.5" strokeWidth={3} />
          <span>Delete "{listLabel(activeList)}"</span>
        </button>
      )}
    </div>
  );
};

export default WatchlistTabs;
