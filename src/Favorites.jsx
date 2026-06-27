import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Play, Trash2, Plus, ListPlus, X, Download, Upload, ChevronDown, Check, AlertTriangle,
  Search, Layers, LayoutGrid, List, Film, Tv, Sparkles, ArrowDownUp, GripVertical, ListChecks,
  Circle, CircleCheck, FolderPlus,
} from 'lucide-react';
import { useWatchlists, useAuth, useTitle, listLabel, DEFAULT_LIST, ALL_LIST } from './hooks';
import { setWatchlistActivity, clearActivity } from './discordPresence';

const VIEW_KEY = 'crimson:watchlist-view';
const SORT_KEY = 'crimson:watchlist-sort';
const ORDER_KEY = 'crimson:watchlist-order'; // per-list manual order: { [listName]: [itemKey, ...] }

// A watchlist row is one of three kinds, inferred the same way the routing does:
// an AniList id means anime, an explicit 'movie' media_type means a movie, and
// everything else is a (TMDB-keyed) show. This is the axis we group + filter on —
// the watchlist equivalent of the history page's time buckets.
const kindOf = (it) => (it.anilist_id != null ? 'anime' : it.media_type === 'movie' ? 'movie' : 'show');

// Stable identity for a row — the same key scheme the backend de-dupes on
// (AniList id preferred, else the TMDB id namespaced by movie vs show).
const itemKey = (it) =>
  it.anilist_id != null ? `a:${it.anilist_id}` : (it.media_type === 'movie' ? `m:${it.tmdb_id}` : `t:${it.tmdb_id}`);

// Per-kind label + icon, rendered as section headers and filter chips. Sections
// always appear in this order; empty ones are skipped.
const TYPE_META = {
  anime: { label: 'Anime', icon: Sparkles },
  show: { label: 'Shows', icon: Tv },
  movie: { label: 'Movies', icon: Film },
};
const TYPE_ORDER = ['anime', 'show', 'movie'];

const SORTS = [
  { key: 'added', label: 'Recent' },   // server order (added_at desc) — the default
  { key: 'title', label: 'A–Z' },
  { key: 'manual', label: 'Manual' },  // drag-to-reorder, persisted per list
];

// Overview route for a show — the same target the grid's Play button uses.
const overviewHref = (it) =>
  it.anilist_id ? `/anime/${it.anilist_id}` : it.media_type === 'movie' ? `/movie/${it.tmdb_id}` : `/show/${it.tmdb_id}`;

const loadOrders = () => {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY)) || {}; } catch { return {}; }
};

