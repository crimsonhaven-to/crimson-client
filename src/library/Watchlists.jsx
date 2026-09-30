import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, X, Check, AlertTriangle, Search, LayoutGrid, List, ArrowDownUp, ListChecks,
} from 'lucide-react';
import { useWatchlists, listLabel, DEFAULT_LIST, ALL_LIST } from './watchlists';
import { kindOf, itemKey, overviewHref, TYPE_META, TYPE_ORDER } from './watchlistItem';
import { useManualOrder } from './useManualOrder';
import WatchlistCard from './WatchlistCard';
import WatchlistTransfer from './WatchlistTransfer';
import WatchlistTabs from './WatchlistTabs';
import SelectionBar from './SelectionBar';
import ListPickerDialog from './ListPickerDialog';
import DeleteListDialog from './DeleteListDialog';
import { useAuth } from '../account/useAuth';
import { useTitle } from '../shell/useTitle';
import { setWatchlistActivity, clearActivity } from '../discordPresence';

const VIEW_KEY = 'crimson:watchlist-view';
const SORT_KEY = 'crimson:watchlist-sort';

const SORTS = [
  { key: 'added', label: 'Recent' },   // server order (added_at desc)
  { key: 'title', label: 'A-Z' },
  { key: 'manual', label: 'Manual' },
];

