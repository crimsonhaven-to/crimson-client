// The Local browse hub — the operator's on-disk library. Promoted out of the old
// Catalogue "Local" tab. Two modes: Library (identified poster tiles, grouped by
// source root) and Browse (raw folder navigation for media that never resolved to
// a title). Shown only when a local source is configured (App gates the route via
// usePublicConfig / the library payload's own `enabled`).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, Calendar, HardDrive, Film, Tv, Folder, FileVideo,
  LayoutGrid, FolderTree, Home, Filter,
} from 'lucide-react';
import {
  HubShell, ChipRow, SectionHeader, ArchiveSpinner, ArchiveError, EmptyState,
} from './hubKit';
import { posterSrc } from './hubHelpers';
import { useLocalLibrary, useLocalBrowse, useTitle } from './hooks';

// Folder-navigation view — the fallback surface for media that never resolved to
// a title. Keeps its own breadcrumb trail; identified folders render as tiles
// (→ overview), containers drill in, loose files play directly.
function LocalBrowseView({ searchTerm, navigate }) {
  const [trail, setTrail] = useState([]);
  const currentToken = trail.length ? trail[trail.length - 1].token : null;
  const { view, loading, error } = useLocalBrowse(currentToken);

  const openFolder = (entry) => setTrail((t) => [...t, { token: entry.id, name: entry.name }]);
  const up = () => setTrail((t) => t.slice(0, -1));
  const jumpTo = (idx) => setTrail((t) => t.slice(0, idx + 1));

  const entries = useMemo(() => {
    const list = view?.entries || [];
    if (!searchTerm) return list;
    const lower = searchTerm.toLowerCase();
    return list.filter((e) => ((e.title || e.name || '')).toLowerCase().includes(lower));
  }, [view, searchTerm]);

  if (loading) return <ArchiveSpinner label="Walking the vault…" />;
  if (error) return <ArchiveError error={error} />;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-black uppercase tracking-widest">
        <button onClick={() => setTrail([])} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${trail.length === 0 ? 'bg-crimson-600/20 border-crimson-500/40 text-crimson-200' : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-500 hover:text-crimson-300'}`}>
          <Home className="w-3.5 h-3.5" /> Local
        </button>
        {trail.map((c, i) => (
          <span key={c.token} className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-crimson-800" />
            <button onClick={() => jumpTo(i)} className={`px-3 py-1.5 rounded-xl border transition-all truncate max-w-[12rem] ${i === trail.length - 1 ? 'bg-crimson-600/20 border-crimson-500/40 text-crimson-200' : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-500 hover:text-crimson-300'}`}>{c.name}</button>
          </span>
        ))}
        {trail.length > 0 && (
          <button onClick={up} className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-crimson-950/40 border border-crimson-900/50 text-crimson-500 hover:text-crimson-300 transition-all">
            <ChevronLeft className="w-3.5 h-3.5" /> Up
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
          {entries.map((e) => {
            const isTitle = e.type === 'title';
            const isFolder = e.type === 'folder';
            const poster = isTitle ? posterSrc(e.poster) : null;
            const onClick = isFolder
              ? () => openFolder(e)
              : isTitle
                ? () => navigate(`/local/${e.id}`)
                : () => navigate(`/watch-local/${e.id}`);
            return (
              <button
                key={e.id}
                onClick={onClick}
                className="flex items-center gap-4 group p-3 hover:bg-crimson-900/10 rounded-2xl transition-all border border-transparent hover:border-crimson-900/30 text-left"
              >
                <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-crimson-900/30 border border-crimson-900/50 grid place-items-center">
                  {poster ? (
                    <img src={poster} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : isFolder ? (
                    <Folder className="w-5 h-5 text-crimson-700" />
                  ) : isTitle ? (
                    e.media_kind === 'movie' ? <Film className="w-4 h-4 text-crimson-800" /> : <Tv className="w-4 h-4 text-crimson-800" />
                  ) : (
                    <FileVideo className="w-5 h-5 text-crimson-800" />
                  )}
                </div>
                <div className="flex flex-col truncate flex-grow space-y-1">
                  <span className="text-crimson-50 font-bold group-hover:text-crimson-400 transition-colors truncate tracking-tight text-base">
                    {e.title || e.name}
                  </span>
                  <div className="flex items-center gap-3 text-[10px] text-crimson-700 font-black uppercase tracking-widest">
                    {isFolder && <span className="px-1.5 py-0.5 rounded bg-crimson-500/5 border border-crimson-500/20 text-crimson-500/80">Folder</span>}
                    {isTitle && <span className="px-1.5 py-0.5 rounded bg-crimson-500/5 border border-crimson-500/20 text-crimson-500/80">{e.media_kind === 'movie' ? 'Movie' : `Show · ${e.episode_count} ep`}</span>}
                    {e.type === 'file' && <span className="px-1.5 py-0.5 rounded bg-crimson-500/5 border border-crimson-500/20 text-crimson-500/80">File</span>}
                    {isTitle && e.year && <span className="opacity-80 flex items-center gap-1"><Calendar className="w-3 h-3" /> {e.year}</span>}
                    {isTitle && !e.has_metadata && <span className="opacity-40 normal-case tracking-normal font-medium">filename</span>}
                  </div>
                </div>
                <div className="p-2 rounded-full bg-crimson-900/20 group-hover:bg-crimson-500 transition-all shrink-0">
                  <ChevronRight className="w-4 h-4 text-crimson-800 group-hover:text-white transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const KIND_LABEL = { movie: 'Movies', show: 'Shows' };

export default function LocalHub() {
  useTitle('Local Vault');
  const { library, loading, error } = useLocalLibrary();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [kind, setKind] = useState(null);
  const [genre, setGenre] = useState(null);
  const [mode, setMode] = useState('library');

  const filtered = useMemo(() => {
    let result = library.items;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(it => (it.title || '').toLowerCase().includes(lower));
    }
    if (kind) result = result.filter(it => it.media_kind === kind);
    if (genre) result = result.filter(it => (it.genres || []).includes(genre));
    return result;
  }, [library.items, searchTerm, kind, genre]);

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

  const ModeToggle = (
    <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/50 backdrop-blur-md">
      <button onClick={() => setMode('library')}
        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'library' ? 'bg-crimson-600 text-white' : 'text-crimson-400 hover:text-crimson-200'}`}>
        <LayoutGrid className="w-3.5 h-3.5" /> Library
      </button>
      <button onClick={() => setMode('browse')}
        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'browse' ? 'bg-crimson-600 text-white' : 'text-crimson-400 hover:text-crimson-200'}`}>
        <FolderTree className="w-3.5 h-3.5" /> Browse
      </button>
    </div>
  );

  const kindOptions = (library.kinds || []).map(k => ({ value: k.kind, label: KIND_LABEL[k.kind] || k.kind, count: k.count }));
  const genreOptions = (library.genres || []).map(g => ({ value: g.genre, label: g.genre, count: g.count }));

  const controls = (
    <div className="space-y-6">
      {ModeToggle}
      {mode === 'library' && (
        <>
          <ChipRow label="Kind" options={kindOptions} value={kind} onChange={setKind} allLabel="All" />
          {genreOptions.length > 0 && (
            <div className="pt-6 border-t border-crimson-900/20">
              <ChipRow icon={<Filter className="w-3.5 h-3.5" />} label="Genre" options={genreOptions} value={genre} onChange={setGenre} />
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <HubShell
      title="The" accent="Vault" icon={<HardDrive className="w-4 h-4 text-crimson-500" />}
      subtitle={loading ? 'Reading the local vault…' : `Browsing ${library.total} local manifestations`}
      search={searchTerm} onSearch={setSearchTerm}
      searchPlaceholder="Search your vault..."
      right={controls}
    >
      {mode === 'browse' ? (
        <LocalBrowseView searchTerm={searchTerm} navigate={navigate} />
      ) : loading ? (
        <ArchiveSpinner label="Reading the local vault…" />
      ) : error ? (
        <ArchiveError error={error} />
      ) : (
        <div className="space-y-20 pb-24 pt-2">
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
      )}
    </HubShell>
  );
}
