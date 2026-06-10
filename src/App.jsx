import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Search, Play, HelpCircle, Film, Info, AlertTriangle, ChevronRight, Server, Hash, Menu, X, Heart, History, User, Coffee, Sparkles } from 'lucide-react';
import Background from './assets/background.jpg';
import { useAnimeStreamer, useTrendingAnime, useHealthStatus, useAuth, useAccount, useTitle, API_BASE_URL } from './hooks';
import NotFound from './NotFound';
import CataloguePage from './Catalogue';
import AccountPage from './Account';
import FavoritesPage from './Favorites';
import RecentlyWatchedPage from './RecentlyWatched';
import SupportUsPage from './SupportUs';
import SupportersPage from './Supporters';
import CrimsonPlayer from './CrimsonPlayer';

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.059 1.689.073 4.948.073 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.22 8.22 0 0 0 4.82 1.55V6.79a4.85 4.85 0 0 1-1.05-.1z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.97 0 1.754.784 1.754 1.754 0 .716-.435 1.333-1.056 1.597.011.198.017.397.017.597 0 3.042-3.508 5.508-7.835 5.508-4.327 0-7.835-2.466-7.835-5.508 0-.2.006-.399.017-.597a1.734 1.734 0 0 1-1.056-1.597c0-.97.784-1.754 1.754-1.754.477 0 .899.182 1.207.491 1.194-.856 2.85-1.419 4.674-1.488l.82-3.818a.125.125 0 0 1 .15-.097l2.876.605c.062-.25.298-.434.577-.434zm-8.244 9.396c-.693 0-1.256.563-1.256 1.256s.563 1.256 1.256 1.256c.693 0 1.256-.563 1.256-1.256s-.563-1.256-1.256-1.256zm6.468 0c-.693 0-1.256.563-1.256 1.256s.563 1.256 1.256 1.256c.693 0 1.256-.563 1.256-1.256s-.563-1.256-1.256-1.256zm-6.468 4.23a.322.322 0 0 0-.226.55c.73.73 2.033 1.149 3.468 1.149 1.435 0 2.738-.42 3.468-1.149a.322.322 0 1 0-.456-.456c-.529.528-1.582.904-3.012.904-1.43 0-2.483-.376-3.012-.904a.322.322 0 0 0-.226-.094z"/>
  </svg>
);

const AnimeCard = ({ title, poster, onSelect }) => (

  <div 
    className="flex items-center justify-between p-3 cursor-pointer hover:bg-crimson-900/20 transition-colors border-b border-crimson-900/50" 
    onMouseDown={onSelect}
  >
    <div className="flex items-center gap-3">
      {poster ? (
        <img src={poster} alt="" className="w-12 h-auto object-cover rounded shadow-lg flex-shrink-0" />
      ) : (
        <div className="w-12 h-16 bg-crimson-900/30 flex items-center justify-center text-sm text-crimson-400">
          No Poster
        </div>
      )}
      <span className="text-base font-semibold text-crimson-300 truncate max-w-[240px]">{title}</span>
    </div>
    <ChevronRight className="w-4 h-4 text-crimson-700" />
  </div>
);