// One watchlist entry, rendered as a tall poster card ('grid') or a dense,
// scannable row ('list'). Handles selection (bulk mode) and manual drag-reorder
// on top of the plain open/remove/lists actions.
const ShowCard = ({
  item, view, removable, selectMode, selected, draggable, isDragOver,
  onOpen, onRemove, onLists, onToggleSelect, dragProps,
}) => {
  const kind = kindOf(item);
  const { label: kindLabel, icon: KindIcon } = TYPE_META[kind];
  const stop = (fn) => (e) => { e.stopPropagation(); fn(item); };
  // In bulk-select mode a click anywhere on the card toggles selection instead
  // of navigating; otherwise the card opens the overview.
  const handleClick = selectMode ? () => onToggleSelect(item) : onOpen;

  const SelMark = selected ? CircleCheck : Circle;
  const ring = selected
    ? 'border-crimson-500 shadow-[0_0_0_2px_rgba(255,0,60,0.5)]'
    : isDragOver ? 'border-crimson-400' : 'border-crimson-900/40';

  if (view === 'list') {
    return (
      <div
        {...dragProps}
        onClick={handleClick}
        className={`group relative flex items-center gap-4 p-3 pr-4 bg-crimson-950/30 backdrop-blur-md border rounded-2xl hover:border-crimson-500/50 hover:shadow-[0_10px_25px_rgba(0,0,0,0.35)] transition-[border-color,box-shadow] duration-300 cursor-pointer ${ring} ${isDragOver ? 'ring-2 ring-crimson-500/40' : ''}`}
      >
        {draggable && (
          <span className="shrink-0 -ml-1 text-crimson-700 cursor-grab active:cursor-grabbing" aria-hidden="true">
            <GripVertical className="w-4 h-4" />
          </span>
        )}
        {selectMode && (
          <SelMark className={`shrink-0 w-5 h-5 ${selected ? 'text-crimson-400' : 'text-crimson-700'}`} />
        )}

        <div className="w-12 h-16 shrink-0 relative rounded-lg overflow-hidden border border-crimson-900/50">
          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
        </div>

        <div className="flex-grow min-w-0">
          <h4 className="text-sm sm:text-base font-black text-crimson-50 truncate group-hover:text-crimson-400 transition-colors tracking-tight">
            {item.title}
          </h4>
          <div className="mt-1 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-crimson-600">
            <span className="flex items-center gap-1 text-crimson-400"><KindIcon className="w-3 h-3" />{kindLabel}</span>
            <span className="text-crimson-700 normal-case tracking-normal">· Ref {item.anilist_id || item.tmdb_id}</span>
          </div>
        </div>

        {!selectMode && (
          <>
            <button
              onClick={stop(onLists)}
              aria-label={`Add ${item.title} to a list`}
              className="shrink-0 p-2 rounded-full text-crimson-700 hover:text-white hover:bg-crimson-900/50 transition-all opacity-0 group-hover:opacity-100"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            {removable && (
              <button
                onClick={stop(onRemove)}
                aria-label={`Remove ${item.title}`}
                className="shrink-0 p-2 rounded-full text-crimson-700 hover:text-white hover:bg-crimson-900/50 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="shrink-0 p-2 rounded-full bg-crimson-500 text-white shadow-[0_0_10px_rgba(255,0,60,0.5)] group-hover:scale-110 transition-transform">
              <Play className="w-3.5 h-3.5 fill-white" />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div {...dragProps} className="group relative flex flex-col">
      <div
        onClick={handleClick}
        className={`aspect-[2/3] relative overflow-hidden rounded-2xl border shadow-2xl cursor-pointer transition-[border-color,box-shadow,transform] duration-500 group-hover:border-crimson-500/50 group-hover:shadow-[0_0_30px_rgba(255,0,60,0.2)] ${ring} ${isDragOver ? 'ring-2 ring-crimson-500/50 scale-[0.97]' : ''}`}
      >
        <img
          src={item.poster}
          alt={item.title}
          className="w-full h-full object-cover transform-gpu transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-crimson-950/20 to-transparent opacity-80"></div>

        {/* Kind badge — anime / show / movie at a glance */}
        <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-crimson-950/80 backdrop-blur-md border border-crimson-900/60 text-[8px] font-black uppercase tracking-[0.15em] text-crimson-400">
          <KindIcon className="w-2.5 h-2.5" />
          {kindLabel}
        </div>

        {/* Drag handle (manual sort) */}
        {draggable && !selectMode && (
          <div className="absolute top-2.5 right-2.5 p-1 rounded-md bg-crimson-950/80 border border-crimson-900/60 text-crimson-500 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Selection indicator (bulk mode) */}
        {selectMode && (
          <div className="absolute top-2.5 right-2.5">
            <SelMark className={`w-6 h-6 drop-shadow ${selected ? 'text-crimson-400' : 'text-white/80'}`} />
          </div>
        )}

        {/* Actions Overlay — suppressed in select mode (the card itself toggles) */}
        {!selectMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-crimson-950/40 backdrop-blur-[2px]">
            <button
              onClick={stop(onOpen)}
              aria-label={`Open ${item.title}`}
              className="p-4 bg-crimson-500 text-white rounded-full hover:bg-crimson-400 transform hover:scale-110 transition-all shadow-[0_10px_20px_rgba(255,0,60,0.4)]"
            >
              <Play className="w-6 h-6 fill-current" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={stop(onLists)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-crimson-950/80 text-[10px] font-black uppercase tracking-widest text-crimson-400 rounded-full border border-crimson-900 hover:text-white hover:border-crimson-600 transition-all"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Lists</span>
              </button>
              {removable && (
                <button
                  onClick={stop(onRemove)}
                  aria-label={`Remove ${item.title}`}
                  className="p-2 bg-crimson-950/80 text-crimson-400 rounded-full border border-crimson-900 hover:text-white hover:border-crimson-600 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 px-1">
        <h4 className="text-sm font-bold text-crimson-50 line-clamp-1 group-hover:text-crimson-400 transition-colors tracking-tight">
          {item.title}
        </h4>
      </div>
    </div>
  );
};

// Watchlists page (formerly "Favorites"). Lists run along the top as tabs; the
// active list's shows render below, grouped by kind (anime / shows / movies),
// sortable, bulk-editable, and switchable between a poster grid and a list view.
const FavoritesPage = () => {
  const {
    items, lists, loading,
    addToList, removeFromList, toggleInList, listsForItem,
    createList, deleteList, exportWatchlists, importWatchlists,
  } = useWatchlists();
  const { isAuthenticated } = useAuth();
  useTitle('Watchlists');
  const navigate = useNavigate();

  const [activeList, setActiveList] = useState(ALL_LIST);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [view, setView] = useState(() => (localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'));
  const [sort, setSort] = useState(() => localStorage.getItem(SORT_KEY) || 'added');
  const [orders, setOrders] = useState(loadOrders);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingDeleteList, setPendingDeleteList] = useState(null); // list name awaiting delete confirmation
  const [listModal, setListModal] = useState(null); // { mode:'item', item } | { mode:'bulk' }
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  // Bulk-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  // Drag-reorder state (manual sort only)
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);

  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState(null); // { ok, text }
  const importRef = useRef(null);
  const fileRef = useRef(null);
  const importModeRef = useRef('merge');

  const setViewPersist = (v) => { setView(v); localStorage.setItem(VIEW_KEY, v); };
  const setSortPersist = (s) => { setSort(s); localStorage.setItem(SORT_KEY, s); };
  const saveOrders = (o) => { setOrders(o); localStorage.setItem(ORDER_KEY, JSON.stringify(o)); };

  // Close the export / import menus on any outside click.
  useEffect(() => {
    if (!exportOpen && !importOpen) return;
    const onClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
      if (importRef.current && !importRef.current.contains(e.target)) setImportOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [exportOpen, importOpen]);

  // Broadcast a "combing the watchlists" Discord Rich Presence while this page is
  // open (opt-in; see discordPresence.js), clearing back to browsing on unmount.
  useEffect(() => {
    setWatchlistActivity();
    return () => clearActivity();
  }, []);

  const handleExport = async (format) => {
    setExportOpen(false);
    setExporting(true);
    await exportWatchlists(format);
    setExporting(false);
  };

  // Pick an import mode, then open the file dialog. 'replace' wipes every list,
  // so confirm before letting the user choose a file.
  const handlePickImport = (mode) => {
    setImportOpen(false);
    if (mode === 'replace' && !window.confirm(
      'Replace ALL your watchlists with the contents of this file? Your current lists are deleted first — this cannot be undone.'
    )) return;
    importModeRef.current = mode;
    setImportMsg(null);
    fileRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-selecting the same file fires onChange again
    if (!file) return;
    setImporting(true);
    const res = await importWatchlists(file, importModeRef.current);
    setImporting(false);
    if (res.ok) {
      const parts = [`Imported ${res.imported} item${res.imported === 1 ? '' : 's'}`];
      if (res.skipped) parts.push(`skipped ${res.skipped}`);
      setImportMsg({ ok: true, text: `${parts.join(', ')}.` });
    } else {
      setImportMsg({ ok: false, text: res.error || 'Import failed.' });
    }
  };

  // The virtual "All" list: every show across every list, de-duplicated by item key.
  const allShows = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = itemKey(it);
      if (!map.has(key)) map.set(key, it);
    }
    return Array.from(map.values());
  }, [items]);

  // First few posters per list, used for the collage backdrop on each tab.
  const collageByList = useMemo(() => {
    const m = {};
    for (const it of items) {
      const arr = (m[it.list_name] ||= []);
      if (arr.length < 4 && it.poster) arr.push(it.poster);
    }
    m[ALL_LIST] = allShows.slice(0, 4).map((s) => s.poster).filter(Boolean);
    return m;
  }, [items, allShows]);

  // Tabs rendered on the page: the read-only "All" aggregate first, then the
  // real lists from the hook (which never includes ALL_LIST).
  const displayLists = useMemo(
    () => [{ name: ALL_LIST, count: allShows.length }, ...lists],
    [lists, allShows.length]
  );

  // Derive the list actually shown: if the selected one vanished (e.g. it was just
  // deleted) fall back to "All", without an extra effect/render.
  const effectiveList = displayLists.some(l => l.name === activeList) ? activeList : ALL_LIST;

  const shows = useMemo(
    () => (effectiveList === ALL_LIST ? allShows : items.filter(i => i.list_name === effectiveList)),
    [items, effectiveList, allShows]
  );

  // Which kinds actually appear in the active list — used to render only the
  // relevant filter chips (no "Movies" chip on an all-anime list).
  const presentTypes = useMemo(() => {
    const set = new Set(shows.map(kindOf));
    return TYPE_ORDER.filter(k => set.has(k));
  }, [shows]);

  // A stale type filter (e.g. "Movies" after switching to an all-anime list)
  // would silently hide everything — fall back to "all" when it no longer applies.
  const effectiveType = typeFilter === 'all' || presentTypes.includes(typeFilter) ? typeFilter : 'all';

  // Narrow the visible shows by kind, then by the search query (title substring).
  const q = query.trim().toLowerCase();
  const filteredShows = useMemo(
    () => shows.filter(s =>
      (effectiveType === 'all' || kindOf(s) === effectiveType) &&
      (!q || (s.title || '').toLowerCase().includes(q))
    ),
    [shows, effectiveType, q]
  );

  // Apply the chosen sort. 'added' keeps the server order; 'title' is alphabetical;
  // 'manual' honours the drag-reordered key sequence stored for this list (items
  // without a stored position sink to the end, preserving their added order).
  const sorted = useMemo(() => {
    const arr = [...filteredShows];
    if (sort === 'title') {
      arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sort === 'manual') {
      const ord = orders[effectiveList] || [];
      const idx = new Map(ord.map((k, i) => [k, i]));
      arr.sort((a, b) => (idx.get(itemKey(a)) ?? Infinity) - (idx.get(itemKey(b)) ?? Infinity));
    }
    return arr;
  }, [filteredShows, sort, orders, effectiveList]);

  // Group the sorted shows into kind sections, dropping any empty section.
  const grouped = useMemo(() => {
    const map = { anime: [], show: [], movie: [] };
    for (const s of sorted) map[kindOf(s)].push(s);
    return TYPE_ORDER.map(k => ({ key: k, ...TYPE_META[k], items: map[k] })).filter(g => g.items.length > 0);
  }, [sorted]);

  // Drag-reorder is only safe with the full list visible (no search/type filter),
  // so a reorder always describes the complete sequence we persist.
  const canDrag = sort === 'manual' && !selectMode && effectiveType === 'all' && !q && effectiveList !== ALL_LIST;

  const commitReorder = (from, to) => {
    if (!from || !to || from === to) return;
    const byKey = new Map(sorted.map(s => [itemKey(s), s]));
    // Keep reorders within a single kind section — cross-kind drops would have no
    // visible effect (sections render separately) and only muddy the order.
    if (kindOf(byKey.get(from)) !== kindOf(byKey.get(to))) return;
    const seq = sorted.map(itemKey);
    const fi = seq.indexOf(from);
    seq.splice(fi, 1);
    const ti = seq.indexOf(to);
    seq.splice(ti, 0, from);
    saveOrders({ ...orders, [effectiveList]: seq });
  };

  const dragPropsFor = (item) => {
    if (!canDrag) return {};
    const k = itemKey(item);
    return {
      draggable: true,
      onDragStart: (e) => { setDragKey(k); e.dataTransfer.effectAllowed = 'move'; },
      onDragEnter: () => { if (dragKey && dragKey !== k) setOverKey(k); },
      onDragOver: (e) => e.preventDefault(),
      onDrop: (e) => { e.preventDefault(); commitReorder(dragKey, k); setDragKey(null); setOverKey(null); },
      onDragEnd: () => { setDragKey(null); setOverKey(null); },
    };
  };

  // --- bulk-select helpers ---
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

  // --- list-membership modal (single item or the whole selection) ---
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

  // Switch tabs, dropping any selection so it can't bleed across lists.
  const switchList = (name) => { setActiveList(name); setSelected(new Set()); };

  const handleCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createList(name);
    switchList(name);
    setNewName('');
    setCreating(false);
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
          <h2 className="text-2xl font-black text-white uppercase">Authentication Required</h2>
          <p className="text-crimson-300 mt-2">You must establish a link to view your watchlists.</p>
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
            <h1 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tighter leading-none">
              Your <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">Watchlists</span>
            </h1>
            <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
              <Heart className="w-4 h-4 text-crimson-500 fill-crimson-500" />
              {totalCount} item{totalCount === 1 ? '' : 's'} across {lists.length} list{lists.length === 1 ? '' : 's'}
            </p>
          </div>

          {/* Import / export every list at once */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Import from a previously-exported CSV/JSON file */}
            <div ref={importRef} className="relative">
              <button
                onClick={() => setImportOpen(o => !o)}
                disabled={importing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-crimson-900/60 bg-crimson-950/40 text-crimson-300 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <Upload className={`w-4 h-4 ${importing ? 'animate-pulse' : ''}`} />
                <span>{importing ? 'Importing…' : 'Import'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${importOpen ? 'rotate-180' : ''}`} />
              </button>

              {importOpen && (
                <div className="absolute right-0 mt-2 w-52 z-20 rounded-xl border border-crimson-900/60 bg-crimson-950 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => handlePickImport('merge')}
                    className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-crimson-200 hover:bg-crimson-900/50 hover:text-white transition-colors"
                  >
                    <span>Merge</span>
                    <span className="text-[9px] text-crimson-600 uppercase tracking-wider">Add to lists</span>
                  </button>
                  <button
                    onClick={() => handlePickImport('replace')}
                    className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-crimson-200 hover:bg-crimson-900/50 hover:text-white transition-colors border-t border-crimson-900/40"
                  >
                    <span>Replace</span>
                    <span className="text-[9px] text-crimson-600 uppercase tracking-wider">Wipe &amp; restore</span>
                  </button>
                </div>
              )}
            </div>

            {/* Export every list at once (CSV for spreadsheets, JSON for a backup) */}
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setExportOpen(o => !o)}
                disabled={exporting || totalCount === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-crimson-900/60 bg-crimson-950/40 text-crimson-300 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
                <span>{exporting ? 'Exporting…' : 'Export'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>

              {exportOpen && (
                <div className="absolute right-0 mt-2 w-44 z-20 rounded-xl border border-crimson-900/60 bg-crimson-950 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-crimson-200 hover:bg-crimson-900/50 hover:text-white transition-colors"
                  >
                    <span>CSV</span>
                    <span className="text-[9px] text-crimson-600 uppercase tracking-wider">Spreadsheet</span>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-crimson-200 hover:bg-crimson-900/50 hover:text-white transition-colors border-t border-crimson-900/40"
                  >
                    <span>JSON</span>
                    <span className="text-[9px] text-crimson-600 uppercase tracking-wider">Backup</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Hidden file input that the Import menu triggers. */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {/* Import result banner */}
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

        {/* List tabs — each carries a faint collage of its first few posters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {displayLists.map((l) => {
            const active = l.name === effectiveList;
            const posters = collageByList[l.name] || [];
            return (
              <button
                key={l.name}
                onClick={() => switchList(l.name)}
                className={`group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
                  active
                    ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_8px_20px_rgba(255,0,60,0.25)]'
                    : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600'
                }`}
              >
                {/* Poster collage backdrop */}
                {posters.length > 0 && (
                  <span aria-hidden="true" className="absolute inset-0 flex pointer-events-none">
                    {posters.map((p, i) => (
                      <span key={i} className="flex-1 bg-cover bg-center" style={{ backgroundImage: `url(${p})` }} />
                    ))}
                    <span className={`absolute inset-0 ${active ? 'bg-crimson-600/80' : 'bg-crimson-950/85 group-hover:bg-crimson-950/75'} transition-colors`} />
                  </span>
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {l.name === ALL_LIST && <Layers className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-crimson-500'}`} />}
                  {l.name === DEFAULT_LIST && <Heart className={`w-3.5 h-3.5 ${active ? 'fill-white' : 'fill-crimson-700 text-crimson-500'}`} />}
                  <span>{listLabel(l.name)}</span>
                  <span className={`text-[10px] tabular-nums ${active ? 'text-crimson-100/90' : 'text-crimson-600'}`}>{l.count}</span>
                </span>
              </button>
            );
          })}

          {/* Create new list */}
          {creating ? (
            <form onSubmit={handleCreate} className="inline-flex items-center gap-2">
              <div className="relative">
                <ListPlus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-crimson-700 pointer-events-none" />
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={() => { if (!newName.trim()) setCreating(false); }}
                  maxLength={100}
                  placeholder="List name…"
                  className="w-40 pl-8 pr-2 py-2 text-xs font-bold bg-crimson-950/60 border border-crimson-900/60 rounded-xl text-white placeholder:text-crimson-700 focus:outline-none focus:border-crimson-600 transition-colors"
                />
              </div>
              <button type="submit" disabled={!newName.trim()} aria-label="Create list"
                className="p-2 rounded-xl bg-crimson-600 text-white hover:bg-crimson-500 disabled:opacity-40 transition-all active:scale-95">
                <Plus className="w-4 h-4" strokeWidth={3} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-crimson-800/70 text-crimson-500 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
              <span>New List</span>
            </button>
          )}

          {/* Delete the active custom list (never the default or the virtual "All") */}
          {effectiveList !== DEFAULT_LIST && effectiveList !== ALL_LIST && (
            <button
              onClick={() => setPendingDeleteList(effectiveList)}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-crimson-900/60 text-crimson-600 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-crimson-500 hover:bg-crimson-900/30 transition-all active:scale-95"
            >
              <X className="w-3.5 h-3.5" strokeWidth={3} />
              <span>Delete "{listLabel(effectiveList)}"</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: search + type filter + sort + select + view toggle. Sticks beneath
          the nav so it stays reachable while scrolling a long list. */}
      {shows.length > 0 && (
        <div className="sticky top-16 z-30 flex flex-col lg:flex-row lg:items-center gap-3 p-3 rounded-2xl border border-crimson-900/60 bg-crimson-950/90 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          {/* Search within the active list */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-700 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search "${listLabel(effectiveList)}"…`}
              className="w-full pl-11 pr-10 py-2.5 text-sm font-bold bg-crimson-950/40 border border-crimson-900/60 rounded-xl text-white placeholder:text-crimson-700 focus:outline-none focus:border-crimson-600 transition-colors"
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
            {/* Type filter chips — only when the list mixes more than one kind */}
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

            {/* Sort control */}
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

            {/* Bulk-select toggle */}
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
        </div>
      )}

      {/* Manual-sort hint when a filter would make a drag ambiguous */}
      {sort === 'manual' && !selectMode && shows.length > 1 && !canDrag && effectiveList !== ALL_LIST && (
        <p className="-mt-4 text-[10px] font-black uppercase tracking-widest text-crimson-700">
          Clear the search & type filter to drag items into a custom order.
        </p>
      )}
      {sort === 'manual' && effectiveList === ALL_LIST && shows.length > 1 && (
        <p className="-mt-4 text-[10px] font-black uppercase tracking-widest text-crimson-700">
          Manual ordering is saved per list — pick a specific list to rearrange it.
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
                      <ShowCard
                        key={k}
                        item={item}
                        view={view}
                        removable={effectiveList !== ALL_LIST}
                        selectMode={selectMode}
                        selected={selected.has(k)}
                        draggable={canDrag}
                        isDragOver={overKey === k && dragKey !== k}
                        dragProps={dragPropsFor(item)}
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

      {/* Bulk action bar — floats at the bottom while selecting */}
      {selectMode && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3 p-2.5 pl-4 rounded-2xl border border-crimson-700/50 bg-crimson-950/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            <span className="text-xs font-black uppercase tracking-widest text-crimson-300 tabular-nums">
              {selected.size} selected
            </span>
            <button
              onClick={selected.size === sorted.length ? clearSelection : selectAllVisible}
              className="text-[10px] font-black uppercase tracking-widest text-crimson-600 hover:text-crimson-300 transition-colors"
            >
              {selected.size === sorted.length ? 'Clear' : 'Select all'}
            </button>

            <div className="flex-1" />

            <button
              onClick={() => selected.size && setListModal({ mode: 'bulk' })}
              disabled={!selected.size}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-crimson-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-crimson-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_20px_rgba(255,0,60,0.3)] transition-all active:scale-95"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Add to list</span>
            </button>
            {effectiveList !== ALL_LIST && (
              <button
                onClick={bulkRemove}
                disabled={!selected.size}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-crimson-900/60 text-crimson-300 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-crimson-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove</span>
              </button>
            )}
            <button
              onClick={exitSelectMode}
              aria-label="Done selecting"
              className="p-2 rounded-xl text-crimson-600 hover:text-white hover:bg-crimson-900/50 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* List-membership modal — add/remove one item, or add the selection in bulk */}
      {listModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setListModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-crimson-950 border border-crimson-900/70 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-7 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-crimson-500/10 border border-crimson-500/30">
                <FolderPlus className="w-6 h-6 text-crimson-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight">
                  {listModal.mode === 'bulk' ? `Add ${modalItems.length} to a list` : 'Manage lists'}
                </h3>
                {listModal.mode === 'item' && (
                  <p className="text-xs text-crimson-500 font-bold truncate">{listModal.item.title}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
              {lists.map((l) => {
                const inList = listModal.mode === 'item' && listsForItem(listModal.item).includes(l.name);
                return (
                  <button
                    key={l.name}
                    onClick={() => (listModal.mode === 'bulk' ? handleBulkAddToList(l.name) : handleToggleItemInList(l.name))}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-crimson-900/50 bg-crimson-950/40 text-left hover:border-crimson-600 hover:bg-crimson-900/30 transition-all active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {l.name === DEFAULT_LIST
                        ? <Heart className="w-4 h-4 shrink-0 text-crimson-500 fill-crimson-700" />
                        : <ListPlus className="w-4 h-4 shrink-0 text-crimson-600" />}
                      <span className="font-black text-sm text-crimson-100 truncate">{listLabel(l.name)}</span>
                      <span className="text-[10px] font-black text-crimson-700 tabular-nums">{l.count}</span>
                    </span>
                    {listModal.mode === 'item'
                      ? (inList
                          ? <CircleCheck className="w-5 h-5 shrink-0 text-crimson-400" />
                          : <Circle className="w-5 h-5 shrink-0 text-crimson-800" />)
                      : <Plus className="w-4 h-4 shrink-0 text-crimson-500" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                onClick={() => setListModal(null)}
                className="px-5 py-2.5 rounded-xl bg-crimson-600 text-white text-xs font-black uppercase tracking-widest hover:bg-crimson-500 shadow-[0_8px_20px_rgba(255,0,60,0.3)] transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-list confirmation */}
      {pendingDeleteList && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPendingDeleteList(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-crimson-950 border border-crimson-900/70 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-7 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-crimson-500/10 border border-crimson-500/30">
                <AlertTriangle className="w-6 h-6 text-crimson-400" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Delete this list?</h3>
            </div>
            <p className="text-sm text-crimson-300 leading-relaxed">
              The <span className="font-black text-crimson-100">"{listLabel(pendingDeleteList)}"</span> list will be removed and its shows unbound from it. The shows themselves stay in any other lists. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setPendingDeleteList(null)}
                className="px-5 py-2.5 rounded-xl border border-crimson-900/60 text-crimson-300 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteList}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 text-white text-xs font-black uppercase tracking-widest hover:bg-crimson-500 shadow-[0_8px_20px_rgba(255,0,60,0.3)] transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                Delete List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
