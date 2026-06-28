import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Search, Play, HelpCircle, Film, AlertTriangle, AlertCircle, ChevronRight, Server, Hash, Menu, X, Heart, History, User, Sparkles, RefreshCw, LogOut, Shield, ScrollText, Tag, SlidersHorizontal, Flame, Tv, Star, Wallet } from 'lucide-react';
import MeshBackground from './MeshBackground';
import { useAnimeStreamer, useTrendingAnime, useTrendingShows, useTrendingMovies, useUnifiedSearch, useHealthStatus, useAuth, useAccount, useProfile, useRecommendations, useTitle, useChangelog, apiFetch, CLIENT_VERSION } from './hooks';
import { useDiscordPresence } from './discordPresence';
import { useKonamiCode } from './useKonami';
import { changelogExcerpt, formatReleaseDate } from './utils';
import WatchView from './WatchView';
import NotFound from './NotFound';
// Auth wall — eager: it's the first paint for logged-out visitors, so keeping it
// in the main bundle avoids a chunk round-trip on the critical path.
import LoginWall from './Login';
import VerifyEmail from './VerifyEmail';
import ResetPassword from './ResetPassword';
// Authenticated pages — lazy. They (and the heavy hls.js player) only download
// once a signed-in user actually navigates to them, so the login wall + landing
// ship a much smaller bundle. See the <Suspense> fallback below.
const CataloguePage = lazy(() => import('./Catalogue'));
const AccountPage = lazy(() => import('./Account'));
const SettingsPage = lazy(() => import('./UserSettings'));
// Luminas' welcome ritual — shown once per login (see the auth-transition effect
// in App). Lazy so it never weighs on the login wall / first paint.
const WelcomeTour = lazy(() => import('./WelcomeTour'));
const FavoritesPage = lazy(() => import('./Favorites'));
const RecentlyWatchedPage = lazy(() => import('./RecentlyWatched'));
const SupportUsPage = lazy(() => import('./SupportUs'));
const SupportersPage = lazy(() => import('./Supporters'));
const DisclaimerPage = lazy(() => import('./Disclaimer'));
const ChangelogPage = lazy(() => import('./Changelog'));
const AnimeOverview = lazy(() => import('./AnimeOverview'));
// Admin dashboard — lazy, and only ever reached by admin accounts.
const AdminPage = lazy(() => import('./Admin'));
// Non-anime TV show pages — the TMDB-keyed twins of the anime overview/watch pages.
const ShowOverview = lazy(() => import('./ShowOverview'));
const ShowWatch = lazy(() => import('./ShowWatch'));
const MovieOverview = lazy(() => import('./MovieOverview'));
const MovieWatch = lazy(() => import('./MovieWatch'));
const LumiSecret = lazy(() => import('./LumiSecret'));

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

