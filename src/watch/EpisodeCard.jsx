import { Play, Calendar, Film } from 'lucide-react';

// `active` marks the episode that is playing right now, which only the watch page knows.
const EpisodeCard = ({ ep, active = false, onSelect }) => {
  const hasTitle = ep.title && ep.title !== `Episode ${ep.episode_number}`;
  return (
    <button
      onClick={onSelect}
      className={`group flex gap-3 sm:gap-4 text-left p-2.5 sm:p-3 rounded-2xl border backdrop-blur-md transition-all duration-300 ${
        active
          ? 'bg-crimson-600/15 border-crimson-500/60 shadow-[0_0_25px_rgba(255,0,60,0.15)]'
          : 'bg-crimson-950/30 border-crimson-900/40 hover:bg-crimson-900/20 hover:border-crimson-500/50 hover:shadow-[0_0_20px_rgba(255,0,60,0.1)]'
      }`}
    >
      <div className="relative w-32 sm:w-44 aspect-video flex-shrink-0 rounded-xl overflow-hidden bg-crimson-900/40 shadow-inner">
        {ep.thumbnail ? (
          <img src={ep.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-crimson-800">
            <Film className="w-8 h-8 opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-crimson-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="bg-crimson-500 p-2.5 rounded-full shadow-[0_0_15px_rgba(255,0,60,0.5)] transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
        <span className="absolute top-2 left-2 bg-crimson-950/90 text-crimson-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-crimson-800/50 backdrop-blur-md">
          E{ep.episode_number}
        </span>
        {active && (
          <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-crimson-600 text-[8px] font-black uppercase tracking-widest text-white shadow-[0_0_10px_rgba(255,0,60,0.6)]">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> Now
          </span>
        )}
      </div>

      <div className="flex flex-col min-w-0 py-1">
        <h4 className={`text-sm sm:text-base font-bold transition-colors line-clamp-1 tracking-tight ${active ? 'text-crimson-300' : 'text-crimson-50 group-hover:text-crimson-400'}`}>
          {hasTitle ? ep.title : `Episode ${ep.episode_number}`}
        </h4>
        {ep.air_date && (
          <span className="flex items-center gap-1 text-[10px] text-crimson-600 font-black uppercase tracking-widest mt-1 opacity-80">
            <Calendar className="w-3 h-3" /> {ep.air_date}
          </span>
        )}
        {ep.overview && (
          <p className="text-xs text-crimson-200/50 leading-relaxed line-clamp-2 mt-2 font-medium">
            {ep.overview}
          </p>
        )}
      </div>
    </button>
  );
};

export default EpisodeCard;
