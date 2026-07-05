// --- Shared browse-hub kit --------------------------------------------------
// The presentational vocabulary shared by every per-type browse hub (Anime,
// Shows, Movies, Manga, Local) and the home rows. Lifted out of Catalogue.jsx /
// App.jsx so the hubs render identically and App.jsx stays lean. Nothing here is
// type-specific: a hub feeds in its items + facets and gets the same chrome.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Play, Star, ChevronRight, ChevronDown, Filter, Hash, SlidersHorizontal, Tag } from 'lucide-react';
import { useTitle } from './hooks';
// Pure helpers live in hubHelpers.js so this module stays component-only (React
// Fast Refresh needs component-only modules). Consumers import posterSrc /
// kindStyle / applyBrowse straight from './hubHelpers'.
import { kindStyle, applyBrowse } from './hubHelpers';

// A single filter chip (shared by the genre/sort/category rows across every hub).
export const Chip = ({ active, onClick, children, small = false }) => (
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

export const SectionHeader = ({ title, count, icon }) => (
  <div className="flex items-center gap-6">
    <h3 className="text-2xl font-black text-crimson-50 uppercase tracking-tighter bg-crimson-950/40 px-6 py-2 rounded-2xl border border-crimson-900/40 backdrop-blur-md shadow-xl flex items-center gap-3">
      {icon}{title}
    </h3>
    <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
    <span className="text-[10px] font-black text-crimson-700 uppercase tracking-[0.3em] whitespace-nowrap">{count}</span>
  </div>
);

export const ArchiveSpinner = ({ label = 'Accessing Royal Archives...' }) => (
  <div className="w-full py-20 flex flex-col items-center justify-center space-y-4">
    <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin" />
    <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">{label}</p>
  </div>
);

export const ArchiveError = ({ error }) => (
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

export const EmptyState = ({ label = 'No manifestation matches your search ritual' }) => (
  <div className="py-32 text-center space-y-6">
    <div className="w-16 h-16 border-2 border-dashed border-crimson-900/40 rounded-full mx-auto flex items-center justify-center opacity-40">
      <Search className="w-8 h-8 text-crimson-900" />
    </div>
    <p className="text-crimson-700 font-black uppercase tracking-[0.2em] text-sm">{label}</p>
  </div>
);

// A single poster tile — the artwork-forward card shared by the home rows and the
// browse-hub grids (P-Stream / movie-web style). Lifted from App.jsx so the home
// and the hubs render the exact same tile. `poster` is used as-is (absolute URLs);
// pass a posterSrc()-resolved value for relative local art.
export function PosterCard({ item, onSelect, showKind = true }) {
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

        <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-crimson-950/10 to-transparent opacity-80"></div>

        {showKind && item.kind && (
          <span className={`absolute top-2 left-2 text-[8px] font-black uppercase tracking-[0.18em] px-2 py-0.5 rounded-md border backdrop-blur-sm ${kindStyle(item.kind).badge}`}>
            {kindStyle(item.kind).label}
          </span>
        )}

        {rating && (
          <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-crimson-950/70 backdrop-blur-sm border border-crimson-800/60 text-crimson-200">
            <Star className="w-2.5 h-2.5 fill-crimson-400 text-crimson-400" /> {rating}
          </span>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-crimson-950/20 backdrop-blur-[1px]">
          <div className="p-3 bg-crimson-500 rounded-full shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <Play className="w-5 h-5 fill-white text-white" />
          </div>
        </div>

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

// Responsive poster grid used by the browse hubs. Inside a single-kind hub the
// per-tile kind badge is redundant noise, so it's off by default here.
export function PosterGrid({ items, onSelect, showKind = false }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6">
      {items.map((item, i) => (
        <PosterCard
          key={`${item.kind}-${item.tmdb_id ?? item.anilist_id ?? item.id}-${i}`}
          item={item}
          onSelect={onSelect}
          showKind={showKind}
        />
      ))}
    </div>
  );
}

// A titled row of filter chips (genres or sorts). `options` is a list of
// { value, label, count? }; `all` prepends an "All" chip that clears the filter.
export function ChipRow({ icon, label, options, value, onChange, all = true, allLabel = 'All' }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 mr-2 flex items-center gap-1.5">
          {icon || <Filter className="w-3.5 h-3.5" />} {label}
        </span>
      )}
      {all && (
        <Chip small active={!value} onClick={() => onChange(null)}>{allLabel}</Chip>
      )}
      {options.map((o) => (
        <Chip
          key={o.value}
          small
          active={value === o.value}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.label}
          {typeof o.count === 'number' && <span className="opacity-40 ml-1 font-mono text-[8px]">({o.count})</span>}
        </Chip>
      ))}
    </div>
  );
}