const AnimeCard = ({ title, poster, kind, onSelect }) => (

  <div
    className="flex items-center justify-between p-3 cursor-pointer hover:bg-crimson-900/20 transition-colors border-b border-crimson-900/50"
    onMouseDown={onSelect}
  >
    <div className="flex items-center gap-3 min-w-0">
      {poster ? (
        <img src={poster} alt="" className="w-12 h-auto object-cover rounded shadow-lg flex-shrink-0" />
      ) : (
        <div className="w-12 h-16 bg-crimson-900/30 flex items-center justify-center text-sm text-crimson-400 flex-shrink-0">
          No Poster
        </div>
      )}
      <span className="text-base font-semibold text-crimson-300 truncate max-w-[240px]">{title}</span>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {/* Tag so anime vs non-anime show vs movie is obvious at a glance. */}
      <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border ${
        kind === 'show' || kind === 'movie'
          ? 'bg-crimson-900/30 border-crimson-800/50 text-crimson-400'
          : 'bg-crimson-500/10 border-crimson-500/20 text-crimson-500'
      }`}>
        {kind === 'show' ? 'Show' : kind === 'movie' ? 'Movie' : 'Anime'}
      </span>
      <ChevronRight className="w-4 h-4 text-crimson-700" />
    </div>
  </div>
);

// ---------- Reusable poster card + content row ----------
// A single poster tile shared by every home row (recommendations + trending).
// The kind badge, rating and year ride the artwork like the movie-web / P-Stream
// cards — recoloured in crimson and lit by Luminas' glow on hover.
const KIND_LABEL = { anime: 'Anime', show: 'Show', movie: 'Movie' };

function PosterCard({ item, onSelect }) {
  const rating = typeof item.vote_average === 'number' && item.vote_average > 0
    ? item.vote_average.toFixed(1) : null;
  return (
    <button onClick={() => onSelect(item)} className="group text-left flex flex-col gap-2.5 w-full focus:outline-none">
      <div className="relative w-full h-48 sm:h-60 lg:h-[16.5rem] rounded-2xl overflow-hidden bg-crimson-900/10 border border-crimson-900/40 transition-[border-color,box-shadow,transform] duration-500 group-hover:border-crimson-500/50 group-hover:shadow-[0_18px_40px_rgba(255,0,60,0.28)] group-hover:-translate-y-1">
        {item.poster ? (
          <img
            src={item.poster}
            alt={`${item.title} poster`}
            loading="lazy"
            className="w-full h-full object-cover transform-gpu transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 px-2 text-center">
            No Sigil
          </div>
        )}

        {/* Readability gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-crimson-950/10 to-transparent opacity-80"></div>

        {/* Kind badge */}
        {item.kind && (
          <span className="absolute top-2 left-2 text-[8px] font-black uppercase tracking-[0.18em] px-2 py-0.5 rounded-md border bg-crimson-950/70 backdrop-blur-sm border-crimson-800/60 text-crimson-300">
            {KIND_LABEL[item.kind] || item.kind}
          </span>
        )}

        {/* Rating badge */}
        {rating && (
          <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-crimson-950/70 backdrop-blur-sm border border-crimson-800/60 text-crimson-200">
            <Star className="w-2.5 h-2.5 fill-crimson-400 text-crimson-400" /> {rating}
          </span>
        )}

        {/* Hover play */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-crimson-950/20 backdrop-blur-[1px]">
          <div className="p-3 bg-crimson-500 rounded-full shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <Play className="w-5 h-5 fill-white text-white" />
          </div>
        </div>

        {/* Year over the gradient */}
        {item.year && (
          <span className="absolute bottom-2 left-2.5 text-[10px] font-black text-crimson-100/80 tracking-wide">
            {item.year}
          </span>
        )}
      </div>
      <h4 className="text-xs sm:text-sm font-bold text-crimson-50 line-clamp-2 group-hover:text-crimson-400 transition-colors tracking-tight leading-snug px-0.5">
        {item.title}
      </h4>
    </button>
  );
}

// Fixed tile width shared by the cards and the loading skeletons, so a row is
// always exactly one horizontal track (no wrapping into a grid).
const ROW_TILE = 'shrink-0 snap-start w-32 sm:w-40 lg:w-44';
// Horizontal scroll track. Negative margins let the row bleed to the screen edge
// on mobile while staying flush with the page padding on desktop.
const ROW_TRACK = 'flex items-start gap-4 sm:gap-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

// Skeleton tiles shown while a row's data loads.
function RowSkeleton() {
  return (
    <div className={`${ROW_TRACK} animate-pulse`}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
        <div key={n} className={`${ROW_TILE} h-48 sm:h-60 lg:h-[16.5rem] bg-crimson-950/40 rounded-2xl border border-dashed border-crimson-900/50`}></div>
      ))}
    </div>
  );
}

// One titled home row: a header plus a single horizontally-scrolling poster track
// (P-Stream / movie-web style). Renders nothing once it has finished loading with
// no items, so empty surfaces vanish cleanly.
function ContentRow({ icon, title, accent, subtitle, items, loading, onSelect, cta }) {
  if (!loading && (!items || items.length === 0)) return null;
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-xl sm:text-2xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
            <span className="text-crimson-500 shrink-0">{icon}</span>
            <span className="truncate">{title} {accent && <span className="text-crimson-500">{accent}</span>}</span>
          </h2>
          {subtitle && (
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-crimson-600 truncate">{subtitle}</p>
          )}
        </div>
        {cta}
      </div>
      {loading ? (
        <RowSkeleton />
      ) : (
        <div className={ROW_TRACK}>
          {items.map((item, i) => (
            <div key={`${item.kind}-${item.tmdb_id ?? item.anilist_id}-${i}`} className={ROW_TILE}>
              <PosterCard item={item} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Landing Page Component ----------
function LandingPage() {
  const navigate = useNavigate();
  useTitle('Search Home');
  // Unified search: anime AND non-anime shows, anime listed first. Each result is
  // tagged with `kind` so we route it to the right overview page.
  const {
    queryName, setQueryName,
    results: searchResults, showSuggestions, setShowSuggestions,
  } = useUnifiedSearch();
  const [apiError, setApiError] = useState(null);
  const metaLoading = false;

  const { trendingAnimes, trendLoading } = useTrendingAnime();
  const { trendingShows, trendLoading: showsLoading } = useTrendingShows();
  const { trendingMovies, trendLoading: moviesLoading } = useTrendingMovies();
  // Personalized "watch next" feed + the viewer's display name for the greeting.
  const { recommendations, basedOn, loading: recsLoading } = useRecommendations(18);
  const profile = useProfile();
  const displayName = profile?.username;

  // Anime -> /anime/{anilist_id}; non-anime show -> /show/{tmdb_id};
  // movie -> /movie/{tmdb_id}.
  const openOverview = (item) => {
    setQueryName(item.title || item.name || '');
    setShowSuggestions(false);
    if (item.kind === 'movie') {
      navigate(`/movie/${item.tmdb_id}`);
    } else if (item.kind === 'show' || (!item.anilist_id && item.tmdb_id)) {
      navigate(`/show/${item.tmdb_id}`);
    } else if (item.anilist_id) {
      navigate(`/anime/${item.anilist_id}`);
    } else {
      setApiError('Selection failed: missing identifier.');
    }
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

  // Greeting for the personalized row: "Recommended for You, {name}".
  const recsTitle = displayName ? 'Recommended for You,' : 'Recommended for';
  const recsAccent = displayName || 'You';
  const recsSubtitle = basedOn?.top_genres?.length
    ? `Woven from your love of ${basedOn.top_genres.slice(0, 3).map(g => g.genre).join(' · ')}`
    : 'Curated by Luminas from what you adore';

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-16 sm:space-y-20 animate-in fade-in duration-1000">
      {/* Hero — the haven's sigil and the one search that opens every door. */}
      <div className="space-y-4 text-center max-w-3xl mx-auto pt-6 sm:pt-12">
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
                    kind={suggestion.kind}
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

      {/* Personalized recommendations — only when Luminas actually has picks for
          you. A brand-new account (no history) falls straight through to trending. */}
      {(recsLoading || recommendations.length > 0) && (
        <ContentRow
          icon={<Sparkles className="w-6 h-6" />}
          title={recsTitle}
          accent={recsAccent}
          subtitle={recsSubtitle}
          items={recommendations}
          loading={recsLoading}
          onSelect={openOverview}
        />
      )}

      <ContentRow
        icon={<Flame className="w-6 h-6" />}
        title="Trending"
        accent="Anime"
        items={trendingAnimes}
        loading={trendLoading}
        onSelect={openOverview}
        cta={
          <Link to="/catalogue" className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600 hover:text-crimson-400 transition-colors shrink-0">
            View All Archives
          </Link>
        }
      />

      <ContentRow
        icon={<Tv className="w-6 h-6" />}
        title="Trending"
        accent="Shows"
        items={trendingShows}
        loading={showsLoading}
        onSelect={openOverview}
      />

      <ContentRow
        icon={<Film className="w-6 h-6" />}
        title="Trending"
        accent="Movies"
        items={trendingMovies}
        loading={moviesLoading}
        onSelect={openOverview}
      />
    </div>
  );
}

// ---------- Watch Page Component ----------
function WatchPage() {
  const { anilistId, season = '1', episode = '1' } = useParams();
  const navigate = useNavigate();
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
    streamLoading, unaired,
    availableSeasons, seasonGroups,
    currentSeason, setCurrentSeason,
    currentEpisode, setCurrentEpisode,
    activeStreamIdx, setActiveStreamIdx,
    initializeFromIds
  } = useAnimeStreamer({ initialAnilistId: anilistId, initialSeason: parseInt(season), initialEpisode: parseInt(episode) });

  const { updateProgress, fetchResumePosition } = useAccount();
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

  const watchlistItem = { ...animeMetadata, anilist_id: parseInt(anilistId) };

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
    <WatchView
      streams={streamData?.streams || []}
      streamLoading={streamLoading}
      unaired={unaired}
      activeStreamIdx={activeStreamIdx}
      onSelectStream={setActiveStreamIdx}
      poster={animeMetadata?.poster}
      playerStartAt={playerStartAt}
      onPlayerProgress={handlePlayerProgress}
      metadata={animeMetadata}
      displayTitle={seasonGroups?.title || animeMetadata?.title}
      totalSeasons={seasonGroups?.totalSeasons}
      currentSeason={currentSeason}
      currentEpisode={currentEpisode}
      refLabel={animeMetadata?.anilist_id}
      availableSeasons={availableSeasons}
      onSeasonChange={handleSeasonChange}
      onEpisodeChange={handleEpisodeChange}
      isAuthenticated={isAuthenticated}
      watchlistItem={watchlistItem}
      backUrl={`/anime/${anilistId}`}
    />
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
  const { entries: changelog, loading: changelogLoading, notConfigured: changelogUnavailable } = useChangelog();
  const [backendVersion, setBackendVersion] = useState('Resolving...');
  useTitle('About the Haven');

  const latestRelease = changelog[0];

  useEffect(() => {
    apiFetch(`/`)
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
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">BLOOD ARCHIVE:</span> 3-Node PostgreSQL HA Coven · Off-Site Crypt Backup</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">DOMINION:</span> 3-Node Docker Swarm · Eternal Zero-Interruption CI/CD Ritual</p>
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

      {/* Changelog preview — the first few lines of the latest decree, with a
          Read More link through to the full Chronicle page. Hidden entirely when
          the backend changelog engine isn't configured (503). */}
      {!changelogUnavailable && (
        <div className="space-y-6">
          <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
            <ScrollText className="w-4 h-4" /> Latest Chronicle
            <div className="h-px bg-crimson-900/30 flex-grow"></div>
          </h3>

          <div className="relative bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/50 p-6 sm:p-8 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 p-5 opacity-[0.07] pointer-events-none">
              <ScrollText className="w-20 h-20 text-crimson-500" />
            </div>

            {changelogLoading && (
              <p className="text-crimson-500 animate-pulse flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]">
                <RefreshCw className="w-3 h-3 animate-spin" /> Unsealing the latest decree...
              </p>
            )}

            {!changelogLoading && latestRelease && (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-crimson-500/10 border border-crimson-500/30 rounded-xl text-crimson-300 font-black tracking-tight text-sm">
                    <Tag className="w-3.5 h-3.5" />
                    {latestRelease.tag || latestRelease.name}
                  </span>
                  {latestRelease.published_at && (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600">
                      {formatReleaseDate(latestRelease.published_at)}
                    </span>
                  )}
                </div>
                {latestRelease.name && latestRelease.name !== latestRelease.tag && (
                  <h4 className="text-lg font-black text-white tracking-tight mb-3 leading-tight">{latestRelease.name}</h4>
                )}
                <p className="text-sm sm:text-base text-crimson-100/70 leading-relaxed font-medium whitespace-pre-line">
                  {changelogExcerpt(latestRelease.body)}
                </p>
              </>
            )}

            {!changelogLoading && !latestRelease && (
              <p className="text-sm text-crimson-300/60 italic font-medium">
                "No decrees etched yet, darling — but the first page awaits."
              </p>
            )}

            <Link
              to="/changelog"
              className="inline-flex items-center gap-2 mt-6 text-[10px] font-black uppercase tracking-[0.25em] text-crimson-500 hover:text-crimson-400 transition-colors group"
            >
              Read the Full Chronicle
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      )}

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

// Themed fallback shown while a lazy route chunk loads.
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-5">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
        <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-crimson-600 animate-pulse">Summoning manifest</p>
    </div>
  );
}

// ---------- Auth Gate (login wall) ----------
// Shown to everyone who isn't signed in. The site is members-only, so an
// unauthenticated visitor can only reach the login wall and the email
// verify/reset landing pages — every other path falls through to the wall.
// Kept in the main bundle (not lazy) since it's on the critical first-paint
// path for logged-out users; the heavier authenticated pages load after login.
function AuthGate() {
  return (
    <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans selection:bg-crimson-500 selection:text-white flex flex-col relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <MeshBackground />
      </div>
      <div className="flex-grow z-10 flex flex-col justify-center">
        <Routes>
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="*" element={<LoginWall />} />
        </Routes>
      </div>
      <footer className="w-full text-center py-6 px-4 z-10 relative">
        <p className="text-[10px] font-medium tracking-wide text-crimson-700 uppercase">
          crimsonhaven — members only · your data stays in Switzerland
        </p>
      </footer>
    </div>
  );
}

// ---------- Main App Component ----------
function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const { health } = useHealthStatus();
  const profile = useProfile();
  const isAdmin = !!profile?.is_admin;
  const location = useLocation();
  const navigate = useNavigate();

  // Drives the opt-in Discord Rich Presence (see discordPresence.js). Mounted once
  // here at the root so it spans every page; no-ops unless the viewer enabled it.
  useDiscordPresence();

  // ↑↑↓↓←→←→BA reveals Lumi's secret shrine (see useKonami.js / LumiSecret.jsx).
  useKonamiCode(useCallback(() => navigate('/lumi'), [navigate]));

  // Luminas' welcome ritual — fires on a fresh login, i.e. an authentication
  // transition from signed-out to signed-in *during this page's lifetime*. A
  // reload while already signed in starts authed (wasAuthedRef begins true), so
  // it does NOT re-show; only an actual login (false -> true) opens it.
  const [showTour, setShowTour] = useState(false);
  const wasAuthedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (!wasAuthedRef.current && isAuthenticated) setShowTour(true);
    wasAuthedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Nav sits transparent over the wallpaper at the very top, then darkens/blurs
  // into a solid bar once the page is scrolled — purely a visual effect.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/');
  };

  // Site-wide login wall: nothing past this point renders until authenticated.
  if (!isAuthenticated) {
    return <AuthGate />;
  }

  const navLinks = [
    { to: "/", label: "Search Home", icon: <Film className="w-4 h-4" /> },
    { to: "/catalogue", label: "Catalogue", icon: <Hash className="w-4 h-4" /> },
    { to: "/watchlists", label: "Watchlists", icon: <Heart className="w-4 h-4" />, auth: true },
    { to: "/recently-watched", label: "History", icon: <History className="w-4 h-4" />, auth: true },
    { to: "/support", label: "Support Us", icon: <Wallet className="w-4 h-4" /> },
    { to: "/supporters", label: "Mortals", icon: <Sparkles className="w-4 h-4" /> },
    { to: "/about", label: "About Us", icon: <HelpCircle className="w-4 h-4" /> },
    // Profile/account lives in the top-right account dropdown rather than the main nav.
    // Admin-only — surfaced only to accounts flagged is_admin.
    { to: "/admin", label: "Admin", icon: <Shield className="w-4 h-4" />, admin: true },
  ];

  return (
    <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans selection:bg-crimson-500 selection:text-white flex flex-col justify-between relative overflow-x-hidden">
      {/* Welcome ritual — opens once on a fresh login (see showTour above). */}
      {showTour && (
        <Suspense fallback={null}>
          <WelcomeTour onClose={() => setShowTour(false)} />
        </Suspense>
      )}

      {/* Background — animated crimson mesh gradient (see MeshBackground.jsx) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <MeshBackground />
      </div>

      {/* Navigation Bar — transparent over the wallpaper at the top, solid once scrolled */}
      <nav className={`sticky top-0 z-50 px-4 sm:px-6 border-b transition-all duration-500 ${
        scrolled
          ? 'bg-crimson-950/80 backdrop-blur-lg border-crimson-900/60 shadow-lg py-3'
          : 'bg-transparent border-transparent py-4'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 cursor-pointer group" onClick={() => { setIsMenuOpen(false); setUserMenuOpen(false); }}>
            <span className="text-xl sm:text-2xl font-black tracking-tighter text-crimson-500 group-hover:text-crimson-400 transition-colors">
              crimson<span className="text-crimson-100 font-light">haven</span>
            </span>
          </Link>

          {/* Desktop Navigation — icon-only on medium screens, icons + labels on large (xl) up */}
          <div className="hidden md:flex gap-1 lg:gap-2 xl:gap-6 text-[11px] font-black uppercase tracking-widest items-center">
            {navLinks.filter(l => (!l.auth || isAuthenticated) && (!l.admin || isAdmin)).map(link => (
              <Link
                key={link.to}
                to={link.to}
                title={link.label}
                aria-label={link.label}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 xl:px-0 xl:py-0 xl:rounded-none transition-all ${
                  location.pathname === link.to
                    ? 'text-crimson-500 bg-crimson-500/10 xl:bg-transparent'
                    : link.highlight
                      ? 'text-white bg-crimson-500/20 border border-crimson-500/30 hover:bg-crimson-500/40 xl:px-3 xl:py-1 xl:rounded-full'
                      : 'text-crimson-200/50 hover:text-crimson-400 hover:bg-crimson-900/30 xl:hover:bg-transparent'
                }`}
              >
                {link.icon} <span className="hidden xl:inline">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Right cluster: backend status pill, account dropdown, mobile menu toggle */}
          <div className="flex items-center gap-3">
            {health && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-crimson-950/40 border border-crimson-900/60 rounded-xl">
                <div className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-crimson-600'} animate-pulse`}></div>
                <span className="text-[10px] font-black text-crimson-700 uppercase tracking-widest">{health?.mode || 'ONLINE'}</span>
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => { setUserMenuOpen(o => !o); setIsMenuOpen(false); }}
                className="w-10 h-10 rounded-xl bg-crimson-950/40 border border-crimson-900/60 flex items-center justify-center hover:bg-crimson-900/20 hover:border-crimson-600 transition-all group"
                aria-label="Account menu"
              >
                <User className="w-5 h-5 text-crimson-400 group-hover:text-crimson-500" />
              </button>

              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-4 w-64 bg-crimson-950/95 backdrop-blur-2xl border border-crimson-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 rounded-2xl z-50">
                  <div className="p-4 border-b border-crimson-900/20 bg-crimson-600/5">
                    <p className="text-xs font-black text-crimson-600 uppercase tracking-widest mb-1">Session</p>
                    <p className="text-white font-bold truncate">Sanctuary Dweller</p>
                  </div>
                  <div className="p-2">
                    <Link
                      to="/account"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all"
                    >
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all"
                    >
                      <SlidersHorizontal className="w-4 h-4" /> Preferences
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all"
                      >
                        <Shield className="w-4 h-4" /> Admin Dashboard
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-500 hover:bg-crimson-600/10 rounded-xl transition-all"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-crimson-400 hover:text-white transition-colors"
              onClick={() => { setIsMenuOpen(!isMenuOpen); setUserMenuOpen(false); }}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-crimson-950/95 backdrop-blur-xl border-b border-crimson-900 shadow-2xl md:hidden animate-in slide-in-from-top duration-300">
            <div className="flex flex-col p-4 space-y-4">
              {navLinks.filter(l => (!l.auth || isAuthenticated) && (!l.admin || isAdmin)).map(link => (
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
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/support" element={<SupportUsPage />} />
          <Route path="/supporters" element={<SupportersPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/watchlists" element={<FavoritesPage />} />
          {/* Legacy path — keep old bookmarks/links working. */}
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/recently-watched" element={<RecentlyWatchedPage />} />
          <Route path="/anime/:anilistId" element={<AnimeOverview />} />
          <Route path="/watch/:anilistId/:season?/:episode?" element={<WatchPage />} />
          {/* Non-anime TV shows — TMDB-keyed twins of the anime routes above. */}
          <Route path="/show/:tmdbId" element={<ShowOverview />} />
          <Route path="/watch-show/:tmdbId/:season?/:episode?" element={<ShowWatch />} />
          <Route path="/movie/:tmdbId" element={<MovieOverview />} />
          <Route path="/watch-movie/:tmdbId" element={<MovieWatch />} />
          {/* Lumi's secret shrine — reached via the Konami code (see useKonami.js). */}
          <Route path="/lumi" element={<LumiSecret />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-crimson-900/40 bg-crimson-950/90 backdrop-blur-md py-12 px-6 z-10 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <span className="text-xl sm:text-2xl font-black tracking-tighter text-crimson-500">
              crimson<span className="text-crimson-100 font-light">haven</span>
            </span>
            <p className="text-crimson-400 text-sm leading-relaxed max-w-sm mt-5 mb-6">
              Your regal sanctuary for seamless anime streaming — curated by Lumi, your crimson curator. ✨
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="px-3 py-1 bg-crimson-950/40 border border-crimson-900/60 rounded-lg text-[10px] font-black text-crimson-500 uppercase tracking-widest">v{CLIENT_VERSION}</div>
              <div className="px-3 py-1 bg-crimson-950/40 border border-crimson-900/60 rounded-lg text-[10px] font-black text-crimson-500 uppercase tracking-widest">Members Only</div>
              <div className="px-3 py-1 bg-crimson-950/40 border border-crimson-900/60 rounded-lg text-[10px] font-black text-crimson-500 uppercase tracking-widest">Hosted in 🇨🇭 Switzerland</div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-black uppercase text-xs tracking-widest mb-6">Navigate</h4>
            <div className="flex flex-col gap-3">
              <Link to="/catalogue" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Catalogue</Link>
              <Link to="/watchlists" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Watchlists</Link>
              <Link to="/about" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">About Us</Link>
              <Link to="/supporters" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Mortals</Link>
            </div>
          </div>

          <div>
            <h4 className="text-white font-black uppercase text-xs tracking-widest mb-6">Connect</h4>
            <div className="flex flex-col gap-3">
              <Link to="/disclaimer" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Disclaimer</Link>
              <Link to="/changelog" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Chronicle</Link>
              {SOCIAL_LINKS.slice(0, 3).map(({ label, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">{label}</a>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-10 pt-8 border-t border-crimson-900/20 flex flex-col gap-4">
          <p className="text-[11px] font-medium tracking-wide text-crimson-600 uppercase leading-normal">
            Disclaimer: <span className="text-crimson-400/70">crimsonhaven does not host, store, or upload any file assets locally. Any legal issues should be taken up with the providers directly :3</span>{' '}
            <Link to="/disclaimer" className="text-crimson-500 hover:text-crimson-400 underline underline-offset-2 transition-colors font-black">
              Read More
            </Link>
          </p>
          <div className="flex items-center justify-between gap-4">
            <p className="text-crimson-700 text-[10px] font-bold uppercase tracking-widest">&copy; {new Date().getFullYear()} Crimsonhaven. All rites reserved.</p>
            <div className="flex items-center gap-4 text-crimson-700">
              <Shield className="w-4 h-4" />
              <Server className="w-4 h-4" />
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;