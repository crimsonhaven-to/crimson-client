import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, X, LayoutGrid, List, Trash2, AlertTriangle } from 'lucide-react';
import { useAccount } from '../account/useAccount';
import { useAuth } from '../account/useAuth';
import { useTitle } from '../shell/useTitle';
import { BUCKETS, bucketOf } from './historyDates';
import { resumeInfo } from './historyResume';
import HistoryCard from './HistoryCard';

const VIEW_KEY = 'crimson:history-view';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'Watching' },
  { key: 'completed', label: 'Finished' },
];

const RecentlyWatchedPage = () => {
  const { recentlyWatched, loading, removeFromHistory } = useAccount();
  const { isAuthenticated } = useAuth();
  useTitle('Recent Echoes');
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState(() => (localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'));
  const [pendingRemove, setPendingRemove] = useState(null);

  const setViewPersist = (v) => { setView(v); localStorage.setItem(VIEW_KEY, v); };

  const q = query.trim().toLowerCase();

  // The server returns newest-first and filtering keeps order, so buckets stay chronological.
  const filtered = useMemo(() => {
    return recentlyWatched.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (q && !(item.title || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recentlyWatched, statusFilter, q]);

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
                    key={`${item.anilist_id ?? item.tmdb_id ?? item.local_id}-${item.season_number}-${item.episode_number}-${idx}`}
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