// ---------- Landing Page Component ----------
function LandingPage() {
  const navigate = useNavigate();
  useTitle('Search Home');
  const {
    queryName, setQueryName,
    searchResults, showSuggestions, setShowSuggestions,
    metaLoading, apiError, setApiError,
    handleSelectSuggestion
  } = useAnimeStreamer();

  const { trendingAnimes, trendLoading } = useTrendingAnime();

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!queryName.trim()) return;
    if (searchResults.length > 0) {
      await handleSelectSuggestion(searchResults[0], (anilistId, season, episode) => {
        navigate(`/watch/${anilistId}/${season}/${episode}`);
      });
    } else {
      setApiError('Please choose a valid choice from the loading results dropdown.');
    }
  };

  return (
    <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center space-y-8 my-auto">
      <div className="space-y-3">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_4px_12px_rgba(255,0,60,0.15)]">
          crimson<span className="text-crimson-500 font-light">haven</span>
        </h1>
        <p className="text-crimson-300 text-base sm:text-lg tracking-wide font-medium px-4">
          Stream dynamic links seamlessly straight from the dark network.
        </p>
      </div>

      <div className="relative max-w-xl mx-auto group px-2 sm:px-0">
        <form onSubmit={handleSearchSubmit} className="flex items-end space-x-2 border-2 border-crimson-900/80 rounded-2xl shadow-2xl bg-crimson-900/30 transition-all">
          <input 
            type="text" 
            placeholder="Search Anime Name..." 
            value={queryName} 
            onFocus={() => { if (queryName.length >= 3) setShowSuggestions(true); }} 
            onChange={(e) => { setQueryName(e.target.value); if (e.target.value.length >= 3) setShowSuggestions(true); }} 
            onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }} 
            className="w-full py-3.5 sm:py-4 px-4 sm:px-5 focus:outline-none font-bold tracking-wide appearance-none bg-transparent text-red-300 placeholder-red-400/50 text-sm sm:text-base"
            style={{ textShadow: '0 0 3px rgba(248,113,113,0.25)' }}
          />
          <button 
            type="submit" 
            disabled={metaLoading} 
            className="bg-crimson-500 hover:bg-crimson-400 disabled:bg-crimson-800 text-white px-5 sm:px-6 py-[14px] sm:py-[18px] rounded-r-2xl transition-all shadow-md flex items-center justify-center self-stretch"
          >
            {metaLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </form>

        {showSuggestions && (
          <div className="absolute top-full left-2 right-2 sm:left-0 sm:right-0 mt-1 bg-crimson-950 border border-crimson-800 shadow-xl max-h-[300px] overflow-y-auto z-20 text-left rounded-xl">
            {searchResults.length > 0 ? (
              searchResults.map((suggestion, index) => (
                <AnimeCard 
                  key={index} 
                  title={suggestion.title || suggestion.name} 
                  poster={suggestion.poster || null} 
                  onSelect={() => handleSelectSuggestion(suggestion, (anilistId, season, episode) => {
                    navigate(`/watch/${anilistId}/${season}/${episode}`);
                  })}
                />
              ))
            ) : (
              <div className="p-4 text-sm text-crimson-400 text-center italic">
                No tracked anime found matching that title.
              </div>
            )}
          </div>
        )}
      </div>

      {apiError && (
        <div className="max-w-md mx-auto p-4 bg-crimson-900/40 border border-crimson-500/30 rounded-xl text-xs sm:text-sm text-crimson-300 flex items-center gap-3 shadow-lg mt-8">
          <AlertTriangle className="w-5 h-5 text-crimson-500 shrink-0" />
          <span className="text-left">Status Message: {apiError}</span>
        </div>
      )}

      <div className="mt-12 sm:mt-16 pt-8 border-t border-crimson-900/50">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase mb-6 flex items-center gap-2 justify-center sm:justify-start">
          <Play className="w-5 h-5 sm:w-6 sm:h-6 text-crimson-500" /> Trending Streams 
        </h2>

        {trendLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 animate-pulse">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="aspect-[2/3] bg-gray-700/30 rounded-lg border border-dashed border-crimson-900/50"></div>
            ))}
          </div>
        )}

        {!trendLoading && trendingAnimes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {trendingAnimes.map((anime, index) => (
              <div 
                key={index} 
                onClick={() => handleSelectSuggestion(anime, (anilistId, season, episode) => {
                  navigate(`/watch/${anilistId}/${season}/${episode}`);
                })}
                className="bg-crimson-900/10 border border-crimson-900/40 rounded-xl overflow-hidden hover:border-crimson-500 transition-all group cursor-pointer transform hover:-translate-y-1 active:scale-95 sm:active:scale-100"
              >
                <img src={anime.poster} alt={`${anime.title} poster`} className="w-full h-auto object-cover" />
                <div className="p-2 sm:p-3 text-left">
                  <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 group-hover:text-crimson-400 transition-colors">
                    {anime.title}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Watch Page Component ----------
function WatchPage() {
  const { anilistId, season = '1', episode = '1' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const progressTimerRef = useRef(null);
  // Latest real playback position from CrimsonPlayer (same-origin hls/mp4 sources
  // only — opaque third-party iframes can't report it). Null until a frame plays.
  const playbackRef = useRef(null);
  const handlePlayerProgress = useCallback((position, duration) => {
    playbackRef.current = { position, duration };
  }, []);

  const {
    animeMetadata, streamData,
    metaLoading, streamLoading, apiError,
    availableSeasons, seasonGroups,
    currentSeason, setCurrentSeason,
    currentEpisode, setCurrentEpisode,
    activeStreamIdx, setActiveStreamIdx,
    initializeFromIds
  } = useAnimeStreamer({ initialAnilistId: anilistId, initialSeason: parseInt(season), initialEpisode: parseInt(episode) });

  const { favorites, toggleFavorite, updateProgress } = useAccount();
  const { isAuthenticated } = useAuth();
  
  useTitle(animeMetadata?.title ? `Watch ${animeMetadata.title}` : 'Streaming Manifestation');

  const isFavorite = favorites.some(f => f.anilist_id === parseInt(anilistId) || String(f.tmdb_id) === String(animeMetadata?.tmdb_id));

  // Re-initialize if URL params change (e.g., manual edit)
  useEffect(() => {
    if (anilistId) {
      initializeFromIds(anilistId, parseInt(season), parseInt(episode));
    }
  }, [anilistId, season, episode, initializeFromIds]);

  // Track progress after 30 seconds of being on the page
  useEffect(() => {
    if (!isAuthenticated || !animeMetadata) return;

    // New episode/season: drop any position carried over from the previous one
    // so we don't save a stale timestamp against the wrong episode.
    playbackRef.current = null;

    // Reset timer on episode change
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);

    progressTimerRef.current = setTimeout(() => {
      // Use the real playback position when the active source is the in-app
      // CrimsonPlayer (hls/mp4); fall back to a nominal value for opaque iframes.
      const pb = playbackRef.current;
      updateProgress({
        tmdb_id: animeMetadata.tmdb_id,
        anilist_id: parseInt(anilistId),
        season_number: parseInt(currentSeason),
        episode_number: parseInt(currentEpisode),
        title: animeMetadata.title,
        poster: animeMetadata.poster,
        position_seconds: pb ? Math.round(pb.position) : 30,
        duration_seconds: pb && pb.duration ? Math.round(pb.duration) : 1440,
        status: 'watching'
      });
    }, 30000);

    return () => clearTimeout(progressTimerRef.current);
  }, [anilistId, currentSeason, currentEpisode, animeMetadata, isAuthenticated, updateProgress]);

  // Update URL when season changes
  const handleSeasonChange = (newSeason) => {
    setCurrentSeason(newSeason);
    navigate(`/watch/${anilistId}/${newSeason}/${currentEpisode}`);
  };

  // Update URL when episode changes
  const handleEpisodeChange = (newEpisode) => {
    setCurrentEpisode(newEpisode);
    navigate(`/watch/${anilistId}/${currentSeason}/${newEpisode}`);
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 animate-in fade-in duration-700">
      {/* Main Video Area */}
      <div className="lg:col-span-3 space-y-6">
        <div className="relative aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-crimson-900/80 shadow-[0_0_40px_rgba(26,0,5,0.6)] sm:shadow-[0_0_60px_rgba(26,0,5,0.8)]">
          {streamLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950 z-20 p-4 text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-crimson-400 font-bold tracking-wide animate-pulse text-sm sm:text-base">Resolving manifest vectors...</p>
            </div>
          )}
          {!streamLoading && streamData?.streams?.[activeStreamIdx] ? (
            streamData.streams[activeStreamIdx].type === 'iframe' ? (
              // Sandbox our own backend-served, ad-free proxy / player pages
              // (same-origin): allow-scripts + allow-same-origin let them run while
              // OMITTING allow-popups / allow-top-navigation kills any pop-under /
              // ad-redirect. Two exceptions are left unsandboxed because their
              // player breaks inside the sandbox: the VidKing proxy (/vidking_proxy,
              // the VidKing SPA player) and genuinely third-party embeds (Direct
              // Embed). We don't control those, and VidKing is already ad-stripped
              // server-side by the proxy.
              (() => {
                const url = streamData.streams[activeStreamIdx].url;
                const sandboxed = typeof url === 'string'
                  && url.startsWith(API_BASE_URL)
                  && !url.includes('/vidking_proxy');
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
              // Direct hls/mp4 streams play in the Haven's own branded player.
              <CrimsonPlayer
                key={streamData.streams[activeStreamIdx].url}
                src={streamData.streams[activeStreamIdx].url}
                type={streamData.streams[activeStreamIdx].type}
                poster={animeMetadata?.poster}
                title={animeMetadata?.title}
                onProgress={handlePlayerProgress}
              />
            )
          ) : (
            !streamLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-crimson-500 mb-2" />
                <p className="text-white font-bold text-sm sm:text-base">No stream links scraped</p>
              </div>
            )
          )}
        </div>

        {/* Anime Info Panel */}
        <div className="p-4 sm:p-6 bg-crimson-900/10 border border-crimson-900/40 rounded-xl sm:rounded-2xl backdrop-blur-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 relative z-10">
            <div className="space-y-3 w-full">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="bg-crimson-500/20 text-crimson-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-crimson-500/30">
                  {animeMetadata?.status || 'Synchronized'}
                </span>
                <span className="text-[10px] text-crimson-400/80 font-mono">
                  Ref: {animeMetadata?.anilist_id}
                </span>
                {isAuthenticated && (
                  <button 
                    onClick={() => toggleFavorite({ ...animeMetadata, anilist_id: parseInt(anilistId) })}
                    className={`ml-auto flex items-center gap-2 px-3 py-1 rounded-lg border transition-all text-[10px] font-black uppercase tracking-widest ${
                      isFavorite 
                        ? 'bg-crimson-500 border-crimson-400 text-white' 
                        : 'bg-crimson-900/20 border-crimson-900 text-crimson-400 hover:text-white hover:border-crimson-700'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} />
                    {isFavorite ? 'Saved' : 'Save'}
                  </button>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                {seasonGroups?.title || animeMetadata?.title || 'Unknown Cluster Title'}
                {seasonGroups?.totalSeasons > 1 && (
                  <span className="text-lg text-crimson-400 ml-2">(S{currentSeason})</span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-crimson-200/70 leading-relaxed text-justify line-clamp-4 sm:line-clamp-none">
                {animeMetadata?.summary || 'No summary asset provided.'}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none bg-crimson-950/60 border border-crimson-900/60 px-4 py-2 rounded-xl text-center min-w-[70px]">
                <p className="text-[9px] uppercase text-crimson-500 font-extrabold tracking-widest">S</p>
                <p className="text-lg font-black text-white">{currentSeason}</p>
              </div>
              <div className="flex-1 sm:flex-none bg-crimson-900/40 border border-crimson-800/40 px-4 py-2 rounded-xl text-center min-w-[70px]">
                <p className="text-[9px] uppercase text-crimson-400 font-extrabold tracking-widest">E</p>
                <p className="text-lg font-black text-white">{currentEpisode}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Season & Episode Selectors */}
        <div className="space-y-4">
          {availableSeasons && availableSeasons.length > 0 && (
            <div className="p-3 sm:p-4 bg-crimson-950/40 border border-crimson-900/40 rounded-xl sm:rounded-2xl flex items-center gap-3 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold uppercase text-crimson-500 tracking-wider whitespace-nowrap">Seasons:</span>
              <div className="flex gap-1.5">
                {availableSeasons.map((season) => (
                  <button 
                    key={season.season_number} 
                    onClick={() => handleSeasonChange(season.season_number)} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all whitespace-nowrap ${
                      currentSeason === season.season_number 
                        ? 'bg-crimson-500 border-crimson-400 text-white' 
                        : 'bg-crimson-900/20 border-crimson-900/50 text-crimson-300 hover:border-crimson-700'
                    }`}
                  >
                    S{season.season_number}
                  </button>
                ))}
              </div>
            </div>
          )}

          {animeMetadata?.episodes_list && (
            <div className="p-4 sm:p-6 bg-crimson-900/10 border border-crimson-900/40 rounded-xl sm:rounded-2xl space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                <Info className="w-5 h-5 text-crimson-500" /> Episode Index
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {animeMetadata.episodes_list.map((ep) => (
                  <button 
                    key={ep.episode_number} 
                    onClick={() => handleEpisodeChange(ep.episode_number)} 
                    className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      currentEpisode === ep.episode_number 
                        ? 'bg-crimson-500 border-crimson-400 text-white font-bold shadow-[0_4px_12px_rgba(255,0,30,0.3)] shadow-[0_4px_12px_rgba(255,0,30,0.3)] scale-105' 
                        : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-200 hover:border-crimson-700 hover:bg-crimson-900/20'
                    }`}
                  >
                    <span className="text-[8px] uppercase font-bold opacity-60">E</span>
                    <span className="text-base font-black">{ep.episode_number}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stream Sources Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-crimson-900/20 border border-crimson-900/50 p-4 sm:p-6 rounded-xl sm:rounded-2xl sticky top-24">
          <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-crimson-500 animate-ping" /> Scraped Targets
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {streamLoading ? (
              [1, 2].map((n) => (
                <div key={n} className="h-12 bg-crimson-900/10 animate-pulse rounded-xl border border-crimson-900/20"></div>
              ))
            ) : streamData?.streams && streamData.streams.length > 0 ? (
              streamData.streams.map((stream, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setActiveStreamIdx(idx)} 
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                    activeStreamIdx === idx 
                      ? 'bg-crimson-500 text-white font-bold border-crimson-400 shadow-[0_4px_12px_rgba(255,0,60,0.2)]' 
                      : 'bg-crimson-950/60 text-crimson-300 border-crimson-900/60 hover:bg-crimson-900/20 hover:border-crimson-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1 leading-none">
                      <span className="text-[9px] uppercase tracking-wider opacity-70 font-bold">Type: {stream.type}</span>
                      {stream.language && (
                        <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full ${
                          activeStreamIdx === idx
                            ? 'bg-white/20 text-white'
                            : 'bg-crimson-500/15 text-crimson-300'
                        }`}>
                          {stream.language}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-extrabold tracking-wide text-white truncate max-w-[140px] sm:max-w-none lg:max-w-[160px]">
                      {stream.source}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${activeStreamIdx === idx ? 'text-white' : 'text-crimson-700'}`} />
                </button>
              ))
            ) : (
              <div className="col-span-full p-4 bg-crimson-950/80 rounded-xl text-center border border-crimson-900/40 text-[10px] text-crimson-400/80 italic">
                Zero transport nodes active.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- About Page Component ----------
const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/crimsonhaven-to', icon: <GithubIcon /> },
  { label: 'Reddit', href: 'https://www.reddit.com/r/crimsonhaven/', icon: <RedditIcon /> },
  { label: 'Discord', href: 'https://discord.crimsonhaven.to', icon: <DiscordIcon /> },
  { label: 'Instagram', href: 'https://www.instagram.com/crimsonhaven.to/', icon: <InstagramIcon /> },
  { label: 'TikTok', href: 'https://www.tiktok.com/@crimsonhaven.to', icon: <TikTokIcon /> },
];

function AboutPage() {
  const { health, healthLoading, healthError } = useHealthStatus();
  useTitle('About the Haven');

  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-12 space-y-8 my-auto">
      <div className="border-b border-crimson-900 pb-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">About CrimsonHaven</h2>
        <p className="text-sm text-crimson-400 font-medium">The architectural design manifest.</p>
      </div>

      <div className="space-y-4 text-sm text-crimson-200/80 leading-relaxed text-justify">
        <p><strong className="text-white">crimsonhaven</strong> is a performance-optimized high-fidelity user application frame.</p>
        <div className="bg-crimson-950/50 backdrop-blur-md border border-crimson-900/50 p-4 rounded-xl font-mono text-xs text-crimson-300 space-y-1">
          <p className="font-bold text-white mb-1">// System Specification Diagnostics</p>
          <p>• Client Layer: React 18 / Vite / Tailwind CSS</p>
          <p>• Server Routing Pipeline: Python / FastAPI Asynchronous Engine</p>
          <p>• Multi-Season Support: Season grouping with automatic AniList ID mapping</p>
        </div>

        <div className="relative bg-crimson-950/40 backdrop-blur-md border border-crimson-900/50 p-4 pl-5 rounded-xl">
          <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-crimson-500/60" />
          <p className="italic text-crimson-200/90 leading-relaxed">
            And a little secret between us, darling~ Ironically, this totally <span className="text-white not-italic font-semibold">morally correct</span> webpage
            keeps all your data tucked away in <span className="text-white not-italic font-semibold">Switzerland</span>. Funny, isn't it?~
          </p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-crimson-500">— Luminas, the Vampire Queen</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-crimson-500 uppercase tracking-widest">Find Us</h3>
        <div className="flex flex-wrap gap-3">
          {SOCIAL_LINKS.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-crimson-950/50 backdrop-blur-sm border border-crimson-900/60 rounded-xl text-crimson-300 hover:text-white hover:border-crimson-500 hover:bg-crimson-900/60 transition-all text-sm font-semibold"
            >
              {icon}
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-crimson-500 uppercase tracking-widest flex items-center gap-2">
          <Server className="w-4 h-4" /> Backend Status
        </h3>
        <div className="bg-crimson-950/50 backdrop-blur-md border border-crimson-900/50 p-4 rounded-xl font-mono text-xs space-y-1.5">
          {healthLoading && (
            <p className="text-crimson-400 animate-pulse">Probing system nodes...</p>
          )}
          {healthError && (
            <p className="text-crimson-500">• Error: {healthError}</p>
          )}
          {health && Object.entries(health).map(([key, value]) => (
            <p key={key} className="text-crimson-300">
              <span className="text-crimson-500">•</span> {key}:{' '}
              <span className="text-white">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Main App Component ----------
function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: "/", label: "Search Home", icon: <Film className="w-4 h-4" /> },
    { to: "/catalogue", label: "Catalogue", icon: <Hash className="w-4 h-4" /> },
    { to: "/favorites", label: "Favorites", icon: <Heart className="w-4 h-4" />, auth: true },
    { to: "/recently-watched", label: "History", icon: <History className="w-4 h-4" />, auth: true },
    { to: "/support", label: "Support Us", icon: <Coffee className="w-4 h-4" /> },
    { to: "/supporters", label: "Mortals", icon: <Sparkles className="w-4 h-4" /> },
    { to: "/about", label: "About Us", icon: <HelpCircle className="w-4 h-4" /> },
    { to: "/account", label: isAuthenticated ? "Profile" : "Link Account", icon: <User className="w-4 h-4" />, highlight: !isAuthenticated },
  ];

  return (
    <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans selection:bg-crimson-500 selection:text-white flex flex-col justify-between relative overflow-x-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <img src={Background} alt="background wallpaper" className="w-full h-full object-cover opacity-50 wallpaper-img" />
      </div>

      {/* Navigation Bar */}
      <nav className="border-b border-crimson-900/60 bg-crimson-950/80 backdrop-blur-lg sticky top-0 z-50 px-4 sm:px-6 py-4 flex items-center justify-between shadow-lg">
        <Link to="/" className="flex items-center space-x-2 cursor-pointer group" onClick={() => setIsMenuOpen(false)}>
          <span className="text-xl sm:text-2xl font-black tracking-tighter text-crimson-500 group-hover:text-crimson-400 transition-colors">
            crimson<span className="text-crimson-100 font-light">haven</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex space-x-6 text-[11px] font-black uppercase tracking-widest items-center">
          {navLinks.filter(l => !l.auth || isAuthenticated).map(link => (
            <Link 
              key={link.to} 
              to={link.to} 
              className={`flex items-center gap-1.5 transition-all ${
                location.pathname === link.to 
                  ? 'text-crimson-500' 
                  : link.highlight 
                    ? 'text-white bg-crimson-500/20 px-3 py-1 rounded-full border border-crimson-500/30 hover:bg-crimson-500/40' 
                    : 'text-crimson-200/50 hover:text-crimson-400'
              }`}
            >
              {link.icon} {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 text-crimson-400 hover:text-white transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Mobile Navigation Dropdown */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-crimson-950/95 backdrop-blur-xl border-b border-crimson-900 shadow-2xl md:hidden animate-in slide-in-from-top duration-300">
            <div className="flex flex-col p-4 space-y-4">
              {navLinks.filter(l => !l.auth || isAuthenticated).map(link => (
                <Link 
                  key={link.to}
                  to={link.to} 
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all font-black uppercase tracking-widest text-sm ${
                    location.pathname === link.to ? 'bg-crimson-500/20 text-crimson-500' : 'text-crimson-100 hover:bg-crimson-900/40'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-crimson-500">{link.icon}</span> {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <div className="flex-grow z-10 flex flex-col justify-center px-4 sm:px-6 md:px-0">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/support" element={<SupportUsPage />} />
          <Route path="/supporters" element={<SupportersPage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/recently-watched" element={<RecentlyWatchedPage />} />
          <Route path="/watch/:anilistId/:season?/:episode?" element={<WatchPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-crimson-900/40 bg-crimson-950/90 text-center py-6 px-4 z-10 relative">
        <p className="text-[11px] font-medium tracking-wide text-crimson-600 max-w-3xl mx-auto uppercase leading-normal">
          Disclaimer: <span className="text-crimson-400/70">crimsonhaven does not host, store, or upload any file assets locally. Any legal issues should be taken up with the providers directly :3</span>
        </p>
      </footer>
    </div>
  );
}

export default App;