// The Manga browse hub — unlike Shows/Movies this is live + paginated: the public
// backend keeps no manga table, so /catalogue/manga hits AniList per page. Genre
// and sort are therefore SERVER-side (they re-query page 1), and there's no free-
// text search box here (the home search covers that); you browse by genre + sort
// and append pages with "Reveal More". Items route to the AniList-keyed manga pages.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, Tag, SlidersHorizontal } from 'lucide-react';
import {
  HubShell, ChipRow, PosterGrid, SectionHeader,
  ArchiveSpinner, ArchiveError, EmptyState,
} from './hubKit';
import { useMangaCatalogue, MANGA_SORTS, useTitle } from './hooks';

export default function MangaHub() {
  const navigate = useNavigate();
  const [genre, setGenre] = useState(null);
  const [sort, setSort] = useState('trending');
  useTitle('Manga');

  const { items, genres, total, hasNext, loading, loadingMore, error, loadMore } =
    useMangaCatalogue({ genre, sort });

  const genreOptions = (genres || []).map((g) => ({ value: g.genre, label: g.genre, count: g.count }));

  const controls = (
    <div className="space-y-6">
      <ChipRow
        icon={<SlidersHorizontal className="w-3.5 h-3.5" />} label="Sort"
        options={MANGA_SORTS} value={sort} onChange={(v) => setSort(v || 'trending')} all={false}
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
      title="The" accent="Manga" icon={<BookOpen className="w-4 h-4 text-crimson-500" />}
      subtitle={loading ? 'Summoning the scriptorium…' : (total ? `${total.toLocaleString()} scrolls in the archive` : 'The reading archive')}
      right={controls}
    >
      {loading ? (
        <ArchiveSpinner label="Summoning the scriptorium…" />
      ) : error ? (
        <ArchiveError error={error} />
      ) : items.length === 0 ? (
        <EmptyState label="No scrolls answer this ritual" />
      ) : (
        <div className="space-y-8 pb-24">
          <SectionHeader title="Manga" count={`${items.length} shown`} />
          <PosterGrid items={items} onSelect={(it) => navigate(`/manga/${it.anilist_id}`)} />
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
                  <>Reveal More <ChevronDown className="w-4 h-4" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </HubShell>
  );
}
