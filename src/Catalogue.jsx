import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronRight, Hash, Calendar, BookOpen, HardDrive, Film, Tv } from 'lucide-react';
import { useCatalogue, useLocalLibrary, usePublicConfig, useTitle, API_BASE_URL } from './hooks';

// Absolutize a local poster path (relative signed /local_art) vs an absolute TMDB
// poster; null falls through to a placeholder tile.
const posterSrc = (poster) =>
  poster ? (poster.startsWith('/') ? `${API_BASE_URL}${poster}` : poster) : null;

// A single filter chip (shared by the category/kind + genre rows across both views).
const Chip = ({ active, onClick, children, small = false }) => (
  <button
    onClick={onClick}
    className={`rounded-xl font-black uppercase tracking-widest border transition-all duration-300 ${
      small ? 'px-4 py-1.5 text-[9px] sm:text-[10px]' : 'px-5 py-2 text-[10px] sm:text-xs'
    } ${
      active
        ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.3)]'
        : 'bg-crimson-950/40 border-crimson-900/40 text-crimson-400 hover:border-crimson-700 hover:bg-crimson-900/20'
    }`}
  >
    {children}
  </button>
);

// ---------- Anime view (the original catalogue, unchanged in behaviour) -------
function AnimeCatalogue({ catalogue, loading, error, searchTerm }) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeGenre, setActiveGenre] = useState('ALL');
  const navigate = useNavigate();

  const filteredAnimes = useMemo(() => {
    let result = catalogue.animes;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(a =>
        (a.title || '').toLowerCase().includes(lower) ||
        (a.title_romaji || '').toLowerCase().includes(lower) ||
        (a.title_english || '').toLowerCase().includes(lower)
      );
    }
    if (activeCategory !== 'ALL') result = result.filter(a => a.category === activeCategory);
    if (activeGenre !== 'ALL') result = result.filter(a => (a.genres || []).includes(activeGenre));
    return result;
  }, [catalogue.animes, searchTerm, activeCategory, activeGenre]);

  const groupedAnimes = useMemo(() => {
    const groups = {};
    filteredAnimes.forEach(a => {
      const cat = a.category || 'UNKNOWN';
      (groups[cat] = groups[cat] || []).push(a);
    });
    return Object.keys(groups).sort((a, b) => {
      if (a === 'TV') return -1;
      if (b === 'TV') return 1;
      return a.localeCompare(b);
    }).map(key => ({
      name: key,
      animes: groups[key].sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    }));
  }, [filteredAnimes]);

  if (loading) return <ArchiveSpinner />;
  if (error) return <ArchiveError error={error} />;

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-2">
        <Chip active={activeCategory === 'ALL'} onClick={() => setActiveCategory('ALL')}>All Types</Chip>
        {catalogue.categories.map(cat => (
          <Chip key={cat.category} active={activeCategory === cat.category} onClick={() => setActiveCategory(cat.category)}>
            {cat.category} <span className="opacity-40 ml-1.5 font-mono text-[9px]">({cat.count})</span>
          </Chip>
        ))}
      </div>

      {(catalogue.genres || []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-6 border-t border-crimson-900/20">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 mr-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filter by Genre
          </span>
          <Chip small active={activeGenre === 'ALL'} onClick={() => setActiveGenre('ALL')}>All</Chip>
          {catalogue.genres.map(g => (
            <Chip small key={g.genre} active={activeGenre === g.genre} onClick={() => setActiveGenre(g.genre === activeGenre ? 'ALL' : g.genre)}>
              {g.genre} <span className="opacity-40 ml-1 font-mono text-[8px]">({g.count})</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="space-y-20 pb-24 pt-12">
        {groupedAnimes.length > 0 ? groupedAnimes.map(group => (
          <div key={group.name} className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            <SectionHeader title={group.name} count={`${group.animes.length} Entries`} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-3">
              {group.animes.map(anime => (
                <button
                  key={anime.anilist_id}
                  onClick={() => navigate(`/anime/${anime.anilist_id}`)}
                  className="flex items-center justify-between group p-3.5 hover:bg-crimson-900/10 rounded-2xl transition-all border border-transparent hover:border-crimson-900/30 text-left"
                >
                  <div className="flex flex-col truncate pr-6 space-y-1">
                    <span className="text-crimson-50 font-bold group-hover:text-crimson-400 transition-colors truncate tracking-tight text-base">
                      {anime.title || anime.title_romaji || anime.title_english}
                    </span>
                    <div className="flex items-center gap-4 text-[10px] text-crimson-700 font-black uppercase tracking-widest mt-1">
                      <span className="flex items-center gap-1.5 opacity-80"><Calendar className="w-3.5 h-3.5 text-crimson-600" /> {anime.year || 'N/A'}</span>
                      <span className="opacity-40 font-mono text-[9px]">ID {anime.anilist_id}</span>
                    </div>
                    {(anime.genres || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {anime.genres.slice(0, 3).map(g => (
                          <span key={g} className="px-2 py-0.5 rounded-md bg-crimson-500/5 border border-crimson-500/20 text-[8px] font-black uppercase tracking-widest text-crimson-500/80">{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-2 rounded-full bg-crimson-900/20 group-hover:bg-crimson-500 transition-all duration-300">
                    <ChevronRight className="w-4 h-4 text-crimson-800 group-hover:text-white transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )) : <EmptyState />}
      </div>
    </>
  );
}

// ---------- Local view (the operator's on-disk library) ----------------------
function LocalCatalogue({ library, loading, error, searchTerm }) {
  const [activeKind, setActiveKind] = useState('ALL');
  const [activeGenre, setActiveGenre] = useState('ALL');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let result = library.items;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(it => (it.title || '').toLowerCase().includes(lower));
    }
    if (activeKind !== 'ALL') result = result.filter(it => it.media_kind === activeKind);
    if (activeGenre !== 'ALL') result = result.filter(it => (it.genres || []).includes(activeGenre));
    return result;
  }, [library.items, searchTerm, activeKind, activeGenre]);

  // Group by source root label (a title's registered source), so multiple NAS
  // mounts read as distinct shelves.
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(it => {
      const key = it.source_label || 'Local';
      (groups[key] = groups[key] || []).push(it);
    });
    return Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(key => ({
      name: key,
      items: groups[key].sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    }));
  }, [filtered]);

  if (loading) return <ArchiveSpinner label="Reading the local vault…" />;
  if (error) return <ArchiveError error={error} />;

  const KIND_LABEL = { movie: 'Movies', show: 'Shows' };

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-2">
        <Chip active={activeKind === 'ALL'} onClick={() => setActiveKind('ALL')}>All</Chip>
        {(library.kinds || []).map(k => (
          <Chip key={k.kind} active={activeKind === k.kind} onClick={() => setActiveKind(k.kind)}>
            {KIND_LABEL[k.kind] || k.kind} <span className="opacity-40 ml-1.5 font-mono text-[9px]">({k.count})</span>
          </Chip>
        ))}
      </div>

      {(library.genres || []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-6 border-t border-crimson-900/20">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 mr-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filter by Genre
          </span>
          <Chip small active={activeGenre === 'ALL'} onClick={() => setActiveGenre('ALL')}>All</Chip>
          {library.genres.map(g => (
            <Chip small key={g.genre} active={activeGenre === g.genre} onClick={() => setActiveGenre(g.genre === activeGenre ? 'ALL' : g.genre)}>
              {g.genre} <span className="opacity-40 ml-1 font-mono text-[8px]">({g.count})</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="space-y-20 pb-24 pt-12">
        {grouped.length > 0 ? grouped.map(group => (
          <div key={group.name} className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            <SectionHeader title={group.name} icon={<HardDrive className="w-5 h-5" />} count={`${group.items.length} Titles`} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
              {group.items.map(it => {
                const poster = posterSrc(it.poster);
                return (
                  <button
                    key={it.id}
                    onClick={() => navigate(`/local/${it.id}`)}
                    className="flex items-center gap-4 group p-3 hover:bg-crimson-900/10 rounded-2xl transition-all border border-transparent hover:border-crimson-900/30 text-left"
                  >
                    <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-crimson-900/30 border border-crimson-900/50 grid place-items-center">
                      {poster ? (
                        <img src={poster} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        it.media_kind === 'movie' ? <Film className="w-4 h-4 text-crimson-800" /> : <Tv className="w-4 h-4 text-crimson-800" />
                      )}
                    </div>
                    <div className="flex flex-col truncate flex-grow space-y-1">
                      <span className="text-crimson-50 font-bold group-hover:text-crimson-400 transition-colors truncate tracking-tight text-base">
                        {it.title}
                      </span>
                      <div className="flex items-center gap-3 text-[10px] text-crimson-700 font-black uppercase tracking-widest">
                        <span className="px-1.5 py-0.5 rounded bg-crimson-500/5 border border-crimson-500/20 text-crimson-500/80">
                          {it.media_kind === 'movie' ? 'Movie' : `Show · ${it.episode_count} ep`}
                        </span>
                        {it.year && <span className="opacity-80 flex items-center gap-1"><Calendar className="w-3 h-3" /> {it.year}</span>}
                        {!it.has_metadata && <span className="opacity-40 normal-case tracking-normal font-medium">filename</span>}
                      </div>
                    </div>
                    <div className="p-2 rounded-full bg-crimson-900/20 group-hover:bg-crimson-500 transition-all shrink-0">
                      <ChevronRight className="w-4 h-4 text-crimson-800 group-hover:text-white transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )) : <EmptyState />}
      </div>
    </>
  );
}

// ---------- Shared chrome ----------------------------------------------------
const ArchiveSpinner = ({ label = 'Accessing Royal Archives...' }) => (
  <div className="w-full py-20 flex flex-col items-center justify-center space-y-4">
    <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin" />
    <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">{label}</p>
  </div>
);

const ArchiveError = ({ error }) => (
  <div className="max-w-2xl w-full mx-auto py-20 text-center space-y-6">
    <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
      <Hash className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
      <h2 className="text-2xl font-black text-crimson-50 uppercase">Archive Link Severed</h2>
      <p className="text-crimson-300 mt-2">The librarians cannot reach the requested records: {error}</p>
      <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-crimson-500 hover:bg-crimson-400 text-white font-bold rounded-xl transition-all">
        Retry Ritual
      </button>
    </div>
  </div>
);

const SectionHeader = ({ title, count, icon }) => (
  <div className="flex items-center gap-6">
    <h3 className="text-2xl font-black text-crimson-50 uppercase tracking-tighter bg-crimson-950/40 px-6 py-2 rounded-2xl border border-crimson-900/40 backdrop-blur-md shadow-xl flex items-center gap-3">
      {icon}{title}
    </h3>
    <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
    <span className="text-[10px] font-black text-crimson-700 uppercase tracking-[0.3em] whitespace-nowrap">{count}</span>
  </div>
);

const EmptyState = () => (
  <div className="py-32 text-center space-y-6">
    <div className="w-16 h-16 border-2 border-dashed border-crimson-900/40 rounded-full mx-auto flex items-center justify-center opacity-40">
      <Search className="w-8 h-8 text-crimson-900" />
    </div>
    <p className="text-crimson-700 font-black uppercase tracking-[0.2em] text-sm">No manifestation matches your search ritual</p>
  </div>
);

// ---------- Page shell (owns the view switch + search) -----------------------
const CataloguePage = () => {
  useTitle('The Catalogue');
  const { catalogue, loading, error } = useCatalogue();
  const { local_library_enabled: localEnabled } = usePublicConfig();
  const { library, loading: localLoading, error: localError } = useLocalLibrary();
  // The backend flag gates the toggle; fall back to the library payload's own
  // `enabled` in case config hasn't resolved yet.
  const showLocal = !!localEnabled || !!library.enabled;

  const [view, setView] = useState('anime');
  const [searchTerm, setSearchTerm] = useState('');

  // Never leave the viewer stranded on a Local view that got disabled.
  useEffect(() => { if (view === 'local' && !showLocal) setView('anime'); }, [view, showLocal]);
  // Reset the search when switching surfaces (anime + local titles don't overlap).
  const switchView = (v) => { setView(v); setSearchTerm(''); };

  const isLocal = view === 'local';
  const total = isLocal ? library.total : catalogue.total;

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 my-auto animate-in fade-in duration-1000">
      <div className="space-y-8 border-b border-crimson-900/30 pb-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black text-crimson-50 uppercase tracking-tighter leading-none">
              {isLocal ? 'The ' : 'The '}
              <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">{isLocal ? 'Vault' : 'Catalogue'}</span>
            </h1>
            <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
              {isLocal ? <HardDrive className="w-4 h-4 text-crimson-500" /> : <BookOpen className="w-4 h-4 text-crimson-500" />}
              {isLocal ? `Browsing ${total} local manifestations` : `Browsing ${total} registered manifestations`}
            </p>
          </div>

          <div className="relative group max-w-lg w-full">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none z-10">
              <Search className="w-5 h-5 text-crimson-500 opacity-50 group-focus-within:opacity-100 transition-opacity" />
            </div>
            <input
              type="text"
              placeholder={isLocal ? 'Search your vault...' : 'Search Archives...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-crimson-950/30 border border-crimson-900/50 rounded-2xl py-4 pl-14 pr-6 text-crimson-50 placeholder-crimson-800 focus:outline-none focus:border-crimson-500 focus:shadow-[0_0_30px_rgba(255,0,60,0.1)] transition-all font-bold tracking-wide backdrop-blur-md text-sm sm:text-base"
            />
          </div>
        </div>

        {/* View switch — Local only appears when a local source is configured. */}
        {showLocal && (
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/50 backdrop-blur-md">
            <button
              onClick={() => switchView('anime')}
              className={`px-5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                !isLocal ? 'bg-crimson-600 text-white shadow-[0_5px_15px_rgba(255,0,60,0.3)]' : 'text-crimson-400 hover:text-crimson-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Anime
            </button>
            <button
              onClick={() => switchView('local')}
              className={`px-5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                isLocal ? 'bg-crimson-600 text-white shadow-[0_5px_15px_rgba(255,0,60,0.3)]' : 'text-crimson-400 hover:text-crimson-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" /> Local
            </button>
          </div>
        )}
      </div>

      {isLocal
        ? <LocalCatalogue library={library} loading={localLoading} error={localError} searchTerm={searchTerm} />
        : <AnimeCatalogue catalogue={catalogue} loading={loading} error={error} searchTerm={searchTerm} />}
    </div>
  );
};

export default CataloguePage;
