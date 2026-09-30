import { Trash2, X, FolderPlus } from 'lucide-react';

// onRemove is omitted on the "All" view, which has no single list to remove from.
const SelectionBar = ({ selectedCount, allSelected, onToggleAll, onAddToList, onRemove, onDone }) => (
  <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl animate-in slide-in-from-bottom-4 duration-200">
    <div className="flex items-center gap-3 p-2.5 pl-4 rounded-2xl border border-crimson-700/50 bg-crimson-950/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
      <span className="text-xs font-black uppercase tracking-widest text-crimson-300 tabular-nums">
        {selectedCount} selected
      </span>
      <button
        onClick={onToggleAll}
        className="text-[10px] font-black uppercase tracking-widest text-crimson-600 hover:text-crimson-300 transition-colors"
      >
        {allSelected ? 'Clear' : 'Select all'}
      </button>

      <div className="flex-1" />

      <button
        onClick={() => selectedCount && onAddToList()}
        disabled={!selectedCount}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-crimson-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-crimson-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_20px_rgba(255,0,60,0.3)] transition-all active:scale-95"
      >
        <FolderPlus className="w-4 h-4" />
        <span>Add to list</span>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={!selectedCount}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-crimson-900/60 text-crimson-300 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-crimson-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
          <span>Remove</span>
        </button>
      )}
      <button
        onClick={onDone}
        aria-label="Done selecting"
        className="p-2 rounded-xl text-crimson-600 hover:text-white hover:bg-crimson-900/50 transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

export default SelectionBar;
