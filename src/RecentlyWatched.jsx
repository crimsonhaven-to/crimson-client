import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Play, Clock, Search, X, LayoutGrid, List, Trash2, AlertTriangle } from 'lucide-react';
import { useAccount, useAuth, useTitle } from './hooks';

const VIEW_KEY = 'crimson:history-view';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'Watching' },
  { key: 'completed', label: 'Finished' },
];

// Time buckets, rendered in this order — empty ones are skipped.
const BUCKETS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Which bucket an updated_at timestamp falls into (calendar-day based).
const bucketOf = (iso) => {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return 'Earlier';
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(t)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'This Month';
  return 'Earlier';
};

// Short "time ago" label for a card (e.g. "2h ago", "3d ago", or a date).
const timeAgo = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// Whether an ISO date ('YYYY-MM-DD') is strictly in the future (calendar-day).
const isFutureDate = (iso) => {
  if (!iso) return false;
  const t = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(t.getTime())) return false;
  return startOfDay(t) > startOfDay(new Date());
};

// Resume target for an item. In-progress items resume into themselves (the watch
// page seeks to the saved spot). A finished episode normally resumes into the
// *next* one — but only when that next episode actually exists (no phantom "E13"
// after a 12-episode finale) and has already aired. The backend annotates rows
// with next_episode_exists / next_episode_air_date / season_episode_count; when
// those are absent (older payloads) we fall back to the season episode count, then
// finally to the original always-advance behaviour.
const resumeInfo = (item) => {
  const finished = item.status === 'completed';
  // Manga: chapter ordinal in episode_number, page in position_seconds. Resume
  // routes to the overview, whose "Continue" button owns the chapter id (history
  // rows don't carry it) — so there's no next-chapter arithmetic here.
  if (item.media_type === 'manga') {
    const percent = item.duration_seconds
      ? Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100))
      : 0;
    return {
      finished, ep: item.episode_number || 1, href: `/manga/${item.anilist_id}`, percent,
      mode: finished ? 'rewatch' : 'resume',
      actionLabel: finished ? 'Read Again' : 'Continue Reading',
      nextAirDate: null,
    };
  }
  // Movies are a single feature — no next-episode logic, just resume / rewatch.
  if (item.media_type === 'movie') {
    const percent = item.duration_seconds
      ? Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100))
      : 0;
    return {
      finished, ep: 1, href: `/watch-movie/${item.tmdb_id}`, percent,
      mode: finished ? 'rewatch' : 'resume',
      actionLabel: finished ? 'Watch Again' : 'Resume Journey',
      nextAirDate: null,
    };
  }
  const cur = item.episode_number;

  const count = item.season_episode_count;
  const nextExists = item.next_episode_exists != null
    ? item.next_episode_exists
    : (count != null ? cur + 1 <= count : true);
  const nextAired = !isFutureDate(item.next_episode_air_date);
  const advance = finished && nextExists && nextAired;
  const ep = advance ? cur + 1 : cur;

  const href = item.anilist_id
    ? `/watch/${item.anilist_id}/${item.season_number}/${ep}`
    : item.media_type === 'movie'
      ? `/watch-movie/${item.tmdb_id}`
      : `/watch-show/${item.tmdb_id}/${item.season_number}/${ep}`;
  const percent = item.duration_seconds
    ? Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100))
    : 0;

  // What the card's action communicates:
  //   'resume'   — partway through, jump back in
  //   'next'     — finished, the next episode is ready to watch
  //   'upcoming' — finished all that's aired; the next episode hasn't dropped yet
  //   'rewatch'  — finished the finale (no further episodes); offer a re-watch
  let mode = 'resume';
  if (finished) mode = advance ? 'next' : (nextExists ? 'upcoming' : 'rewatch');
  const actionLabel = {
    resume: 'Resume Journey',
    next: `Next Episode (E${ep})`,
    upcoming: 'All Caught Up',
    rewatch: 'Watch Again',
  }[mode];

  return { finished, ep, href, percent, mode, actionLabel, nextAirDate: item.next_episode_air_date };
};

