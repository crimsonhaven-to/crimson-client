// Shows carry no rating column, so there's no "Top Rated" sort.
import { Tv } from 'lucide-react';
import { PosterBrowseHub } from './hubKit';
import { useShowsCatalogue } from './hooks';

const SORTS = [
  { value: 'popular', label: 'Popular' },
  { value: 'title', label: 'A-Z' },
  { value: 'year', label: 'Newest' },
];

export default function ShowsHub() {
  return (
    <PosterBrowseHub
      useData={useShowsCatalogue}
      title="The" accent="Shows" icon={<Tv className="w-4 h-4 text-crimson-500" />}
      unit="shows" sortOptions={SORTS} defaultSort="popular"
      searchPlaceholder="Search shows..."
      routeFor={(it) => `/show/${it.tmdb_id}`}
    />
  );
}
