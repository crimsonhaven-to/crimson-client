// The public backend keeps no manga table, so /catalogue/manga hits AniList per page.
import { BookOpen } from 'lucide-react';
import { PaginatedBrowseHub } from '../browse/hubKit';
import { useMangaCatalogue, CATALOGUE_SORTS } from '../browse/catalogues';

export default function MangaHub() {
  return (
    <PaginatedBrowseHub
      useData={useMangaCatalogue}
      title="The" accent="Manga" icon={<BookOpen className="w-4 h-4 text-crimson-500" />}
      unit="scrolls" sortOptions={CATALOGUE_SORTS} defaultSort="trending"
      routeFor={(it) => `/manga/${it.anilist_id}`}
      loadingLabel="Summoning the scriptorium…"
      emptyLabel="No scrolls answer this ritual"
      moreLabel="Reveal More"
    />
  );
}
