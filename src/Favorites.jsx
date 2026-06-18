import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Play, Trash2, Plus, ListPlus, X, Download, Upload, ChevronDown, Check, AlertTriangle, Search, Layers } from 'lucide-react';
import { useWatchlists, useAuth, useTitle, listLabel, DEFAULT_LIST, ALL_LIST } from './hooks';

// Watchlists page (formerly "Favorites"). Lists run along the top as tabs; the
// active list's shows render in the grid below. Users can spin up new lists,
// remove a show from the current list, or delete an entire custom list.
const FavoritesPage = () => {
  const { items, lists, loading, removeFromList, createList, deleteList, exportWatchlists, importWatchlists } = useWatchlists();
  const { isAuthenticated } = useAuth();
  useTitle('Watchlists');
  const navigate = useNavigate();

  const [activeList, setActiveList] = useState(ALL_LIST);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState(null); // { ok, text }
  const importRef = useRef(null);
  const fileRef = useRef(null);
  const importModeRef = useRef('merge');

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

  // The virtual "All" list: every show across every list, de-duplicated by the
  // same identity key the backend uses (AniList id preferred, else TMDB id).
  const allShows = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = it.anilist_id != null ? `a:${it.anilist_id}` : `t:${it.tmdb_id}`;
      if (!map.has(key)) map.set(key, it);
    }
    return Array.from(map.values());
  }, [items]);

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

  // Narrow the visible shows by the search query (title substring, case-insensitive).
  const q = query.trim().toLowerCase();
  const filteredShows = useMemo(
    () => (q ? shows.filter(s => (s.title || '').toLowerCase().includes(q)) : shows),
    [shows, q]
  );

  const handleCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createList(name);
    setActiveList(name);
    setNewName('');
    setCreating(false);
  };

  const handleDeleteList = async () => {
    if (effectiveList === DEFAULT_LIST) return;
    if (!window.confirm(`Delete the "${effectiveList}" list? The shows in it will be unbound. This cannot be undone.`)) return;
    await deleteList(effectiveList);
    setActiveList(DEFAULT_LIST);
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

        {/* List tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {displayLists.map((l) => {
            const active = l.name === effectiveList;
            return (
              <button
                key={l.name}
                onClick={() => setActiveList(l.name)}
                className={`group inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
                  active
                    ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_8px_20px_rgba(255,0,60,0.25)]'
                    : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600'
                }`}
              >
                {l.name === ALL_LIST && <Layers className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-crimson-600'}`} />}
                {l.name === DEFAULT_LIST && <Heart className={`w-3.5 h-3.5 ${active ? 'fill-white' : 'fill-crimson-800'}`} />}
                <span>{listLabel(l.name)}</span>
                <span className={`text-[10px] tabular-nums ${active ? 'text-crimson-100/80' : 'text-crimson-700'}`}>{l.count}</span>
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
              onClick={handleDeleteList}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-crimson-900/60 text-crimson-600 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-crimson-500 hover:bg-crimson-900/30 transition-all active:scale-95"
            >
              <X className="w-3.5 h-3.5" strokeWidth={3} />
              <span>Delete "{listLabel(effectiveList)}"</span>
            </button>
          )}
        </div>

        {/* Search within the active list */}
        {shows.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-700 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search "${listLabel(effectiveList)}"…`}
                className="w-full pl-11 pr-10 py-3 text-sm font-bold bg-crimson-950/40 border border-crimson-900/60 rounded-xl text-white placeholder:text-crimson-700 focus:outline-none focus:border-crimson-600 transition-colors"
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
            {q && (
              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-crimson-600 tabular-nums">
                {filteredShows.length} match{filteredShows.length === 1 ? '' : 'es'}
              </span>
            )}
          </div>
        )}
      </div>

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
              Nothing here matches "<span className="text-crimson-400">{query.trim()}</span>".
            </p>
          </div>
          <button
            onClick={() => setQuery('')}
            className="px-10 py-3 bg-crimson-950 border border-crimson-900 text-crimson-500 hover:border-crimson-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 sm:gap-8">
          {filteredShows.map((anime) => (
            <div
              key={anime.anilist_id || anime.tmdb_id}
              className="group relative flex flex-col"
            >
              <div className="aspect-[2/3] relative overflow-hidden rounded-2xl border border-crimson-900/40 shadow-2xl transition-[border-color,box-shadow] duration-500 group-hover:border-crimson-500/50 group-hover:shadow-[0_0_30px_rgba(255,0,60,0.2)]">
                <img
                  src={anime.poster}
                  alt={anime.title}
                  className="w-full h-full object-cover transform-gpu transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-crimson-950/20 to-transparent opacity-80"></div>

                {/* Actions Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-crimson-950/40 backdrop-blur-[2px]">
                  <button
                    onClick={() => navigate(anime.anilist_id ? `/anime/${anime.anilist_id}` : `/show/${anime.tmdb_id}`)}
                    className="p-4 bg-crimson-500 text-white rounded-full hover:bg-crimson-400 transform hover:scale-110 transition-all shadow-[0_10px_20px_rgba(255,0,60,0.4)]"
                  >
                    <Play className="w-6 h-6 fill-current" />
                  </button>
                  {effectiveList !== ALL_LIST && (
                    <button
                      onClick={() => removeFromList(anime, effectiveList)}
                      className="flex items-center gap-2 px-4 py-1.5 bg-crimson-950/80 text-[10px] font-black uppercase tracking-widest text-crimson-400 rounded-full border border-crimson-900 hover:text-white hover:border-crimson-600 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {/* Quick Info Badge */}
                <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                   <p className="text-[8px] font-black uppercase tracking-[0.2em] text-crimson-400 text-center bg-crimson-950/80 backdrop-blur-md py-1 rounded-md border border-crimson-900/50">
                     Ref: {anime.anilist_id || anime.tmdb_id}
                   </p>
                </div>
              </div>
              <div className="mt-4 px-1">
                <h4 className="text-sm font-bold text-crimson-50 line-clamp-1 group-hover:text-crimson-400 transition-colors tracking-tight">
                  {anime.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
