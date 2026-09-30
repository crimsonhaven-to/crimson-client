import { Play, Trash2, GripVertical, Circle, CircleCheck, FolderPlus } from 'lucide-react';
import { kindOf, TYPE_META } from './watchlistItem';

const WatchlistCard = ({
  item, view, removable, selectMode, selected, draggable, isDragOver,
  onOpen, onRemove, onLists, onToggleSelect, dragProps,
}) => {
  const kind = kindOf(item);
  const { label: kindLabel, icon: KindIcon } = TYPE_META[kind];
  const stop = (fn) => (e) => { e.stopPropagation(); fn(item); };
  const handleClick = selectMode ? () => onToggleSelect(item) : onOpen;

  const SelMark = selected ? CircleCheck : Circle;
  const ring = selected
    ? 'border-crimson-500 shadow-[0_0_0_2px_rgba(255,0,60,0.5)]'
    : isDragOver ? 'border-crimson-400' : 'border-crimson-900/40';

  if (view === 'list') {
    return (
      <div
        {...dragProps}
        onClick={handleClick}
        className={`group relative flex items-center gap-4 p-3 pr-4 bg-crimson-950/30 backdrop-blur-md border rounded-2xl hover:border-crimson-500/50 hover:shadow-[0_10px_25px_rgba(0,0,0,0.35)] transition-[border-color,box-shadow] duration-300 cursor-pointer ${ring} ${isDragOver ? 'ring-2 ring-crimson-500/40' : ''}`}
      >
        {draggable && (
          <span className="shrink-0 -ml-1 text-crimson-700 cursor-grab active:cursor-grabbing" aria-hidden="true">
            <GripVertical className="w-4 h-4" />
          </span>
        )}
        {selectMode && (
          <SelMark className={`shrink-0 w-5 h-5 ${selected ? 'text-crimson-400' : 'text-crimson-700'}`} />
        )}

        <div className="w-12 h-16 shrink-0 relative rounded-lg overflow-hidden border border-crimson-900/50">
          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
        </div>

        <div className="flex-grow min-w-0">
          <h4 className="text-sm sm:text-base font-black text-crimson-50 truncate group-hover:text-crimson-400 transition-colors tracking-tight">
            {item.title}
          </h4>
          <div className="mt-1 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-crimson-600">
            <span className="flex items-center gap-1 text-crimson-400"><KindIcon className="w-3 h-3" />{kindLabel}</span>
            <span className="text-crimson-700 normal-case tracking-normal">· Ref {item.anilist_id || item.tmdb_id}</span>
          </div>
        </div>

        {!selectMode && (
          <>
            <button
              onClick={stop(onLists)}
              aria-label={`Add ${item.title} to a list`}
              className="shrink-0 p-2 rounded-full text-crimson-700 hover:text-white hover:bg-crimson-900/50 transition-all opacity-0 group-hover:opacity-100"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            {removable && (
              <button
                onClick={stop(onRemove)}
                aria-label={`Remove ${item.title}`}
                className="shrink-0 p-2 rounded-full text-crimson-700 hover:text-white hover:bg-crimson-900/50 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="shrink-0 p-2 rounded-full bg-crimson-500 text-white shadow-[0_0_10px_rgba(255,0,60,0.5)] group-hover:scale-110 transition-transform">
              <Play className="w-3.5 h-3.5 fill-white" />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div {...dragProps} className="group relative flex flex-col">
      <div
        onClick={handleClick}
        className={`aspect-[2/3] relative overflow-hidden rounded-2xl border shadow-2xl cursor-pointer transition-[border-color,box-shadow,transform] duration-500 group-hover:border-crimson-500/50 group-hover:shadow-[0_0_30px_rgba(255,0,60,0.2)] ${ring} ${isDragOver ? 'ring-2 ring-crimson-500/50 scale-[0.97]' : ''}`}
      >
        <img
          src={item.poster}
          alt={item.title}
          className="w-full h-full object-cover transform-gpu transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-crimson-950/20 to-transparent opacity-80"></div>

        <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-crimson-950/80 backdrop-blur-md border border-crimson-900/60 text-[8px] font-black uppercase tracking-[0.15em] text-crimson-400">
          <KindIcon className="w-2.5 h-2.5" />
          {kindLabel}
        </div>

        {draggable && !selectMode && (
          <div className="absolute top-2.5 right-2.5 p-1 rounded-md bg-crimson-950/80 border border-crimson-900/60 text-crimson-500 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}

        {selectMode && (
          <div className="absolute top-2.5 right-2.5">
            <SelMark className={`w-6 h-6 drop-shadow ${selected ? 'text-crimson-400' : 'text-white/80'}`} />
          </div>
        )}

        {!selectMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-crimson-950/40 backdrop-blur-[2px]">
            <button
              onClick={stop(onOpen)}
              aria-label={`Open ${item.title}`}
              className="p-4 bg-crimson-500 text-white rounded-full hover:bg-crimson-400 transform hover:scale-110 transition-all shadow-[0_10px_20px_rgba(255,0,60,0.4)]"
            >
              <Play className="w-6 h-6 fill-current" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={stop(onLists)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-crimson-950/80 text-[10px] font-black uppercase tracking-widest text-crimson-400 rounded-full border border-crimson-900 hover:text-white hover:border-crimson-600 transition-all"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Lists</span>
              </button>
              {removable && (
                <button
                  onClick={stop(onRemove)}
                  aria-label={`Remove ${item.title}`}
                  className="p-2 bg-crimson-950/80 text-crimson-400 rounded-full border border-crimson-900 hover:text-white hover:border-crimson-600 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 px-1">
        <h4 className="text-sm font-bold text-crimson-50 line-clamp-1 group-hover:text-crimson-400 transition-colors tracking-tight">
          {item.title}
        </h4>
      </div>
    </div>
  );
};

export default WatchlistCard;
