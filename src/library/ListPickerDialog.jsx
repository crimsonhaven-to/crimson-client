import { Heart, ListPlus, Plus, Circle, CircleCheck, FolderPlus } from 'lucide-react';
import { listLabel, DEFAULT_LIST } from './watchlists';

// mode 'item' toggles one item's membership per list; mode 'bulk' adds the selection to one list.
const ListPickerDialog = ({ mode, item, bulkCount, lists, listsForItem, onPick, onClose }) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-md bg-crimson-950 border border-crimson-900/70 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-7 space-y-5 animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-crimson-500/10 border border-crimson-500/30">
          <FolderPlus className="w-6 h-6 text-crimson-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-black text-crimson-50 uppercase tracking-tight leading-tight">
            {mode === 'bulk' ? `Add ${bulkCount} to a list` : 'Manage lists'}
          </h3>
          {mode === 'item' && (
            <p className="text-xs text-crimson-500 font-bold truncate">{item.title}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
        {lists.map((l) => {
          const inList = mode === 'item' && listsForItem(item).includes(l.name);
          return (
            <button
              key={l.name}
              onClick={() => onPick(l.name)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-crimson-900/50 bg-crimson-950/40 text-left hover:border-crimson-600 hover:bg-crimson-900/30 transition-all active:scale-[0.98]"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                {l.name === DEFAULT_LIST
                  ? <Heart className="w-4 h-4 shrink-0 text-crimson-500 fill-crimson-700" />
                  : <ListPlus className="w-4 h-4 shrink-0 text-crimson-600" />}
                <span className="font-black text-sm text-crimson-100 truncate">{listLabel(l.name)}</span>
                <span className="text-[10px] font-black text-crimson-700 tabular-nums">{l.count}</span>
              </span>
              {mode === 'item'
                ? (inList
                    ? <CircleCheck className="w-5 h-5 shrink-0 text-crimson-400" />
                    : <Circle className="w-5 h-5 shrink-0 text-crimson-800" />)
                : <Plus className="w-4 h-4 shrink-0 text-crimson-500" strokeWidth={3} />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end pt-1">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-crimson-600 text-white text-xs font-black uppercase tracking-widest hover:bg-crimson-500 shadow-[0_8px_20px_rgba(255,0,60,0.3)] transition-all active:scale-95"
        >
          Done
        </button>
      </div>
    </div>
  </div>
);

export default ListPickerDialog;
