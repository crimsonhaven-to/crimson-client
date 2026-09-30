import { Calendar, Film, ListVideo, Play, X } from 'lucide-react';

export default function PlayerEpisodeList({ picker, title, onClose }) {
  return (
    <div className="cp-rise absolute inset-0 z-[60] flex flex-col bg-gradient-to-b from-crimson-950/95 via-crimson-950/90 to-black/95 backdrop-blur-2xl">
      <div className="flex items-center gap-3 px-4 sm:px-8 pt-5 pb-4 shrink-0 border-b border-crimson-500/15 bg-crimson-950/40">
        <div className="grid place-items-center w-9 h-9 rounded-xl bg-crimson-500/10 border border-crimson-500/25 text-crimson-400 shrink-0">
          <ListVideo className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">Manifest Index</p>
          <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-crimson-50 truncate">{title || 'Episodes'}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close episodes"
          className="ml-auto shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-crimson-950/60 border border-white/5 text-crimson-300 hover:text-white hover:border-crimson-500/50 transition-all active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {picker.seasons.length > 1 && (
        <div className="flex items-center gap-2 px-4 sm:px-8 py-3 shrink-0 overflow-x-auto no-scrollbar border-b border-white/5">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-700 whitespace-nowrap pr-1">Archives</span>
          {picker.seasons.map((s) => {
            const active = picker.expandedSeason === s.season_number;
            const playing = picker.currentSeason === s.season_number;
            return (
              <button
                key={s.season_number}
                onClick={() => picker.onExpandSeason(s.season_number)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border whitespace-nowrap transition-all active:scale-95 ${
                  active
                    ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.25)]'
                    : 'bg-crimson-950/50 border-crimson-900/50 text-crimson-400 hover:border-crimson-600 hover:bg-crimson-900/30'
                }`}
              >
                Season {s.season_number}
                {playing && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-crimson-300 shadow-[0_0_6px_#ff003c] align-middle" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 sm:px-8 py-5 space-y-2.5">
        {picker.episodesLoading ? (
          [1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-crimson-950/40 border border-crimson-900/30 animate-pulse" />
          ))
        ) : picker.episodes.length > 0 ? (
          picker.episodes.map((ep) => {
            const isNow = picker.expandedSeason === picker.currentSeason
              && ep.episode_number === picker.currentEpisode;
            const hasTitle = ep.title && ep.title !== `Episode ${ep.episode_number}`;
            return (
              <button
                key={ep.episode_number}
                onClick={() => { picker.onSelectEpisode(picker.expandedSeason, ep.episode_number); onClose(); }}
                className={`group w-full flex gap-3 sm:gap-4 text-left p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 ${
                  isNow
                    ? 'bg-crimson-600/15 border-crimson-500/60 shadow-[0_0_25px_rgba(255,0,60,0.15)]'
                    : 'bg-crimson-950/40 border-crimson-900/50 hover:bg-crimson-900/20 hover:border-crimson-500/50'
                }`}
              >
                <div className="relative w-32 sm:w-44 aspect-video shrink-0 rounded-xl overflow-hidden bg-crimson-900/40 shadow-inner">
                  {ep.thumbnail ? (
                    <img src={ep.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-crimson-800"><Film className="w-7 h-7 opacity-20" /></div>
                  )}
                  <div className="absolute inset-0 grid place-items-center bg-crimson-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-2.5 rounded-full bg-crimson-500 shadow-[0_0_15px_rgba(255,0,60,0.5)] translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-crimson-950/90 border border-crimson-800/50 backdrop-blur-md text-[9px] font-black uppercase tracking-widest text-crimson-400">
                    E{ep.episode_number}
                  </span>
                  {isNow && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-crimson-600 text-[8px] font-black uppercase tracking-widest text-white shadow-[0_0_10px_rgba(255,0,60,0.6)]">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> Now
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0 py-0.5 flex-1">
                  <h4 className={`text-sm sm:text-base font-black tracking-tight line-clamp-1 transition-colors ${isNow ? 'text-crimson-300' : 'text-crimson-50 group-hover:text-crimson-400'}`}>
                    {hasTitle ? ep.title : `Episode ${ep.episode_number}`}
                  </h4>
                  {ep.air_date && (
                    <span className="flex items-center gap-1 text-[9px] text-crimson-600 font-black uppercase tracking-widest mt-1 opacity-80">
                      <Calendar className="w-3 h-3" /> {ep.air_date}
                    </span>
                  )}
                  {ep.overview && (
                    <p className="text-[11px] sm:text-xs text-crimson-200/50 leading-relaxed line-clamp-2 sm:line-clamp-3 mt-1.5 font-medium">
                      {ep.overview}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="py-16 text-center space-y-4">
            <div className="w-12 h-12 mx-auto grid place-items-center rounded-full border-2 border-dashed border-crimson-900/50">
              <Film className="w-6 h-6 text-crimson-900" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-crimson-700 italic">No segment data recorded for this season.</p>
          </div>
        )}
      </div>
    </div>
  );
}