// Readable day label for an air date ('YYYY-MM-DD'), e.g. "Jul 1, 2026".
const airDateLabel = (iso) => {
  if (!iso) return '';
  const t = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// One history entry, rendered as a tall poster card ('grid') or a dense row ('list').
const HistoryCard = ({ item, view, onOpen, onRemove }) => {
  const { mode, actionLabel, percent, nextAirDate } = resumeInfo(item);
  const ago = timeAgo(item.updated_at);
  const handleRemove = (e) => { e.stopPropagation(); onRemove(item); };

  if (view === 'list') {
    return (
      <div
        onClick={onOpen}
        className="group relative flex items-center gap-4 p-3 pr-4 bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 rounded-2xl hover:border-crimson-500/50 hover:shadow-[0_10px_25px_rgba(0,0,0,0.35)] transition-[border-color,box-shadow] duration-300 cursor-pointer"
      >
        <div className="w-12 h-16 shrink-0 relative rounded-lg overflow-hidden border border-crimson-900/50">
          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-crimson-900/80">
            <div className="h-full bg-crimson-500" style={{ width: `${percent}%` }}></div>
          </div>
        </div>

        <div className="flex-grow min-w-0">
          <h4 className="text-sm sm:text-base font-black text-crimson-50 truncate group-hover:text-crimson-400 transition-colors tracking-tight">
            {item.title}
          </h4>
          <div className="mt-1 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-crimson-600">
            <span className="text-crimson-400">{item.media_type === 'movie' ? 'Movie' : item.media_type === 'manga' ? <>Ch. {item.episode_number}</> : <>S{item.season_number}<span className="text-crimson-700 mx-0.5">•</span>E{item.episode_number}</>}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{percent}%</span>
            {item.status === 'completed' && <span className="text-crimson-400">Finished</span>}
            {ago && <span className="text-crimson-700 normal-case tracking-normal">· {ago}</span>}
          </div>
        </div>

        <button
          onClick={handleRemove}
          aria-label="Remove from history"
          className="shrink-0 p-2 rounded-full text-crimson-700 hover:text-white hover:bg-crimson-900/50 transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <div className="shrink-0 p-2 rounded-full bg-crimson-500 text-white shadow-[0_0_10px_rgba(255,0,60,0.5)] group-hover:scale-110 transition-transform">
          <Play className="w-3.5 h-3.5 fill-white" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onOpen}
      className="group relative flex gap-5 p-4 bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 rounded-3xl hover:border-crimson-500/50 hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)] transition-[border-color,box-shadow] duration-300 cursor-pointer overflow-hidden"
    >
      {/* Subtle background glow on hover */}
      <div className="absolute -inset-24 bg-crimson-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none transform-gpu"></div>

      {/* Remove from history (hover) */}
      <button
        onClick={handleRemove}
        aria-label="Remove from history"
        className="absolute top-3 right-3 z-20 p-2 rounded-full bg-crimson-950/80 border border-crimson-900/60 text-crimson-500 hover:text-white hover:border-crimson-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="w-28 sm:w-36 aspect-[2/3] shrink-0 relative rounded-2xl overflow-hidden shadow-2xl border border-crimson-900/50">
        <img src={item.poster} alt={item.title} className="w-full h-full object-cover transform-gpu group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-transparent to-transparent opacity-60"></div>

        {/* Progress Bar (Integrated) */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-crimson-900/80">
          <div
            className="h-full bg-crimson-500 shadow-[0_0_12px_rgba(255,0,60,0.8)] transition-all duration-1000"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>

      <div className="flex flex-col justify-between py-1 flex-grow min-w-0 relative z-10">
        <div className="space-y-2">
          <h4 className="text-base sm:text-lg font-black text-crimson-50 truncate group-hover:text-crimson-400 transition-colors tracking-tight">
            {item.title}
          </h4>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-crimson-500/10 text-crimson-400 text-[10px] font-black uppercase rounded-lg border border-crimson-500/20 tracking-widest">
              {item.media_type === 'movie' ? 'Movie' : item.media_type === 'manga' ? <>Ch. {item.episode_number}</> : <>S{item.season_number} <span className="text-crimson-700 mx-0.5">•</span> E{item.episode_number}</>}
            </span>
            {ago && <span className="text-[10px] font-bold text-crimson-700">{ago}</span>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {percent}%
            </span>
            {item.status === 'completed' && (
              <span className="text-crimson-400 bg-crimson-400/10 px-2 py-0.5 rounded-md border border-crimson-400/20">Finished</span>
            )}
          </div>
          <button
            title={mode === 'upcoming' && nextAirDate ? `Next episode airs ${airDateLabel(nextAirDate)}` : undefined}
            className="flex items-center gap-2.5 text-[10px] font-black text-crimson-50 uppercase tracking-[0.2em] group-hover:translate-x-2 transition-all duration-300"
          >
            <span>{actionLabel}</span>
            <div className="p-1.5 rounded-full bg-crimson-500 shadow-[0_0_10px_rgba(255,0,60,0.5)]">
              <Play className="w-3 h-3 fill-white" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const RecentlyWatchedPage = () => {
  const { recentlyWatched, loading, removeFromHistory } = useAccount();
  const { isAuthenticated } = useAuth();
  useTitle('Recent Echoes');
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState(() => (localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'));
  const [pendingRemove, setPendingRemove] = useState(null); // the item awaiting delete confirmation

  const setViewPersist = (v) => { setView(v); localStorage.setItem(VIEW_KEY, v); };

  const q = query.trim().toLowerCase();

  // Apply the status filter, then the title search. Order is preserved (the
  // server already returns newest-first), so buckets stay chronological.
  const filtered = useMemo(() => {
    return recentlyWatched.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (q && !(item.title || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recentlyWatched, statusFilter, q]);

  // Group the filtered rows into time buckets, dropping any empty bucket.
  const grouped = useMemo(() => {
    const map = new Map(BUCKETS.map((b) => [b, []]));
    for (const item of filtered) map.get(bucketOf(item.updated_at)).push(item);
    return BUCKETS.map((name) => ({ name, items: map.get(name) })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const openItem = (item) => navigate(resumeInfo(item).href);

  const confirmRemove = async () => {
    const item = pendingRemove;
    setPendingRemove(null);
    if (item) await removeFromHistory(item);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <History className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-crimson-50 uppercase">Authentication Required</h2>
          <p className="text-crimson-300 mt-2">You must establish a link to track your watch progress across dimensions.</p>
          <button
            onClick={() => navigate('/account')}
            className="mt-6 px-6 py-2 bg-crimson-500 hover:bg-crimson-400 text-white font-bold rounded-xl transition-all"
          >
            Establish Link
          </button>
        </div>
      </div>
    );
  }

  if (loading && recentlyWatched.length === 0) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Probing Watch History...</p>
      </div>
    );
  }

  const totalCount = recentlyWatched.length;
  const hasHistory = totalCount > 0;

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-10 animate-in fade-in duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-black text-crimson-50 uppercase tracking-tighter leading-none">
            Recent <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">Echoes</span>
          </h1>
          <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
            <History className="w-4 h-4 text-crimson-500" />
            {hasHistory ? `${totalCount} title${totalCount === 1 ? '' : 's'} in your history` : 'Picking up where you left off'}
          </p>
        </div>
      </div>

      {hasHistory && (
        <div className="sticky top-16 z-30 flex flex-col lg:flex-row lg:items-center gap-3 p-3 rounded-2xl border border-crimson-900/60 bg-crimson-950/90 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-700 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your history…"
              className="w-full pl-11 pr-10 py-2.5 text-sm font-bold bg-crimson-950/40 border border-crimson-900/60 rounded-xl text-crimson-50 placeholder:text-crimson-700 focus:outline-none focus:border-crimson-600 transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-crimson-600 hover:text-white transition-colors active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-crimson-950/40 border border-crimson-900/60 shrink-0">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                    active ? 'bg-crimson-600 text-white shadow-[0_4px_12px_rgba(255,0,60,0.25)]' : 'text-crimson-500 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Grid / list view toggle */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-crimson-950/40 border border-crimson-900/60 shrink-0">
            {[
              { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
              { key: 'list', icon: List, label: 'List view' },
            ].map(({ key, icon: Icon, label }) => {
              const active = view === key;
              return (
                <button
                  key={key}
                  onClick={() => setViewPersist(key)}
                  aria-label={label}
                  aria-pressed={active}
                  className={`p-2 rounded-lg transition-all active:scale-95 ${
                    active ? 'bg-crimson-600 text-white shadow-[0_4px_12px_rgba(255,0,60,0.25)]' : 'text-crimson-500 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!hasHistory ? (
        <div className="py-32 text-center space-y-8 bg-crimson-950/20 rounded-[3rem] border border-dashed border-crimson-900/30 backdrop-blur-sm">
          <div className="relative w-20 h-20 mx-auto opacity-30">
            <History className="w-20 h-20 text-crimson-900" />
          </div>
          <div className="space-y-2">
            <p className="text-crimson-500 font-black uppercase tracking-[0.3em] text-sm">No recent echoes detected</p>
            <p className="text-crimson-700 font-medium text-xs">Your journey through the dimensions has yet to begin.</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-10 py-3 bg-crimson-950 border border-crimson-900 text-crimson-500 hover:border-crimson-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
          >
            Start Streaming
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-28 text-center space-y-6 bg-crimson-950/20 rounded-[3rem] border border-dashed border-crimson-900/30 backdrop-blur-sm">
          <div className="relative w-16 h-16 mx-auto opacity-40">
            <Search className="w-16 h-16 text-crimson-900" />
          </div>
          <div className="space-y-2">
            <p className="text-crimson-500 font-black uppercase tracking-[0.3em] text-sm">No echoes match your filters</p>
            <p className="text-crimson-700 font-medium text-xs">
              {q ? <>Nothing matches "<span className="text-crimson-400">{query.trim()}</span>".</> : 'Try a different status filter.'}
            </p>
          </div>
          <button
            onClick={() => { setQuery(''); setStatusFilter('all'); }}
            className="px-10 py-3 bg-crimson-950 border border-crimson-900 text-crimson-500 hover:border-crimson-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => (
            <section key={group.name} className="space-y-5">
              <div className="flex items-center gap-3">
                <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-crimson-500">{group.name}</h2>
                <span className="text-[10px] font-black text-crimson-700 tabular-nums">{group.items.length}</span>
                <div className="flex-1 h-px bg-gradient-to-r from-crimson-900/50 to-transparent"></div>
              </div>
              <div className={view === 'list' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'}>
                {group.items.map((item, idx) => (
                  <HistoryCard
                    key={`${item.anilist_id ?? item.tmdb_id}-${item.season_number}-${item.episode_number}-${idx}`}
                    item={item}
                    view={view}
                    onOpen={() => openItem(item)}
                    onRemove={setPendingRemove}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Remove-from-history confirmation */}
      {pendingRemove && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPendingRemove(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-crimson-950 border border-crimson-900/70 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-7 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-crimson-500/10 border border-crimson-500/30">
                <AlertTriangle className="w-6 h-6 text-crimson-400" />
              </div>
              <h3 className="text-xl font-black text-crimson-50 uppercase tracking-tight">Remove from History?</h3>
            </div>
            <p className="text-sm text-crimson-300 leading-relaxed">
              This permanently erases <span className="font-black text-crimson-100">"{pendingRemove.title}"</span> and all its tracked progress from your watch history. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setPendingRemove(null)}
                className="px-5 py-2.5 rounded-xl border border-crimson-900/60 text-crimson-300 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 text-white text-xs font-black uppercase tracking-widest hover:bg-crimson-500 shadow-[0_8px_20px_rgba(255,0,60,0.3)] transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecentlyWatchedPage;