const WatchlistsPage = () => {
  const {
    items, lists, loading,
    addToList, removeFromList, toggleInList, listsForItem,
    createList, deleteList, exportWatchlists, importWatchlists,
  } = useWatchlists();
  const { isAuthenticated } = useAuth();
  useTitle('Favorites');
  const navigate = useNavigate();

  const [activeList, setActiveList] = useState(ALL_LIST);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [view, setView] = useState(() => (localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'));
  const [sort, setSort] = useState(() => localStorage.getItem(SORT_KEY) || 'added');
  const [pendingDeleteList, setPendingDeleteList] = useState(null);
  const [listModal, setListModal] = useState(null); // { mode:'item', item } | { mode:'bulk' }
  const [importMsg, setImportMsg] = useState(null); // { ok, text }

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const setViewPersist = (v) => { setView(v); localStorage.setItem(VIEW_KEY, v); };
  const setSortPersist = (s) => { setSort(s); localStorage.setItem(SORT_KEY, s); };

  // Opt-in, see src/discordPresence.js.
  useEffect(() => {
    setWatchlistActivity();
    return () => clearActivity();
  }, []);

  const allShows = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = itemKey(it);
      if (!map.has(key)) map.set(key, it);
    }
    return Array.from(map.values());
  }, [items]);

  const collageByList = useMemo(() => {
    const m = {};
    for (const it of items) {
      const arr = (m[it.list_name] ||= []);
      if (arr.length < 4 && it.poster) arr.push(it.poster);
    }
    m[ALL_LIST] = allShows.slice(0, 4).map((s) => s.poster).filter(Boolean);
    return m;
  }, [items, allShows]);

  const displayLists = useMemo(
    () => [{ name: ALL_LIST, count: allShows.length }, ...lists],
    [lists, allShows.length]
  );

  // If the selected list vanished (e.g. just deleted), fall back to "All" without an extra effect.
  const effectiveList = displayLists.some(l => l.name === activeList) ? activeList : ALL_LIST;

  const { order, dragPropsFor, isDragOver } = useManualOrder(effectiveList);

  const shows = useMemo(
    () => (effectiveList === ALL_LIST ? allShows : items.filter(i => i.list_name === effectiveList)),
    [items, effectiveList, allShows]
  );

  const presentTypes = useMemo(() => {
    const set = new Set(shows.map(kindOf));
    return TYPE_ORDER.filter(k => set.has(k));
  }, [shows]);

  // A stale type filter (e.g. "Movies" after switching to an all-anime list)
  // would silently hide everything, so fall back to "all" when it no longer applies.
  const effectiveType = typeFilter === 'all' || presentTypes.includes(typeFilter) ? typeFilter : 'all';

  const q = query.trim().toLowerCase();
  const filteredShows = useMemo(
    () => shows.filter(s =>
      (effectiveType === 'all' || kindOf(s) === effectiveType) &&
      (!q || (s.title || '').toLowerCase().includes(q))
    ),
    [shows, effectiveType, q]
  );

  // Items without a stored manual position sink to the end, keeping their added order.
  const sorted = useMemo(() => {
    const arr = [...filteredShows];
    if (sort === 'title') {
      arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sort === 'manual') {
      const idx = new Map((order || []).map((k, i) => [k, i]));
      arr.sort((a, b) => (idx.get(itemKey(a)) ?? Infinity) - (idx.get(itemKey(b)) ?? Infinity));
    }
    return arr;
  }, [filteredShows, sort, order]);

  const grouped = useMemo(() => {
    const map = { anime: [], show: [], movie: [], manga: [] };
    for (const s of sorted) map[kindOf(s)].push(s);
    return TYPE_ORDER.map(k => ({ key: k, ...TYPE_META[k], items: map[k] })).filter(g => g.items.length > 0);
  }, [sorted]);

  // Drag-reorder is only safe with the full list visible (no search/type filter),
  // so a reorder always describes the complete sequence we persist.
  const canDrag = sort === 'manual' && !selectMode && effectiveType === 'all' && !q && effectiveList !== ALL_LIST;

  const toggleSelect = (item) => {
    setSelected(prev => {
      const next = new Set(prev);
      const k = itemKey(item);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const selectAllVisible = () => setSelected(new Set(sorted.map(itemKey)));
  const clearSelection = () => setSelected(new Set());
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };
  const selectedItems = useMemo(() => shows.filter(s => selected.has(itemKey(s))), [shows, selected]);

  const bulkRemove = async () => {
    if (effectiveList === ALL_LIST) return;
    const targets = [...selectedItems];
    clearSelection();
    for (const t of targets) await removeFromList(t, effectiveList);
  };

  const modalItems = listModal?.mode === 'bulk' ? selectedItems : (listModal?.item ? [listModal.item] : []);
  const handleToggleItemInList = (listName) => {
    if (listModal?.mode === 'item' && listModal.item) {
      toggleInList(listModal.item, listName);
    }
  };
  const handleBulkAddToList = async (listName) => {
    const targets = [...selectedItems];
    setListModal(null);
    exitSelectMode();
    for (const t of targets) await addToList(t, listName);
  };

  // Drop the selection so it can't bleed across lists.
  const switchList = (name) => { setActiveList(name); setSelected(new Set()); };

  const createAndOpenList = (name) => {
    createList(name);
    switchList(name);
  };

  const confirmDeleteList = async () => {
    const name = pendingDeleteList;
    setPendingDeleteList(null);
    if (!name || name === DEFAULT_LIST || name === ALL_LIST) return;
    await deleteList(name);
    switchList(DEFAULT_LIST);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <Heart className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-crimson-50 uppercase">Authentication Required</h2>
          <p className="text-crimson-300 mt-2">You must establish a link to view your favorites.</p>
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

  if (loading && items.length === 0) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Retrieving Watchlists...</p>
      </div>
    );
  }

  const totalCount = items.length;

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-10 animate-in fade-in duration-1000">
      <div className="border-b border-crimson-900/30 pb-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black text-crimson-50 uppercase tracking-tighter leading-none">
              Your <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">Favorites</span>
            </h1>
            <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
              <Heart className="w-4 h-4 text-crimson-500 fill-crimson-500" />
              {totalCount} item{totalCount === 1 ? '' : 's'} across {lists.length} list{lists.length === 1 ? '' : 's'}
            </p>
          </div>

          <WatchlistTransfer
            exportWatchlists={exportWatchlists}
            importWatchlists={importWatchlists}
            canExport={totalCount > 0}
            onImportMessage={setImportMsg}
          />
        </div>

        {importMsg && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-bold ${
              importMsg.ok
                ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300'
                : 'border-crimson-700/60 bg-crimson-950/40 text-crimson-300'
            }`}
          >
            {importMsg.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{importMsg.text}</span>
            <button onClick={() => setImportMsg(null)} aria-label="Dismiss" className="text-current/60 hover:text-current transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <WatchlistTabs
          lists={displayLists}
          collageByList={collageByList}
          activeList={effectiveList}
          onSwitch={switchList}
          onCreate={createAndOpenList}
          onDelete={setPendingDeleteList}
        />
      </div>

      {shows.length > 0 && (
        <div className="sticky top-16 z-30 flex flex-col lg:flex-row lg:items-center gap-3 p-3 rounded-2xl border border-crimson-900/60 bg-crimson-950/90 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-700 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search "${listLabel(effectiveList)}"…`}
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

          <div className="flex items-center gap-3 flex-wrap">
            {presentTypes.length > 1 && (
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-crimson-950/40 border border-crimson-900/60 shrink-0">
                {['all', ...presentTypes].map((key) => {
                  const active = effectiveType === key;
                  const label = key === 'all' ? 'All' : TYPE_META[key].label;
                  return (
                    <button
                      key={key}
                      onClick={() => setTypeFilter(key)}
                      className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                        active ? 'bg-crimson-600 text-white shadow-[0_4px_12px_rgba(255,0,60,0.25)]' : 'text-crimson-500 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-crimson-950/40 border border-crimson-900/60 shrink-0">
              <ArrowDownUp className="w-3.5 h-3.5 text-crimson-700 ml-1.5" />
              {SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSortPersist(s.key)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                      active ? 'bg-crimson-600 text-white shadow-[0_4px_12px_rgba(255,0,60,0.25)]' : 'text-crimson-500 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              aria-pressed={selectMode}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shrink-0 ${
                selectMode
                  ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_4px_12px_rgba(255,0,60,0.25)]'
                  : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-500 hover:text-white hover:border-crimson-600'
              }`}
            >
              <ListChecks className="w-4 h-4" />
              <span className="hidden sm:inline">{selectMode ? 'Done' : 'Select'}</span>
            </button>

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
        </div>
      )}

      {sort === 'manual' && !selectMode && shows.length > 1 && !canDrag && effectiveList !== ALL_LIST && (
        <p className="-mt-4 text-[10px] font-black uppercase tracking-widest text-crimson-700">
          Clear the search & type filter to drag items into a custom order.
        </p>
      )}
      {sort === 'manual' && effectiveList === ALL_LIST && shows.length > 1 && (
        <p className="-mt-4 text-[10px] font-black uppercase tracking-widest text-crimson-700">
          Manual ordering is saved per list. Pick a specific list to rearrange it.
        </p>
      )}

      {shows.length === 0 ? (
        <div className="py-32 text-center space-y-8 bg-crimson-950/20 rounded-[3rem] border border-dashed border-crimson-900/30 backdrop-blur-sm">
          <div className="relative w-20 h-20 mx-auto">
             <div className="absolute inset-0 bg-crimson-500/10 blur-2xl rounded-full"></div>
             <Heart className="relative w-20 h-20 text-crimson-950 fill-crimson-900/20" />
          </div>
          <div className="space-y-2">
            <p className="text-crimson-500 font-black uppercase tracking-[0.3em] text-sm">
              "{listLabel(effectiveList)}" is currently empty
            </p>
            <p className="text-crimson-700 font-medium text-xs">Add shows to this list from any overview or watch page.</p>
          </div>
          <button
            onClick={() => navigate('/catalogue')}
            className="px-10 py-3 bg-crimson-950 border border-crimson-900 text-crimson-500 hover:border-crimson-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
          >
            Explore the Catalogue
          </button>
        </div>
      ) : filteredShows.length === 0 ? (
        <div className="py-28 text-center space-y-6 bg-crimson-950/20 rounded-[3rem] border border-dashed border-crimson-900/30 backdrop-blur-sm">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 bg-crimson-500/10 blur-2xl rounded-full"></div>
            <Search className="relative w-16 h-16 text-crimson-900" />
          </div>
          <div className="space-y-2">
            <p className="text-crimson-500 font-black uppercase tracking-[0.3em] text-sm">
              No matches in "{listLabel(effectiveList)}"
            </p>
            <p className="text-crimson-700 font-medium text-xs">
              {q
                ? <>Nothing here matches "<span className="text-crimson-400">{query.trim()}</span>".</>
                : 'Try a different type filter.'}
            </p>
          </div>
          <button
            onClick={() => { setQuery(''); setTypeFilter('all'); }}
            className="px-10 py-3 bg-crimson-950 border border-crimson-900 text-crimson-500 hover:border-crimson-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.key} className="space-y-5">
                <div className="flex items-center gap-3">
                  <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-crimson-500">
                    <Icon className="w-3.5 h-3.5" /> {group.label}
                  </h2>
                  <span className="text-[10px] font-black text-crimson-700 tabular-nums">{group.items.length}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-crimson-900/50 to-transparent"></div>
                </div>
                <div className={view === 'list'
                  ? 'space-y-3'
                  : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 sm:gap-8'}
                >
                  {group.items.map((item) => {
                    const k = itemKey(item);
                    return (
                      <WatchlistCard
                        key={k}
                        item={item}
                        view={view}
                        removable={effectiveList !== ALL_LIST}
                        selectMode={selectMode}
                        selected={selected.has(k)}
                        draggable={canDrag}
                        isDragOver={isDragOver(k)}
                        dragProps={canDrag ? dragPropsFor(item, sorted) : {}}
                        onOpen={() => navigate(overviewHref(item))}
                        onRemove={() => removeFromList(item, effectiveList)}
                        onLists={() => setListModal({ mode: 'item', item })}
                        onToggleSelect={toggleSelect}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selectMode && (
        <SelectionBar
          selectedCount={selected.size}
          allSelected={selected.size === sorted.length}
          onToggleAll={selected.size === sorted.length ? clearSelection : selectAllVisible}
          onAddToList={() => setListModal({ mode: 'bulk' })}
          onRemove={effectiveList !== ALL_LIST ? bulkRemove : undefined}
          onDone={exitSelectMode}
        />
      )}

      {listModal && (
        <ListPickerDialog
          mode={listModal.mode}
          item={listModal.item}
          bulkCount={modalItems.length}
          lists={lists}
          listsForItem={listsForItem}
          onPick={listModal.mode === 'bulk' ? handleBulkAddToList : handleToggleItemInList}
          onClose={() => setListModal(null)}
        />
      )}

      {pendingDeleteList && (
        <DeleteListDialog
          name={pendingDeleteList}
          onCancel={() => setPendingDeleteList(null)}
          onConfirm={confirmDeleteList}
        />
      )}
    </div>
  );
};

export default WatchlistsPage;
