import { Heart, ListPlus, Plus, Circle, CircleCheck, FolderPlus } from 'lucide-react';
import { listLabel, DEFAULT_LIST } from './watchlists';
import Dialog from './Dialog';

// mode 'item' toggles one item's membership per list; mode 'bulk' adds the selection to one list.
const ListPickerDialog = ({ mode, item, bulkCount, lists, listsForItem, onPick, onClose }) => (
  <Dialog
    icon={FolderPlus}
    title={mode === 'bulk' ? `Add ${bulkCount} to a list` : 'Manage lists'}
    subtitle={mode === 'item' ? item.title : null}
    onClose={onClose}
  >
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
  </Dialog>
);

export default ListPickerDialog;
