import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Search, Play, HelpCircle, Film, Info, AlertTriangle, AlertCircle, ChevronRight, ArrowLeft, Server, Hash, Menu, X, Heart, History, User, Coffee, Sparkles, RefreshCw } from 'lucide-react';
import Background from './assets/background.jpg';
import { useAnimeStreamer, useTrendingAnime, useHealthStatus, useAuth, useAccount, useTitle, API_BASE_URL, CLIENT_VERSION } from './hooks';
import NotFound from './NotFound';
import CataloguePage from './Catalogue';
import AccountPage from './Account';
import FavoritesPage from './Favorites';
import RecentlyWatchedPage from './RecentlyWatched';
// import SupportUsPage from './SupportUs'; // Temporarily hidden for legal reasons
import SupportersPage from './Supporters';
import DisclaimerPage from './Disclaimer';
import CrimsonPlayer from './CrimsonPlayer';
import AnimeOverview from './AnimeOverview';
import { stripHtml } from './utils';

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
  } = useAnimeStreamer();

  const { trendingAnimes, trendLoading } = useTrendingAnime();

  const openOverview = (anime) => {
    const anilistId = anime?.anilist_id;
    if (!anilistId) {
      setApiError('Selection failed: No AniList ID found.');
      return;
    }
    setQueryName(anime.title || anime.name || '');
    setShowSuggestions(false);
    navigate(`/anime/${anilistId}`);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!queryName.trim()) return;
    if (searchResults.length > 0) {
      openOverview(searchResults[0]);
    } else {
      setApiError('Please choose a valid choice from the loading results dropdown.');
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-20 sm:py-32 text-center space-y-12 my-auto animate-in fade-in zoom-in-95 duration-1000">
      <div className="space-y-4">
        <h1 className="text-[clamp(1.75rem,10vw,6rem)] font-black tracking-tighter text-white uppercase drop-shadow-[0_10px_40px_rgba(255,0,60,0.3)] whitespace-nowrap">
          crimson<span className="text-crimson-500 font-light opacity-90">haven</span>
        </h1>
        <p className="text-crimson-400 text-sm sm:text-base tracking-[0.4em] font-black uppercase opacity-70 px-4">
          Seamlessly Streaming the Dark Network
        </p>
      </div>

      <div className="relative max-w-2xl mx-auto group px-2 sm:px-0">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center border border-crimson-900/60 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-crimson-950/40 backdrop-blur-xl transition-all focus-within:border-crimson-500/50 focus-within:shadow-[0_0_40px_rgba(255,0,60,0.15)] overflow-hidden">
          <div className="absolute left-6 flex items-center pointer-events-none">
             <Search className="w-5 h-5 text-crimson-500 opacity-40 group-focus-within:opacity-100 transition-opacity" />
          </div>
          <input 
            type="text" 
            placeholder="Search manifestations..." 
            value={queryName} 
            onFocus={() => { if (queryName.length >= 3) setShowSuggestions(true); }} 
            onChange={(e) => { setQueryName(e.target.value); if (e.target.value.length >= 3) setShowSuggestions(true); }} 
            onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }} 
            className="w-full py-5 sm:py-6 pl-16 pr-24 focus:outline-none font-bold tracking-wide appearance-none bg-transparent text-crimson-50 placeholder-crimson-500/50 text-sm sm:text-lg"
          />
          <button 
            type="submit" 
            disabled={metaLoading} 
            className="absolute right-2 top-2 bottom-2 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900 text-white px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center group/btn"
          >
            {metaLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Invoke</span>
                <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </div>
            )}
          </button>
        </form>

        {showSuggestions && (
          <div className="absolute top-full left-2 right-2 sm:left-0 sm:right-0 mt-3 bg-crimson-950/95 backdrop-blur-2xl border border-crimson-900 shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-h-[400px] overflow-y-auto z-50 text-left rounded-3xl animate-in slide-in-from-top-4 duration-300">
            {searchResults.length > 0 ? (
              <div className="p-2">
                {searchResults.map((suggestion, index) => (
                  <AnimeCard
                    key={index}
                    title={suggestion.title || suggestion.name}
                    poster={suggestion.poster || null}
                    onSelect={() => openOverview(suggestion)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-xs font-black uppercase tracking-[0.2em] text-crimson-700 text-center italic">
                No tracked manifestations found
              </div>
            )}
          </div>
        )}
      </div>

      {apiError && (
        <div className="max-w-md mx-auto p-5 bg-crimson-500/5 border border-crimson-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-crimson-400 flex items-center gap-4 shadow-2xl animate-in shake duration-500">
          <AlertTriangle className="w-5 h-5 text-crimson-500 shrink-0" />
          <span className="text-left leading-relaxed">System Message: {apiError}</span>
        </div>
      )}

      <div className="mt-20 sm:mt-32 pt-12 border-t border-crimson-900/30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
            <div className="w-2 h-8 bg-crimson-500 rounded-full"></div>
            Trending <span className="text-crimson-500">Streams</span> 
          </h2>
          <div className="h-px bg-crimson-900/30 flex-grow hidden sm:block mx-8"></div>
          <Link to="/catalogue" className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600 hover:text-crimson-400 transition-colors">
            View All Archives
          </Link>
        </div>

        {trendLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 animate-pulse">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="aspect-[2/3] bg-crimson-950/40 rounded-2xl border border-dashed border-crimson-900/50"></div>
            ))}
          </div>
        )}

        {!trendLoading && trendingAnimes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8">
            {trendingAnimes.map((anime, index) => (
              <div
                key={index}
                onClick={() => openOverview(anime)}
                className="group flex flex-col gap-3 cursor-pointer"
              >
                <div className="relative aspect-[2/3] bg-crimson-900/10 border border-crimson-900/40 rounded-2xl overflow-hidden transition-[border-color,box-shadow] duration-500 group-hover:border-crimson-500/50 group-hover:shadow-[0_15px_30px_rgba(255,0,60,0.2)]">
                  <img src={anime.poster} alt={`${anime.title} poster`} className="w-full h-full object-cover transform-gpu transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-transparent to-transparent opacity-60"></div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-crimson-950/20 backdrop-blur-[1px]">
                     <div className="p-3 bg-crimson-500 rounded-full shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <Play className="w-6 h-6 fill-white text-white" />
                     </div>
                  </div>
                </div>
                <div className="text-left px-1">
                  <h4 className="text-xs sm:text-sm font-bold text-crimson-50 line-clamp-2 group-hover:text-crimson-400 transition-colors tracking-tight leading-snug">
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
  const playbackRef = useRef(null);
  // Latest live playback position, so that re-mounting the player (switching
  // source/quality, or the auto-upgrade to Voe) resumes where the viewer is now
  // — not back at the load-time saved position.
  const livePositionRef = useRef(0);
  const handlePlayerProgress = useCallback((position, duration) => {
    playbackRef.current = { position, duration };
    livePositionRef.current = position;
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

  const { favorites, toggleFavorite, updateProgress, fetchResumePosition } = useAccount();
  const { isAuthenticated } = useAuth();

  // Saved-position resume: look up where the user left off on this exact episode
  // and hand it to the player as a start time. Re-runs per episode/season change;
  // resets to 0 first so switching to a fresh episode never inherits a stale seek.
  const [resumeAt, setResumeAt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResumeAt(0);
    livePositionRef.current = 0; // new episode: forget the previous one's live spot
    if (!isAuthenticated) return;
    fetchResumePosition(anilistId, parseInt(currentSeason), parseInt(currentEpisode))
      .then(pos => { if (!cancelled && pos) setResumeAt(pos); });
    return () => { cancelled = true; };
  }, [anilistId, currentSeason, currentEpisode, isAuthenticated, fetchResumePosition]);

  // Where a freshly-mounted player should start: the live spot once playback has
  // advanced (source switches keep their place), else the saved resume position.
  const playerStartAt = livePositionRef.current > 5 ? livePositionRef.current : resumeAt;
  
  useTitle(animeMetadata?.title ? `Watch ${animeMetadata.title}` : 'Streaming Manifestation');

  const isFavorite = favorites.some(f => f.anilist_id === parseInt(anilistId) || String(f.tmdb_id) === String(animeMetadata?.tmdb_id));

  const currentEpisodeData = animeMetadata?.episodes_list?.find(e => e.episode_number === currentEpisode);
  const episodeTitle = currentEpisodeData?.title && currentEpisodeData.title !== `Episode ${currentEpisode}`
    ? currentEpisodeData.title
    : null;
  const episodeDescription = currentEpisodeData?.overview
    || animeMetadata?.summary
    || stripHtml(animeMetadata?.description)
    || 'No summary asset provided.';

  useEffect(() => {
    if (anilistId) {
      initializeFromIds(anilistId, parseInt(season), parseInt(episode));
    }
  }, [anilistId, season, episode, initializeFromIds]);

  useEffect(() => {
    if (!isAuthenticated || !animeMetadata) return;

    playbackRef.current = null;
    const startedAt = Date.now();

    const save = () => {
      const pb = playbackRef.current;
      const position = pb ? pb.position : (Date.now() - startedAt) / 1000;
      const duration = pb && pb.duration ? pb.duration : 1440;
      if (position < 1) return;
      updateProgress({
        tmdb_id: animeMetadata.tmdb_id,
        anilist_id: parseInt(anilistId),
        season_number: parseInt(currentSeason),
        episode_number: parseInt(currentEpisode),
        title: animeMetadata.title,
        poster: animeMetadata.poster,
        position_seconds: Math.round(position),
        duration_seconds: Math.round(duration),
      });
    };

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(save, 15000);

    return () => {
      clearInterval(progressTimerRef.current);
      save();
    };
  }, [anilistId, currentSeason, currentEpisode, animeMetadata, isAuthenticated, updateProgress]);

  const handleSeasonChange = (newSeason) => {
    setCurrentSeason(newSeason);
    navigate(`/watch/${anilistId}/${newSeason}/${currentEpisode}`);
  };

  const handleEpisodeChange = (newEpisode) => {
    setCurrentEpisode(newEpisode);
    navigate(`/watch/${anilistId}/${currentSeason}/${newEpisode}`);
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-4 gap-8 sm:gap-10 animate-in fade-in duration-1000">
      {/* Main Video Area */}
      <div className="lg:col-span-3 space-y-8">
        {/* Back to the anime's overview page */}
        <Link
          to={`/anime/${anilistId}`}
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
          {!streamLoading && streamData?.streams?.[activeStreamIdx] ? (
            streamData.streams[activeStreamIdx].type === 'iframe' ? (
              (() => {
                const url = streamData.streams[activeStreamIdx].url;
                const sandboxed = typeof url === 'string'
                  && url.startsWith(API_BASE_URL);
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
              <CrimsonPlayer
                key={streamData.streams[activeStreamIdx].url}
                src={streamData.streams[activeStreamIdx].url}
                type={streamData.streams[activeStreamIdx].type}
                poster={animeMetadata?.poster}
                title={animeMetadata?.title}
                startAt={playerStartAt}
                onProgress={handlePlayerProgress}
              />
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

        {/* Anime Info Panel */}
        <div className="p-6 sm:p-10 bg-crimson-950/40 border border-crimson-900/40 rounded-[2.5rem] backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 relative z-10">
            <div className="space-y-6 w-full">
              <div className="flex flex-wrap gap-3 items-center">
                {animeMetadata?.status && (
                  <span className="bg-crimson-500/10 text-crimson-400 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-crimson-500/30 backdrop-blur-md">
                    {animeMetadata.status}
                  </span>
                )}
                <span className="text-[10px] text-crimson-600 font-black tracking-widest uppercase opacity-70">
                  REF: {animeMetadata?.anilist_id || 'UNK'}
                </span>
                {isAuthenticated && (
                  <button 
                    onClick={() => toggleFavorite({ ...animeMetadata, anilist_id: parseInt(anilistId) })}
                    className={`ml-auto flex items-center gap-2.5 px-5 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${
                      isFavorite 
                        ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.3)]' 
                        : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-500 hover:text-white hover:border-crimson-600'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFavorite ? 'fill-white' : ''}`} />
                    {isFavorite ? 'Saved' : 'Save'}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white leading-[1.1]">
                  {seasonGroups?.title || animeMetadata?.title || 'Unknown Cluster'}
                  {seasonGroups?.totalSeasons > 1 && (
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
                    onClick={() => handleSeasonChange(season.season_number)} 
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

          {animeMetadata?.episodes_list && (
            <div className="p-6 sm:p-10 bg-crimson-950/30 border border-crimson-900/30 rounded-[2.5rem] space-y-8 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                  <Info className="w-6 h-6 text-crimson-500" /> Manifest Segments
                </h3>
                <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {animeMetadata.episodes_list.map((ep) => (
                  <button 
                    key={ep.episode_number} 
                    onClick={() => handleEpisodeChange(ep.episode_number)} 
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
          {/* Decorative background element */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>
          
          <h3 className="text-lg font-black text-white mb-8 flex items-center gap-3 uppercase tracking-tighter relative z-10">
            <div className="relative">
               <div className="w-2.5 h-2.5 rounded-full bg-crimson-500 animate-ping absolute inset-0"></div>
               <div className="w-2.5 h-2.5 rounded-full bg-crimson-600 relative"></div>
            </div>
            Scraped Targets
          </h3>
          <div className="grid grid-cols-1 gap-3 relative z-10">
            {streamLoading && !streamData?.streams?.length ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-crimson-950/40 animate-pulse rounded-2xl border border-crimson-900/30"></div>
              ))
            ) : streamData?.streams && streamData.streams.length > 0 ? (
              streamData.streams.map((stream, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setActiveStreamIdx(idx)} 
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
          
          {streamLoading && streamData?.streams?.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-2 animate-pulse">
               <div className="w-1.5 h-1.5 bg-crimson-500 rounded-full"></div>
               <span className="text-[8px] font-black uppercase tracking-[0.3em] text-crimson-600">Probing more nodes</span>
            </div>
          )}
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
  const [backendVersion, setBackendVersion] = useState('Resolving...');
  useTitle('About the Haven');

  useEffect(() => {
    fetch(`${API_BASE_URL}/`)
      .then(res => res.json())
      .then(data => setBackendVersion(data.Version || data.version || 'Unknown'))
      .catch(() => setBackendVersion('Offline'));
  }, []);

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 space-y-2">
        <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter leading-none">About <span className="text-crimson-500">CrimsonHaven</span></h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">The architectural design manifest</p>
      </div>

      <div className="space-y-8 text-sm sm:text-base text-crimson-100/70 leading-relaxed text-justify font-medium">
        <p><strong className="text-white font-black tracking-tight">crimsonhaven</strong> is a performance-optimized high-fidelity user application frame, engineered for the most discerning mortals.</p>
        
        <div className="bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/50 p-6 sm:p-8 rounded-[2rem] font-mono text-xs text-crimson-400 space-y-3 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Server className="w-12 h-12 text-crimson-500" />
          </div>
          <h3 className="font-black text-crimson-50 mb-4 tracking-widest uppercase border-b border-crimson-900/50 pb-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-crimson-500 animate-pulse"></div>
            System Specification Diagnostics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">CLIENT:</span> React 18 / Vite / Tailwind</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">ROUTING:</span> FastAPI Asynchronous Engine</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">BACKEND VERSION:</span> {backendVersion}</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">CLIENT VERSION:</span> {CLIENT_VERSION}</p>
          </div>
        </div>

        <div className="relative bg-crimson-500/5 backdrop-blur-md border border-crimson-500/20 p-8 rounded-[2.5rem] shadow-xl">
          <div className="absolute -top-3 left-10 px-4 py-1 bg-crimson-500 rounded-full text-[8px] font-black uppercase tracking-[0.3em] text-white">Queen's Decree</div>
          <p className="italic text-crimson-100/90 leading-relaxed text-lg tracking-tight">
            "And a little secret between us, darling~ Ironically, this totally <span className="text-white not-italic font-black border-b-2 border-crimson-500/50">morally correct</span> webpage
            keeps all your data tucked away in <span className="text-white not-italic font-black border-b-2 border-crimson-500/50">Switzerland</span>. Funny, isn't it?~"
          </p>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-500 flex items-center gap-3">
             <span className="block w-8 h-px bg-crimson-500/50"></span>
             Luminas, the Vampire Queen
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
           Invoke Social Nodes
           <div className="h-px bg-crimson-900/30 flex-grow"></div>
        </h3>
        <div className="flex flex-wrap gap-4">
          {SOCIAL_LINKS.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-crimson-950/40 backdrop-blur-sm border border-crimson-900/60 rounded-2xl text-crimson-400 hover:text-white hover:border-crimson-500 hover:bg-crimson-900/40 transition-all text-xs font-black uppercase tracking-widest shadow-lg group"
            >
              <div className="group-hover:scale-110 transition-transform">{icon}</div>
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
          <Server className="w-4 h-4" /> Node Status
          <div className="h-px bg-crimson-900/30 flex-grow"></div>
        </h3>
        <div className="bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 p-6 rounded-3xl font-mono text-[10px] space-y-2 shadow-inner">
          {healthLoading && (
            <p className="text-crimson-500 animate-pulse flex items-center gap-2">
               <RefreshCw className="w-3 h-3 animate-spin" /> Probing system nodes...
            </p>
          )}
          {healthError && (
            <p className="text-crimson-500 font-bold flex items-center gap-2">
               <AlertCircle className="w-3 h-3" /> System Link Severed: {healthError}
            </p>
          )}
          {health && Object.entries(health).map(([key, value]) => (
            <p key={key} className="text-crimson-400/80 group">
              <span className="text-crimson-600 font-black mr-2">/</span> 
              <span className="font-black uppercase tracking-wider text-crimson-700">{key}:</span>{' '}
              <span className="text-crimson-100 group-hover:text-white transition-colors">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
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
    // { to: "/support", label: "Support Us", icon: <Coffee className="w-4 h-4" /> }, // Temporarily hidden for legal reasons
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
          {/* <Route path="/support" element={<SupportUsPage />} /> */} {/* Temporarily hidden for legal reasons */}
          <Route path="/supporters" element={<SupportersPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/recently-watched" element={<RecentlyWatchedPage />} />
          <Route path="/anime/:anilistId" element={<AnimeOverview />} />
          <Route path="/watch/:anilistId/:season?/:episode?" element={<WatchPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-crimson-900/40 bg-crimson-950/90 text-center py-6 px-4 z-10 relative">
        <p className="text-[11px] font-medium tracking-wide text-crimson-600 max-w-3xl mx-auto uppercase leading-normal">
          Disclaimer: <span className="text-crimson-400/70">crimsonhaven does not host, store, or upload any file assets locally. Any legal issues should be taken up with the providers directly :3</span>{' '}
          <Link to="/disclaimer" className="text-crimson-500 hover:text-crimson-400 underline underline-offset-2 transition-colors font-black">
            Read More
          </Link>
        </p>
      </footer>
    </div>
  );
}

export default App;