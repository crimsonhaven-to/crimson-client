import { Film, ListVideo } from 'lucide-react';
import EpisodeCard from './EpisodeCard';

// Season chips only browse; the episode card is what navigates.
const EpisodePicker = ({
  seasons, currentSeason, currentEpisode,
  expandedSeason, onExpandSeason,
  episodes, episodesLoading, onSelectEpisode,
}) => (
  <div className="space-y-6">
    {seasons.length > 1 && (
      <div className="p-4 sm:p-5 bg-crimson-950/30 border border-crimson-900/30 rounded-3xl flex items-center gap-4 overflow-x-auto no-scrollbar backdrop-blur-sm">
        <span className="text-[10px] font-black uppercase text-crimson-700 tracking-[0.3em] whitespace-nowrap pl-2">Archives</span>
        <div className="flex gap-2">
          {seasons.map((season) => {
            const active = expandedSeason === season.season_number;
            const playing = currentSeason === season.season_number;
            return (
              <button
                key={season.season_number}
                onClick={() => onExpandSeason(season.season_number)}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-black border transition-all duration-300 whitespace-nowrap uppercase tracking-widest ${
                  active
                    ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.2)]'
                    : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-400 hover:border-crimson-600 hover:bg-crimson-900/30'
                }`}
              >
                Season {season.season_number}
                {playing && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-crimson-300 shadow-[0_0_6px_#ff003c] align-middle" />}
              </button>
            );
          })}
        </div>
      </div>
    )}

    <div className="p-6 sm:p-10 bg-crimson-950/30 border border-crimson-900/30 rounded-[2.5rem] space-y-8 backdrop-blur-sm shadow-2xl">
      <div className="flex items-center gap-4">
        <h3 className="text-xl font-black text-crimson-50 flex items-center gap-3 uppercase tracking-tighter whitespace-nowrap">
          <ListVideo className="w-6 h-6 text-crimson-500" /> Manifest Segments
          {seasons.length > 1 && (
            <span className="text-[11px] font-black uppercase tracking-widest text-crimson-600 opacity-80">· Season {expandedSeason}</span>
          )}
        </h3>
        <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
        {!episodesLoading && episodes.length > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-crimson-600 whitespace-nowrap opacity-80">
            <Film className="w-3 h-3" /> {episodes.length} segments
          </span>
        )}
      </div>

      {episodesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-28 bg-crimson-950/40 animate-pulse rounded-2xl border border-crimson-900/30" />
          ))}
        </div>
      ) : episodes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {episodes.map((ep) => (
            <EpisodeCard
              key={ep.episode_number}
              ep={ep}
              active={expandedSeason === currentSeason && ep.episode_number === currentEpisode}
              onSelect={() => onSelectEpisode(expandedSeason, ep.episode_number)}
            />
          ))}
        </div>
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

export default EpisodePicker;
