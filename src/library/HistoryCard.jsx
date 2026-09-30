import { Play, Clock, Trash2 } from 'lucide-react';
import { timeAgo, airDateLabel } from './historyDates';
import { resumeInfo } from './historyResume';

const HistoryCard = ({ item, view, onOpen, onRemove }) => {
  const { mode, actionLabel, percent, nextAirDate } = resumeInfo(item);
  const ago = timeAgo(item.updated_at);
  const handleRemove = (e) => { e.stopPropagation(); onRemove(item); };

  if (view === 'list') {
    return (
      <div
        onClick={onOpen}
        className="group relative flex items-center gap-4 p-3 pr-4 bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 rounded-2xl hover:border-crimson-500/50 hover:shadow-[0_10px_25px_rgba(0,0,0,0.35)] transition-[border-color,box-shadow] duration-300 cursor-pointer"
      >
        <div className="w-12 h-16 shrink-0 relative rounded-lg overflow-hidden border border-crimson-900/50">
          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-crimson-900/80">
            <div className="h-full bg-crimson-500" style={{ width: `${percent}%` }}></div>
          </div>
        </div>

        <div className="flex-grow min-w-0">
          <h4 className="text-sm sm:text-base font-black text-crimson-50 truncate group-hover:text-crimson-400 transition-colors tracking-tight">
            {item.title}
          </h4>
          <div className="mt-1 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-crimson-600">
            <span className="text-crimson-400">{item.media_type === 'movie' ? 'Movie' : item.media_type === 'manga' ? <>Ch. {item.episode_number}</> : (item.media_type === 'local' && item.episode_number == null) ? 'Local' : <>S{item.season_number}<span className="text-crimson-700 mx-0.5">•</span>E{item.episode_number}</>}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{percent}%</span>
            {item.status === 'completed' && <span className="text-crimson-400">Finished</span>}
            {ago && <span className="text-crimson-700 normal-case tracking-normal">· {ago}</span>}
          </div>
        </div>

        <button
          onClick={handleRemove}
          aria-label="Remove from history"
          className="shrink-0 p-2 rounded-full text-crimson-700 hover:text-white hover:bg-crimson-900/50 transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <div className="shrink-0 p-2 rounded-full bg-crimson-500 text-white shadow-[0_0_10px_rgba(255,0,60,0.5)] group-hover:scale-110 transition-transform">
          <Play className="w-3.5 h-3.5 fill-white" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onOpen}
      className="group relative flex gap-5 p-4 bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 rounded-3xl hover:border-crimson-500/50 hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)] transition-[border-color,box-shadow] duration-300 cursor-pointer overflow-hidden"
    >
      <div className="absolute -inset-24 bg-crimson-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none transform-gpu"></div>

      <button
        onClick={handleRemove}
        aria-label="Remove from history"
        className="absolute top-3 right-3 z-20 p-2 rounded-full bg-crimson-950/80 border border-crimson-900/60 text-crimson-500 hover:text-white hover:border-crimson-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="w-28 sm:w-36 aspect-[2/3] shrink-0 relative rounded-2xl overflow-hidden shadow-2xl border border-crimson-900/50">
        <img src={item.poster} alt={item.title} className="w-full h-full object-cover transform-gpu group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-transparent to-transparent opacity-60"></div>

        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-crimson-900/80">
          <div
            className="h-full bg-crimson-500 shadow-[0_0_12px_rgba(255,0,60,0.8)] transition-all duration-1000"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>

      <div className="flex flex-col justify-between py-1 flex-grow min-w-0 relative z-10">
        <div className="space-y-2">
          <h4 className="text-base sm:text-lg font-black text-crimson-50 truncate group-hover:text-crimson-400 transition-colors tracking-tight">
            {item.title}
          </h4>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-crimson-500/10 text-crimson-400 text-[10px] font-black uppercase rounded-lg border border-crimson-500/20 tracking-widest">
              {item.media_type === 'movie' ? 'Movie' : item.media_type === 'manga' ? <>Ch. {item.episode_number}</> : (item.media_type === 'local' && item.episode_number == null) ? 'Local' : <>S{item.season_number} <span className="text-crimson-700 mx-0.5">•</span> E{item.episode_number}</>}
            </span>
            {ago && <span className="text-[10px] font-bold text-crimson-700">{ago}</span>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {percent}%
            </span>
            {item.status === 'completed' && (
              <span className="text-crimson-400 bg-crimson-400/10 px-2 py-0.5 rounded-md border border-crimson-400/20">Finished</span>
            )}
          </div>
          <button
            title={mode === 'upcoming' && nextAirDate ? `Next episode airs ${airDateLabel(nextAirDate)}` : undefined}
            className="flex items-center gap-2.5 text-[10px] font-black text-crimson-50 uppercase tracking-[0.2em] group-hover:translate-x-2 transition-all duration-300"
          >
            <span>{actionLabel}</span>
            <div className="p-1.5 rounded-full bg-crimson-500 shadow-[0_0_10px_rgba(255,0,60,0.5)]">
              <Play className="w-3 h-3 fill-white" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryCard;