// (applyBrowse lives in hubHelpers.js and is imported above.)

// The page shell shared by every browse hub: the big title + subtitle, an
// optional client-side search box, an optional right-hand slot (sort / mode
// toggle), and the hub body. Matches the old Catalogue page header so the hubs
// feel like the surface they replaced.
export function HubShell({
  title, accent, icon, subtitle,
  search, onSearch, searchPlaceholder = 'Search...',
  right, children,
}) {
  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 my-auto animate-in fade-in duration-1000">
      <div className="space-y-8 border-b border-crimson-900/30 pb-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black text-crimson-50 uppercase tracking-tighter leading-none">
              {title} <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">{accent}</span>
            </h1>
            {subtitle && (
              <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
                {icon} {subtitle}
              </p>
            )}
          </div>

          {onSearch && (
            <div className="relative group max-w-lg w-full">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none z-10">
                <Search className="w-5 h-5 text-crimson-500 opacity-50 group-focus-within:opacity-100 transition-opacity" />
              </div>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="w-full bg-crimson-950/30 border border-crimson-900/50 rounded-2xl py-4 pl-14 pr-6 text-crimson-50 placeholder-crimson-800 focus:outline-none focus:border-crimson-500 focus:shadow-[0_0_30px_rgba(255,0,60,0.1)] transition-all font-bold tracking-wide backdrop-blur-md text-sm sm:text-base"
              />
            </div>
          )}
        </div>

        {right}
      </div>

      {children}
    </div>
  );
}

