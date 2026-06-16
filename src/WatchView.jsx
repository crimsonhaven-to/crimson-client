import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Info, AlertTriangle, ChevronRight, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from './hooks';
import { stripHtml } from './utils';
import WatchlistButton from './WatchlistButton';

const CrimsonPlayer = lazy(() => import('./CrimsonPlayer'));

// Presentational watch UI shared by the anime watch page (/watch/:anilistId/...)
// and the non-anime show watch page (/watch-show/:tmdbId/...). Both feed it the
// same prop shape; only the data source (useAnimeStreamer vs useShowStreamer) and
// the navigation targets (back link, season/episode handlers) differ in the thin
// wrappers. Extracted from the original WatchPage so anime renders unchanged.
const WatchView = ({
  // playback / sources
  streams = [], streamLoading, activeStreamIdx, onSelectStream,
  poster, playerStartAt, onPlayerProgress,
  // header / info
  metadata, displayTitle, totalSeasons,
  currentSeason, currentEpisode, refLabel,
  // selectors
  availableSeasons = [], onSeasonChange, onEpisodeChange,
  // account
  isAuthenticated, watchlistItem,
  // nav
  backUrl,
}) => {
  const currentEpisodeData = metadata?.episodes_list?.find(e => e.episode_number === currentEpisode);
  const episodeTitle = currentEpisodeData?.title && currentEpisodeData.title !== `Episode ${currentEpisode}`
    ? currentEpisodeData.title
    : null;
  const episodeDescription = currentEpisodeData?.overview
    || metadata?.summary
    || stripHtml(metadata?.description)
    || 'No summary asset provided.';

  const activeStream = !streamLoading ? streams[activeStreamIdx] : null;

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-4 gap-8 sm:gap-10 animate-in fade-in duration-1000">
      {/* Main Video Area */}
      <div className="lg:col-span-3 space-y-8">
        {/* Back to the title's overview page */}
        <Link
          to={backUrl}
          className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 hover:bg-crimson-900/30 transition-all duration-300 text-[11px] font-black uppercase tracking-widest active:scale-95 backdrop-blur-sm shadow-xl"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
          Back to Overview
        </Link>
        <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-crimson-900/60 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
          {streamLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 z-20 p-6 text-center backdrop-blur-md">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
                <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 blur-xl bg-crimson-500/20 rounded-full animate-pulse"></div>
              </div>
              <p className="text-crimson-400 font-black tracking-[0.3em] animate-pulse text-xs uppercase">Resolving manifest vectors</p>
            </div>
          )}
          {activeStream ? (
            activeStream.type === 'iframe' ? (
              (() => {
                const url = activeStream.url;
                // Sandbox iframes we host ourselves (the backend player page, or
                // anything served from our own origin) — those are trusted, so we
                // grant the looser sandbox; third-party embeds get none.
                const sandboxed = typeof url === 'string'
                  && (url.startsWith(API_BASE_URL) || url.startsWith(window.location.origin));
                return (
                  <iframe
                    src={url}
                    title="Stream"
                    className="w-full h-full"
                    sandbox={sandboxed ? "allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock" : undefined}
                    allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                    referrerPolicy="no-referrer"
                    allowFullScreen
                    scrolling="no"
                  />
                );
              })()
            ) : (
              <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
                <CrimsonPlayer
                  key={activeStream.url}
                  src={activeStream.url}
                  type={activeStream.type}
                  subtitles={activeStream.subtitles}
                  poster={poster}
                  title={displayTitle}
                  startAt={playerStartAt}
                  onProgress={onPlayerProgress}
                />
              </Suspense>
            )
          ) : (
            !streamLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-crimson-950/50 backdrop-blur-sm">
                <AlertTriangle className="w-16 h-16 text-crimson-500 mb-4 opacity-50" />
                <p className="text-white font-black uppercase tracking-widest text-sm">No transport nodes active</p>
              </div>
            )
          )}
        </div>

        {/* Info Panel */}
        <div className="p-6 sm:p-10 bg-crimson-950/40 border border-crimson-900/40 rounded-[2.5rem] backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 relative z-10">
            <div className="space-y-6 w-full">
              <div className="flex flex-wrap gap-3 items-center">
                {metadata?.status && (
                  <span className="bg-crimson-500/10 text-crimson-400 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-crimson-500/30 backdrop-blur-md">
                    {metadata.status}
                  </span>
                )}
                <span className="text-[10px] text-crimson-600 font-black tracking-widest uppercase opacity-70">
                  REF: {refLabel || 'UNK'}
                </span>
                {isAuthenticated && watchlistItem && (
                  <div className="ml-auto">
                    <WatchlistButton item={watchlistItem} variant="watch" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white leading-[1.1]">
                  {displayTitle || 'Unknown Cluster'}
                  {totalSeasons > 1 && (
                    <span className="text-xl text-crimson-500 ml-3 opacity-80">S{currentSeason}</span>
                  )}
                </h1>
                {episodeTitle && (
                  <p className="text-base sm:text-xl font-bold text-crimson-400 tracking-tight leading-snug">
                    <span className="text-crimson-600 font-black uppercase text-sm mr-2 opacity-60">E{currentEpisode}</span> {episodeTitle}
                  </p>
                )}
              </div>
              <p className="text-sm sm:text-base text-crimson-100/60 leading-relaxed text-justify line-clamp-4 sm:line-clamp-none font-medium">
                {episodeDescription}
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none bg-crimson-950/80 border border-crimson-900/60 px-6 py-4 rounded-2xl text-center min-w-[90px] shadow-xl">
                <p className="text-[10px] uppercase text-crimson-500 font-black tracking-[0.3em] mb-1">SN</p>
                <p className="text-2xl font-black text-white">{currentSeason}</p>
              </div>
              <div className="flex-1 sm:flex-none bg-crimson-900/20 border border-crimson-800/40 px-6 py-4 rounded-2xl text-center min-w-[90px] shadow-xl">
                <p className="text-[10px] uppercase text-crimson-400 font-black tracking-[0.3em] mb-1">EP</p>
                <p className="text-2xl font-black text-white">{currentEpisode}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Season & Episode Selectors */}
        <div className="space-y-8">
          {availableSeasons && availableSeasons.length > 1 && (
            <div className="p-4 sm:p-5 bg-crimson-950/30 border border-crimson-900/30 rounded-3xl flex items-center gap-4 overflow-x-auto no-scrollbar backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase text-crimson-700 tracking-[0.3em] whitespace-nowrap pl-2">Archives</span>
              <div className="flex gap-2">
                {availableSeasons.map((season) => (
                  <button
                    key={season.season_number}
                    onClick={() => onSeasonChange(season.season_number)}
                    className={`px-5 py-2.5 rounded-xl text-[11px] font-black border transition-all duration-300 whitespace-nowrap uppercase tracking-widest ${
                      currentSeason === season.season_number
                        ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.2)]'
                        : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-400 hover:border-crimson-600 hover:bg-crimson-900/30'
                    }`}
                  >
                    Season {season.season_number}
                  </button>
                ))}
              </div>
            </div>
          )}

          {metadata?.episodes_list && (
            <div className="p-6 sm:p-10 bg-crimson-950/30 border border-crimson-900/30 rounded-[2.5rem] space-y-8 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                  <Info className="w-6 h-6 text-crimson-500" /> Manifest Segments
                </h3>
                <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {metadata.episodes_list.map((ep) => (
                  <button
                    key={ep.episode_number}
                    onClick={() => onEpisodeChange(ep.episode_number)}
                    className={`aspect-square rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-0.5 group/ep ${
                      currentEpisode === ep.episode_number
                        ? 'bg-crimson-600 border-crimson-400 text-white font-black shadow-[0_10px_20px_rgba(255,0,30,0.4)] scale-110 z-10'
                        : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-200 hover:border-crimson-600 hover:bg-crimson-900/30'
                    }`}
                  >
                    <span className={`text-[8px] uppercase font-black tracking-widest opacity-40 group-hover/ep:opacity-100 transition-opacity ${currentEpisode === ep.episode_number ? 'opacity-100' : ''}`}>E</span>
                    <span className="text-lg font-black">{ep.episode_number}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stream Sources Sidebar */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-crimson-950/40 border border-crimson-900/40 p-6 sm:p-8 rounded-[2rem] sticky top-28 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

          <h3 className="text-lg font-black text-white mb-8 flex items-center gap-3 uppercase tracking-tighter relative z-10">
            <div className="relative">
               <div className="w-2.5 h-2.5 rounded-full bg-crimson-500 animate-ping absolute inset-0"></div>
               <div className="w-2.5 h-2.5 rounded-full bg-crimson-600 relative"></div>
            </div>
            Scraped Targets
          </h3>
          <div className="grid grid-cols-1 gap-3 relative z-10">
            {streamLoading && !streams.length ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-crimson-950/40 animate-pulse rounded-2xl border border-crimson-900/30"></div>
              ))
            ) : streams.length > 0 ? (
              streams.map((stream, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectStream(idx)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                    activeStreamIdx === idx
                      ? 'bg-crimson-600 text-white font-black border-crimson-400 shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
                      : 'bg-crimson-950/60 text-crimson-300 border-crimson-900/60 hover:bg-crimson-900/20 hover:border-crimson-600'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1.5 leading-none">
                      <span className={`text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md border ${
                        activeStreamIdx === idx
                          ? 'bg-white/20 border-white/20 text-white'
                          : 'bg-crimson-500/10 border-crimson-500/20 text-crimson-500'
                      }`}>
                        {stream.type}
                      </span>
                      {stream.language && (
                        <span className={`text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md ${
                          activeStreamIdx === idx
                            ? 'bg-crimson-950/40 text-white'
                            : 'bg-crimson-900 text-crimson-400'
                        }`}>
                          {stream.language}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black tracking-wide text-white truncate">
                      {stream.source}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${activeStreamIdx === idx ? 'text-white' : 'text-crimson-800'}`} />
                </button>
              ))
            ) : (
              <div className="col-span-full p-8 bg-crimson-950/80 rounded-2xl text-center border border-dashed border-crimson-900/40">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-800 italic">Zero transport nodes active</p>
              </div>
            )}
          </div>

          {streamLoading && streams.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-2 animate-pulse">
               <div className="w-1.5 h-1.5 bg-crimson-500 rounded-full"></div>
               <span className="text-[8px] font-black uppercase tracking-[0.3em] text-crimson-600">Probing more nodes</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchView;
