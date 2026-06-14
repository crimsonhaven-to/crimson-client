import { useState } from 'react';
import { Play, AlertTriangle, ArrowLeft, Calendar, Layers, Film, Clapperboard, Heart } from 'lucide-react';
import { stripHtml } from './utils';

// Presentational overview UI shared by the anime Overview (/anime/:anilistId) and
// the non-anime show Overview (/show/:tmdbId). It is purely props-driven — the two
// pages differ only in their data source (useAnimeOverview vs useShowOverview) and
// where the play buttons navigate (onPlayEpisode / onPlayExtra), so the look and
// feel stays identical across both. Extracted from the original AnimeOverview so
// the anime path renders byte-for-byte the same as before.

// One episode tile: uses the per-episode metadata (thumbnail, title, air date,
// overview) that the backend already stores.
const EpisodeCard = ({ ep, onSelect }) => {
  const hasTitle = ep.title && ep.title !== `Episode ${ep.episode_number}`;
  return (
    <button
      onClick={onSelect}
      className="group flex gap-3 sm:gap-4 text-left p-2.5 sm:p-3 rounded-2xl border border-crimson-900/40 bg-crimson-950/30 backdrop-blur-md hover:bg-crimson-900/20 hover:border-crimson-500/50 hover:shadow-[0_0_20px_rgba(255,0,60,0.1)] transition-all duration-300"
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
      </div>

      <div className="flex flex-col min-w-0 py-1">
        <h4 className="text-sm sm:text-base font-bold text-crimson-50 group-hover:text-crimson-400 transition-colors line-clamp-1 tracking-tight">
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

// `notFoundText` lets the show page say "show" where the anime page says "anime".
// `onPlayEpisode(season, episodeNumber)` and `onPlayExtra(extra)` are supplied by
// the wrapper so navigation targets the right (anilist vs tmdb) watch route.
const OverviewView = ({
  overview, loading, error,
  activeSeason, setActiveSeason,
  episodes, episodesLoading,
  onBack, onPlayEpisode, onPlayExtra,
  isFavorite, onToggleFavorite,
  notFoundText = 'This title could not be summoned from the archives.',
}) => {
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  if (loading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-32 flex flex-col items-center justify-center space-y-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
          <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 blur-lg bg-crimson-500/20 rounded-full animate-pulse"></div>
        </div>
        <p className="text-crimson-500 font-black animate-pulse tracking-[0.3em] uppercase text-xs">Summoning the archives</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center">
        <div className="bg-crimson-950/50 backdrop-blur-xl border border-crimson-900/50 p-12 rounded-3xl shadow-2xl">
          <AlertTriangle className="w-16 h-16 text-crimson-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Manifestation Not Found</h2>
          <p className="text-crimson-400 mt-4 font-medium max-w-sm mx-auto">{error || notFoundText}</p>
          <button
            onClick={onBack}
            className="mt-8 px-8 py-3 bg-crimson-600 hover:bg-crimson-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-[0_10px_20px_rgba(255,0,60,0.2)] hover:shadow-[0_10px_25px_rgba(255,0,60,0.4)]"
          >
            Return to the Haven
          </button>
        </div>
      </div>
    );
  }

  const seasons = overview.seasons || [];
  const extras = overview.extras || [];
  const synopsis = stripHtml(overview.description) || overview.summary;
  const currentSeason = seasons.find(s => s.season_number === activeSeason);

  return (
    <div className="w-full animate-in fade-in duration-1000">
      {/* Hero / Backdrop Section */}
      <div className="relative min-h-[500px] sm:min-h-[600px] flex flex-col">
        {overview.backdrop && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img src={overview.backdrop} alt="" className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-crimson-950/20 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-crimson-950/80 via-crimson-950/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-crimson-950 to-transparent" />
          </div>
        )}

        <div className="relative max-w-7xl w-full mx-auto px-6 pt-12 sm:pt-20 pb-24 sm:pb-32 flex-grow">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500 hover:text-crimson-400 transition-all mb-10"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
          </button>

          <div className="flex flex-col md:flex-row gap-10 lg:gap-14 items-center md:items-start text-center md:text-left">
            {overview.poster && (
              <div className="relative group flex-shrink-0">
                <div className="absolute -inset-1 bg-crimson-500/20 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <img
                  src={overview.poster}
                  alt={`${overview.title} poster`}
                  className="relative w-44 sm:w-64 h-auto object-cover rounded-2xl border border-crimson-800/40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
            )}

            <div className="flex-1 space-y-6">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                {overview.status && (
                  <span className="bg-crimson-500/10 backdrop-blur-md text-crimson-400 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-crimson-500/30">
                    {overview.status}
                  </span>
                )}
                {overview.year && (
                  <span className="flex items-center gap-1.5 text-[10px] text-crimson-300 font-black uppercase tracking-widest opacity-70">
                    <Calendar className="w-3.5 h-3.5 text-crimson-500" /> {overview.year}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[10px] text-crimson-300 font-black uppercase tracking-widest opacity-70">
                  <Layers className="w-3.5 h-3.5 text-crimson-500" /> {overview.total_seasons} Season{overview.total_seasons === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-white leading-[0.9] drop-shadow-[0_10px_30px_rgba(255,0,60,0.2)]">
                  {overview.title}
                </h1>
                {overview.title_romaji && overview.title_romaji !== overview.title && (
                  <p className="text-sm sm:text-lg text-crimson-400/60 font-bold tracking-tight italic opacity-80">{overview.title_romaji}</p>
                )}
              </div>

              {synopsis && (
                <div className="max-w-3xl">
                  <p className={`text-sm sm:text-base text-crimson-100/70 leading-relaxed text-justify font-medium ${synopsisExpanded ? '' : 'line-clamp-4 md:line-clamp-6'}`}>
                    {synopsis}
                  </p>
                  {synopsis.length > 280 && (
                    <button
                      onClick={() => setSynopsisExpanded(v => !v)}
                      className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500 hover:text-crimson-400 transition-colors"
                    >
                      {synopsisExpanded ? 'Show Less' : 'Read More'}
                    </button>
                  )}
                </div>
              )}

              {(currentSeason || onToggleFavorite) && (
                <div className="pt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
                  {currentSeason && (
                    <button
                      onClick={() => onPlayEpisode(currentSeason, 1)}
                      className="group relative inline-flex items-center gap-3 bg-crimson-500 hover:bg-crimson-400 text-white font-black uppercase tracking-[0.2em] text-xs px-8 py-4 rounded-2xl transition-all shadow-[0_15px_30px_rgba(255,0,60,0.3)] hover:shadow-[0_15px_40px_rgba(255,0,60,0.5)] active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Watching</span>
                      <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                  )}
                  {onToggleFavorite && (
                    <button
                      onClick={onToggleFavorite}
                      aria-pressed={isFavorite}
                      className={`group inline-flex items-center gap-3 font-black uppercase tracking-[0.2em] text-xs px-8 py-4 rounded-2xl border transition-all active:scale-95 ${
                        isFavorite
                          ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_15px_30px_rgba(255,0,60,0.3)] hover:bg-crimson-500'
                          : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-300 hover:text-white hover:border-crimson-600 hover:bg-crimson-900/30 backdrop-blur-sm'
                      }`}
                    >
                      <Heart className={`w-4 h-4 transition-transform group-hover:scale-110 ${isFavorite ? 'fill-white' : ''}`} />
                      <span>{isFavorite ? 'Saved to Favorites' : 'Save to Favorites'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Seasons + Episodes */}
      <div className="relative -mt-10 sm:-mt-20 z-10 max-w-7xl w-full mx-auto px-6 pb-20 space-y-12">
        {/* Season Navigation */}
        {seasons.length > 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase text-crimson-500 tracking-[0.3em] whitespace-nowrap">Archives</span>
              <div className="h-px flex-grow bg-gradient-to-r from-crimson-900/50 to-transparent"></div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  onClick={() => setActiveSeason(s.season_number)}
                  className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all duration-300 whitespace-nowrap ${
                    activeSeason === s.season_number
                      ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_8px_15px_rgba(255,0,60,0.2)]'
                      : 'bg-crimson-950/40 border-crimson-900/40 text-crimson-400 hover:border-crimson-600 hover:bg-crimson-900/20'
                  }`}
                >
                  Season {s.season_number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Episodes Section */}
        <div className="space-y-6">
          {currentSeason && (
            <div className="flex items-end justify-between gap-4 border-b border-crimson-900/30 pb-4">
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tighter">
                  {currentSeason.name || `Season ${currentSeason.season_number}`}
                </h2>
                <div className="flex items-center gap-2 text-[10px] text-crimson-500 font-black uppercase tracking-widest opacity-70">
                  <Film className="w-3 h-3" />
                  <span>{episodes.length || currentSeason.episode_count || 0} manifest segments</span>
                </div>
              </div>
            </div>
          )}

          {episodesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="h-28 bg-crimson-950/30 animate-pulse rounded-2xl border border-crimson-900/20" />
              ))}
            </div>
          ) : episodes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {episodes.map((ep) => (
                <EpisodeCard
                  key={ep.episode_number}
                  ep={ep}
                  onSelect={() => onPlayEpisode(currentSeason, ep.episode_number)}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-12 h-12 border-2 border-dashed border-crimson-900/50 rounded-full mx-auto flex items-center justify-center">
                <Film className="w-6 h-6 text-crimson-900" />
              </div>
              <p className="text-crimson-600 font-bold uppercase tracking-widest text-[10px] italic">No segment data recorded for this season.</p>
            </div>
          )}
        </div>

        {/* Extras / Specials Section (anime only — shows pass an empty list) */}
        {extras.length > 0 && (
          <div className="space-y-6 pt-10">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                <Clapperboard className="w-6 h-6 text-crimson-500" /> Specials &amp; Movies
              </h3>
              <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {extras.map((x) => (
                <button
                  key={x.anilist_id}
                  onClick={() => onPlayExtra(x)}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-crimson-900/40 bg-crimson-950/30 backdrop-blur-md hover:bg-crimson-900/20 hover:border-crimson-500/50 hover:shadow-[0_8px_20px_rgba(255,0,60,0.1)] transition-all group"
                >
                  <div className="flex flex-col truncate">
                    <span className="text-sm font-black text-crimson-50 group-hover:text-crimson-400 transition-colors truncate">
                      {x.title_english || x.title_romaji || `Entry ${x.anilist_id}`}
                    </span>
                    <span className="text-[9px] text-crimson-600 font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-crimson-500"></div>
                      {x.anime_type || 'Special'}{x.start_year ? ` • ${x.start_year}` : ''}
                    </span>
                  </div>
                  <div className="p-2 rounded-full bg-crimson-900/20 group-hover:bg-crimson-500 transition-colors">
                    <Play className="w-3.5 h-3.5 text-crimson-500 group-hover:text-white group-hover:fill-white transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewView;
