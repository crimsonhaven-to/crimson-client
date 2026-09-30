import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Film, AlertTriangle, ChevronRight, X, Sparkles, Flame, Tv, Puzzle, BookOpen } from 'lucide-react';
import { kindStyle } from '../browse/hubHelpers';
import { SeeAll } from '../browse/hubKit';
import { useTrendingAnime } from '../anime/hooks';
import { useTrendingShows } from '../shows/hooks';
import { useTrendingMovies } from '../movies/hooks';
import { useTrendingManga } from '../manga/hooks';
import { useUnifiedSearch, useRecommendations } from './hooks';
import { useProfile } from '../account/profile';
import { useTitle } from '../shell/useTitle';
import ContentRow from './ContentRow';
import { useCompanionNudge } from '../sources/companion';

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
      <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border ${kindStyle(kind).badge}`}>
        {kindStyle(kind).label}
      </span>
      <ChevronRight className="w-4 h-4 text-crimson-700" />
    </div>
  </div>
);

function ExtensionBanner() {
  const { show, dismiss } = useCompanionNudge();
  if (!show) return null;

  const onDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismiss();
  };

  return (
    <Link
      to="/extension"
      className="group flex items-center gap-4 px-5 py-4 rounded-2xl bg-crimson-500/[0.07] border border-crimson-500/25 hover:border-crimson-500/50 hover:bg-crimson-500/[0.12] transition-all shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-700"
    >
      <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-crimson-500/15 border border-crimson-500/30 text-crimson-400 shrink-0">
        <Puzzle className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-grow">
        <span className="block text-sm font-black text-crimson-50 tracking-tight">
          Psst, darling, claim the Crimson Companion. 🦇
        </span>
        <span className="block text-[11px] sm:text-xs text-crimson-100/60 font-medium leading-snug">
          A featherlight browser familiar that resolves &amp; plays your sources locally, straight from your own hands.
        </span>
      </span>
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-crimson-400 group-hover:text-crimson-300 transition-colors shrink-0">
        Summon
        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="p-1.5 rounded-lg text-crimson-600 hover:text-crimson-300 hover:bg-crimson-900/40 transition-all shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </Link>
  );
}

// Deliberately not dismissible: resolving runs in the viewer's browser, and an
// adblocker silently breaks those fetches.
function AdblockerNotice() {
  return (
    <div
      role="alert"
      className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-crimson-500/[0.07] border border-crimson-500/25 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-700"
    >
      <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-crimson-500/15 border border-crimson-500/30 text-crimson-400 shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-grow">
        <span className="block text-sm font-black text-crimson-50 tracking-tight">
          Lower your wards on the haven, darling. 🩸
        </span>
        <span className="block text-[11px] sm:text-xs text-crimson-100/60 font-medium leading-snug">
          Crimson now conjures &amp; resolves your sources right here in your own browser, and a hungry adblocker
          mistakes that ritual for prey, severing the threads before the stream can breathe. Whitelist this page
          so the magic may flow.
        </span>
      </span>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  useTitle('Search Home');
  const {
    queryName, setQueryName,
    results: searchResults, showSuggestions, setShowSuggestions,
  } = useUnifiedSearch();
  const [apiError, setApiError] = useState(null);

  const { trendingAnimes, trendLoading } = useTrendingAnime();
  const { trendingShows, trendLoading: showsLoading } = useTrendingShows();
  const { trendingMovies, trendLoading: moviesLoading } = useTrendingMovies();
  const { trendingManga, trendLoading: mangaLoading } = useTrendingManga();
  const { recommendations, basedOn, loading: recsLoading } = useRecommendations(18);
  const profile = useProfile();
  const displayName = profile?.username;

  const openOverview = (item) => {
    setQueryName(item.title || item.name || '');
    setShowSuggestions(false);
    if (item.kind === 'local' && item.id) {
      navigate(`/local/${item.id}`);
    } else if (item.kind === 'movie') {
      navigate(`/movie/${item.tmdb_id}`);
    } else if (item.kind === 'manga' && item.anilist_id) {
      navigate(`/manga/${item.anilist_id}`);
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

  const recsTitle = displayName ? 'Recommended for You,' : 'Recommended for';
  const recsAccent = displayName || 'You';
  const recsSubtitle = basedOn?.top_genres?.length
    ? `Woven from your love of ${basedOn.top_genres.slice(0, 3).map(g => g.genre).join(' · ')}`
    : 'Curated by Luminas from what you adore';

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-16 sm:space-y-20 animate-in fade-in duration-1000">
      <div className="max-w-2xl mx-auto !mt-0">
        <AdblockerNotice />
      </div>

      <div className="max-w-2xl mx-auto !mt-2">
        <ExtensionBanner />
      </div>

      <div className="space-y-4 text-center max-w-3xl mx-auto pt-6 sm:pt-12">
        <h1 className="text-[clamp(1.75rem,10vw,6rem)] font-black tracking-tighter text-crimson-50 uppercase drop-shadow-[0_10px_40px_rgba(255,0,60,0.3)] whitespace-nowrap">
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
            className="absolute right-2 top-2 bottom-2 bg-crimson-600 hover:bg-crimson-500 text-white px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center group/btn"
          >
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Invoke</span>
              <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
            </div>
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
        cta={<Link to="/anime"><SeeAll>See all</SeeAll></Link>}
      />

      <ContentRow
        icon={<Tv className="w-6 h-6" />}
        title="Trending"
        accent="Shows"
        items={trendingShows}
        loading={showsLoading}
        onSelect={openOverview}
        cta={<Link to="/shows"><SeeAll>See all</SeeAll></Link>}
      />

      <ContentRow
        icon={<Film className="w-6 h-6" />}
        title="Trending"
        accent="Movies"
        items={trendingMovies}
        loading={moviesLoading}
        onSelect={openOverview}
        cta={<Link to="/movies"><SeeAll>See all</SeeAll></Link>}
      />

      <ContentRow
        icon={<BookOpen className="w-6 h-6" />}
        title="Trending"
        accent="Manga"
        items={trendingManga}
        loading={mangaLoading}
        onSelect={openOverview}
        cta={<Link to="/manga"><SeeAll>See all</SeeAll></Link>}
      />
    </div>
  );
}
