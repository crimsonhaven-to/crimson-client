// The Anime browse hub — two views behind a local (non-persisted) toggle:
//
//   • Discover (DEFAULT): a fast, paginated, poster-rich AniList grid — the anime
//     twin of the Manga/Shows/Movies hubs. This is what you land on.
//   • Archive (secondary): the full mapped anime catalogue (~6,800 titles) from
//     /catalogue, grouped by format with a genre filter + search. It's a big,
//     slow list, so it only mounts when you actually switch to it (its useCatalogue
//     never runs while you're on Discover).
//
// The toggle lives in each view's header controls so it's always reachable.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronRight, Flame, Library, BookOpen, Tag } from 'lucide-react';
import {
  HubShell, ChipRow, SectionHeader, ArchiveSpinner, ArchiveError, EmptyState,
  PaginatedBrowseHub, ViewToggle,
} from './hubKit';
import { useCatalogue, useAnimeCatalogue, CATALOGUE_SORTS, useTitle } from './hooks';

const VIEWS = [
  { value: 'discover', label: 'Discover', icon: <Flame className="w-3.5 h-3.5" /> },
  { value: 'archive', label: 'Archive', icon: <Library className="w-3.5 h-3.5" /> },
];

// Discover — the fast, paginated AniList grid (default). Thin wrapper over the
// shared PaginatedBrowseHub, with the view toggle injected into its controls.
function AnimeDiscover({ toggle }) {
  return (
    <PaginatedBrowseHub
      useData={useAnimeCatalogue}
      title="The" accent="Anime" icon={<Flame className="w-4 h-4 text-crimson-500" />}
      unit="shown" sortOptions={CATALOGUE_SORTS} defaultSort="trending"
      routeFor={(it) => `/anime/${it.anilist_id}`}
      loadingLabel="Divining the trending sigils…"
      emptyLabel="No manifestations answer this ritual"
      moreLabel="Reveal More"
      extraControls={toggle}
    />
  );
}

// Archive — the full local catalogue (~6,800 titles), grouped by format. Only
// mounted when the Archive view is active, so its useCatalogue fetch/render never
// runs on the (default) Discover view.
function AnimeArchive({ toggle }) {
  useTitle('Anime Archive');
  const { catalogue, loading, error } = useCatalogue();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState(null);
  const [genre, setGenre] = useState(null);

  const filtered = useMemo(() => {
    let result = catalogue.animes;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(a =>
        (a.title || '').toLowerCase().includes(lower) ||
        (a.title_romaji || '').toLowerCase().includes(lower) ||
        (a.title_english || '').toLowerCase().includes(lower)
      );
    }
    if (category) result = result.filter(a => a.category === category);
    if (genre) result = result.filter(a => (a.genres || []).includes(genre));
    return result;
  }, [catalogue.animes, searchTerm, category, genre]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(a => {
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
  }, [filtered]);

  const categoryOptions = (catalogue.categories || []).map(c => ({ value: c.category, label: c.category, count: c.count }));
  const genreOptions = (catalogue.genres || []).map(g => ({ value: g.genre, label: g.genre, count: g.count }));

  const controls = (
    <div className="space-y-6">
      {toggle}
      <ChipRow label="Type" options={categoryOptions} value={category} onChange={setCategory} allLabel="All Types" />
      {genreOptions.length > 0 && (
        <div className="pt-6 border-t border-crimson-900/20">
          <ChipRow icon={<Tag className="w-3.5 h-3.5" />} label="Genre" options={genreOptions} value={genre} onChange={setGenre} />
        </div>
      )}
    </div>
  );

  return (
    <HubShell
      title="The" accent="Anime" icon={<BookOpen className="w-4 h-4 text-crimson-500" />}
      subtitle={loading ? 'Accessing the archives…' : `The full archive — ${catalogue.total} registered manifestations`}
      search={searchTerm} onSearch={setSearchTerm} searchPlaceholder="Search the full archive..."
      right={controls}
    >
      {loading ? (
        <ArchiveSpinner />
      ) : error ? (
        <ArchiveError error={error} />
      ) : (
        <div className="space-y-20 pb-24 pt-2">
          {grouped.length > 0 ? grouped.map(group => (
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
      )}
    </HubShell>
  );
}

export default function AnimeHub() {
  const [view, setView] = useState('discover');
  const toggle = <ViewToggle options={VIEWS} value={view} onChange={setView} />;
  // Mount only the active view so the heavy Archive catalogue never loads on the
  // default Discover view.
  return view === 'archive'
    ? <AnimeArchive toggle={toggle} />
    : <AnimeDiscover toggle={toggle} />;
}