// Generic browse hub for a LIVE, PAGINATED AniList catalogue (Manga, Anime
// "Discover"): server-side genre + sort (each re-queries page 1) and a "load
// more" that appends pages. No free-text search (partial/live corpus — the home
// search covers that). `useData` is the paginated hook (useAnimeCatalogue /
// useMangaCatalogue); `extraControls` lets a caller inject e.g. a view toggle.
export function PaginatedBrowseHub({
  useData, title, accent, icon, unit = 'shown', routeFor,
  sortOptions, defaultSort = 'trending', subtitle,
  emptyLabel, loadingLabel = 'Summoning…', moreLabel = 'Reveal More',
  extraControls, onUnavailable, errorAction,
}) {
  const navigate = useNavigate();
  const [genre, setGenre] = useState(null);
  const [sort, setSort] = useState(defaultSort);
  useTitle(accent);

  const { items, genres, total, hasNext, loading, loadingMore, error, loadMore } =
    useData({ genre, sort });

  // Let a caller react to the live source being unavailable (e.g. the Anime hub
  // auto-falls back to its local Archive when AniList is down). Fires on the
  // first-page error only — not on a failed "load more" of an already-shown page.
  useEffect(() => {
    if (error && items.length === 0 && onUnavailable) onUnavailable();
  }, [error, items.length, onUnavailable]);

  const genreOptions = (genres || []).map((g) => ({ value: g.genre, label: g.genre, count: g.count }));
  const resolvedSubtitle = loading
    ? loadingLabel
    : (subtitle != null ? subtitle : (total ? `${total.toLocaleString()} in the archive` : null));

  const controls = (
    <div className="space-y-6">
      {extraControls}
      <ChipRow
        icon={<SlidersHorizontal className="w-3.5 h-3.5" />} label="Sort"
        options={sortOptions} value={sort} onChange={(v) => setSort(v || defaultSort)} all={false}
      />
      {genreOptions.length > 0 && (
        <div className="pt-6 border-t border-crimson-900/20">
          <ChipRow icon={<Tag className="w-3.5 h-3.5" />} label="Genre" options={genreOptions} value={genre} onChange={setGenre} />
        </div>
      )}
    </div>
  );

  return (
    <HubShell title={title} accent={accent} icon={icon} subtitle={resolvedSubtitle} right={controls}>
      {loading ? (
        <ArchiveSpinner label={loadingLabel} />
      ) : error && items.length === 0 ? (
        // Only take over the surface when the FIRST page failed; a failed "load
        // more" keeps the already-shown grid (the button re-enables to retry).
        <div className="space-y-6">
          <ArchiveError error={error} />
          {errorAction && <div className="flex justify-center">{errorAction}</div>}
        </div>
      ) : items.length === 0 ? (
        <EmptyState label={emptyLabel} />
      ) : (
        <div className="space-y-8 pb-24">
          <SectionHeader title={accent} count={`${items.length} ${unit}`} />
          <PosterGrid items={items} onSelect={(it) => navigate(routeFor(it))} />
          {hasNext && (
            <div className="flex justify-center pt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900 text-white font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all shadow-[0_5px_15px_rgba(255,0,60,0.3)]"
              >
                {loadingMore ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Unsealing…</>
                ) : (
                  <>{moreLabel} <ChevronDown className="w-4 h-4" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </HubShell>
  );
}

// A compact segmented view toggle (e.g. the Anime hub's Discover / Archive switch,
// the Local hub's Library / Browse switch). `options` is [{ value, label, icon }].
export function ViewToggle({ options, value, onChange }) {
  return (
    <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/50 backdrop-blur-md">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            value === o.value ? 'bg-crimson-600 text-white' : 'text-crimson-400 hover:text-crimson-200'
          }`}
        >
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  );
}

// The chevron "See all" affordance reused by home-row CTAs → hub deep-links.
export const SeeAll = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600 hover:text-crimson-400 transition-colors shrink-0">
    {children}
    <ChevronRight className="w-4 h-4" />
  </span>
);

// Generic browse hub for a fully-loaded local list (Shows, Movies): title +
// client-side search, genre chips (from the server facet), a sort control, and a
// poster grid. Shows and Movies differ only in the data hook, the per-item route,
// the page title, and the available sorts — everything else is shared here.
export function PosterBrowseHub({
  useData, title, accent, icon, unit, routeFor,
  sortOptions, defaultSort = 'popular', searchPlaceholder = 'Search titles...',
}) {
  const { items, genres, total, loading, error } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [genre, setGenre] = useState(null);
  const [sort, setSort] = useState(defaultSort);
  useTitle(title);

  const filtered = useMemo(
    () => applyBrowse(items, { searchTerm, genre, sort }),
    [items, searchTerm, genre, sort],
  );

  const genreOptions = (genres || []).map((g) => ({ value: g.genre, label: g.genre, count: g.count }));
  const subtitle = loading
    ? 'Consulting the archives…'
    : `Browsing ${total} ${unit}`;

  const controls = (
    <div className="space-y-6">
      <ChipRow
        icon={<SlidersHorizontal className="w-3.5 h-3.5" />} label="Sort"
        options={sortOptions} value={sort} onChange={(v) => setSort(v || defaultSort)} all={false}
      />
      {genreOptions.length > 0 && (
        <div className="pt-6 border-t border-crimson-900/20">
          <ChipRow icon={<Tag className="w-3.5 h-3.5" />} label="Genre" options={genreOptions} value={genre} onChange={setGenre} />
        </div>
      )}
    </div>
  );

  return (
    <HubShell
      title={title} accent={accent} icon={icon} subtitle={subtitle}
      search={searchTerm} onSearch={setSearchTerm} searchPlaceholder={searchPlaceholder}
      right={controls}
    >
      {loading ? (
        <ArchiveSpinner />
      ) : error ? (
        <ArchiveError error={error} />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8 pb-24">
          <SectionHeader title={accent} count={`${filtered.length} ${unit}`} />
          <PosterGrid items={filtered} onSelect={(it) => navigate(routeFor(it))} />
        </div>
      )}
    </HubShell>
  );
}
