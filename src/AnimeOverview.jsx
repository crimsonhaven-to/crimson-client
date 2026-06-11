import { useParams, useNavigate } from 'react-router-dom';
import { Play, AlertTriangle, ArrowLeft, Calendar, Layers, Film, Clapperboard } from 'lucide-react';
import { useAnimeOverview, useTitle } from './hooks';
import { stripHtml } from './utils';

// One episode tile: uses the per-episode metadata (thumbnail, title, air date,
// overview) that the backend already stores but the player page never surfaced.
const EpisodeCard = ({ ep, onSelect }) => {
  const hasTitle = ep.title && ep.title !== `Episode ${ep.episode_number}`;
  return (
    <button
      onClick={onSelect}
      className="group flex gap-3 sm:gap-4 text-left p-2.5 sm:p-3 rounded-xl border border-crimson-900/50 bg-crimson-950/40 hover:bg-crimson-900/20 hover:border-crimson-600 transition-all"
    >
      <div className="relative w-32 sm:w-40 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-crimson-900/40">
        {ep.thumbnail ? (
          <img src={ep.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-crimson-700">
            <Film className="w-6 h-6" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-crimson-950/60 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-7 h-7 text-white fill-white drop-shadow" />
        </div>
        <span className="absolute top-1 left-1 bg-crimson-950/80 text-crimson-300 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">
          E{ep.episode_number}
        </span>
      </div>

      <div className="flex flex-col min-w-0 py-0.5">
        <h4 className="text-sm sm:text-base font-bold text-crimson-100 group-hover:text-crimson-400 transition-colors line-clamp-1">
          {hasTitle ? ep.title : `Episode ${ep.episode_number}`}
        </h4>
        {ep.air_date && (
          <span className="flex items-center gap-1 text-[10px] text-crimson-600 font-bold uppercase tracking-widest mt-0.5">
            <Calendar className="w-3 h-3" /> {ep.air_date}
          </span>
        )}
        {ep.overview && (
          <p className="text-xs text-crimson-200/60 leading-relaxed line-clamp-2 mt-1.5">
            {ep.overview}
          </p>
        )}
      </div>
    </button>
  );
};

const AnimeOverview = () => {
  const { anilistId } = useParams();
  const navigate = useNavigate();
  const {
    overview, loading, error,
    activeSeason, setActiveSeason,
    episodes, episodesLoading,
  } = useAnimeOverview(anilistId);

  useTitle(overview?.title || 'Overview');

  const goToEpisode = (season, episodeNumber) => {
    // The watch page resolves the show from any season's anilist_id (falling back
    // to the show's) + the season number, so this lands on the right episode.
    const watchId = season.anilist_id || overview.anilist_id;
    navigate(`/watch/${watchId}/${season.season_number}/${episodeNumber}`);
  };

  if (loading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Summoning the archives...</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white uppercase">Manifestation Not Found</h2>
          <p className="text-crimson-300 mt-2">{error || 'This anime could not be summoned from the archives.'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-2 bg-crimson-500 hover:bg-crimson-400 text-white font-bold rounded-xl transition-all"
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
    <div className="w-full animate-in fade-in duration-700">
      {/* Hero / backdrop */}
      <div className="relative">
        {overview.backdrop && (
          <div className="absolute inset-0 h-[340px] sm:h-[420px] overflow-hidden pointer-events-none">
            <img src={overview.backdrop} alt="" className="w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-crimson-950/70 to-transparent" />
          </div>
        )}

        <div className="relative max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-crimson-400 hover:text-crimson-300 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            {overview.poster && (
              <img
                src={overview.poster}
                alt={`${overview.title} poster`}
                className="w-36 sm:w-52 h-auto object-cover rounded-2xl border border-crimson-900/60 shadow-2xl flex-shrink-0 mx-auto sm:mx-0"
              />
            )}

            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {overview.status && (
                  <span className="bg-crimson-500/20 text-crimson-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-crimson-500/30">
                    {overview.status}
                  </span>
                )}
                {overview.year && (
                  <span className="flex items-center gap-1 text-[10px] text-crimson-400/80 font-bold uppercase tracking-widest">
                    <Calendar className="w-3 h-3" /> {overview.year}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] text-crimson-400/80 font-bold uppercase tracking-widest">
                  <Layers className="w-3 h-3" /> {overview.total_seasons} Season{overview.total_seasons === 1 ? '' : 's'}
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight drop-shadow-[0_4px_12px_rgba(255,0,60,0.15)]">
                {overview.title}
              </h1>
              {overview.title_romaji && overview.title_romaji !== overview.title && (
                <p className="text-sm text-crimson-400/70 font-medium -mt-2">{overview.title_romaji}</p>
              )}

              {synopsis && (
                <p className="text-xs sm:text-sm text-crimson-200/70 leading-relaxed text-justify max-w-3xl line-clamp-5">
                  {synopsis}
                </p>
              )}

              {currentSeason && (
                <button
                  onClick={() => goToEpisode(currentSeason, 1)}
                  className="inline-flex items-center gap-2 bg-crimson-500 hover:bg-crimson-400 text-white font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(255,0,60,0.3)]"
                >
                  <Play className="w-4 h-4 fill-white" /> Start Watching
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Seasons + episodes */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Season tabs */}
        {seasons.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] font-bold uppercase text-crimson-500 tracking-wider whitespace-nowrap">Seasons:</span>
            <div className="flex gap-1.5">
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  onClick={() => setActiveSeason(s.season_number)}
                  title={s.name}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all whitespace-nowrap ${
                    activeSeason === s.season_number
                      ? 'bg-crimson-500 border-crimson-400 text-white'
                      : 'bg-crimson-900/20 border-crimson-900/50 text-crimson-300 hover:border-crimson-700'
                  }`}
                >
                  S{s.season_number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active season header */}
        {currentSeason && (
          <div className="flex items-baseline justify-between gap-4 border-b border-crimson-900/50 pb-3">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              {currentSeason.name || `Season ${currentSeason.season_number}`}
            </h2>
            <span className="text-[10px] font-mono text-crimson-600 font-bold uppercase tracking-widest whitespace-nowrap">
              {episodes.length || currentSeason.episode_count || 0} episodes
            </span>
          </div>
        )}

        {/* Episode list */}
        {episodesLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-24 bg-crimson-900/10 animate-pulse rounded-xl border border-crimson-900/30" />
            ))}
          </div>
        ) : episodes.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {episodes.map((ep) => (
              <EpisodeCard
                key={ep.episode_number}
                ep={ep}
                onSelect={() => goToEpisode(currentSeason, ep.episode_number)}
              />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-crimson-500 italic">No episode data available for this season.</p>
        )}

        {/* Extras: specials / OVAs / movies */}
        {extras.length > 0 && (
          <div className="space-y-4 pt-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-crimson-500" /> Specials &amp; Movies
              </h3>
              <div className="h-px bg-crimson-900/30 flex-grow" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {extras.map((x) => (
                <button
                  key={x.anilist_id}
                  onClick={() => navigate(`/watch/${x.anilist_id}/1/1`)}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-crimson-900/50 bg-crimson-950/40 hover:bg-crimson-900/20 hover:border-crimson-600 transition-all text-left group"
                >
                  <div className="flex flex-col truncate">
                    <span className="text-sm font-bold text-crimson-100 group-hover:text-crimson-400 transition-colors truncate">
                      {x.title_english || x.title_romaji || `Entry ${x.anilist_id}`}
                    </span>
                    <span className="text-[9px] text-crimson-600 font-black uppercase tracking-widest mt-0.5">
                      {x.anime_type || 'Special'}{x.start_year ? ` • ${x.start_year}` : ''}
                    </span>
                  </div>
                  <Play className="w-4 h-4 text-crimson-800 group-hover:text-crimson-500 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimeOverview;
