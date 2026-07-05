// The Movies browse hub — the movie twin of ShowsHub. Data from /catalogue/movies
// (local TMDB tables); items route to the movie pages. Movies carry a rating
// (vote_average), so they add a "Top Rated" sort the shows hub can't offer.
import { Film } from 'lucide-react';
import { PosterBrowseHub } from './hubKit';
import { useMoviesCatalogue } from './hooks';

const SORTS = [
  { value: 'popular', label: 'Popular' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'title', label: 'A–Z' },
  { value: 'year', label: 'Newest' },
];

export default function MoviesHub() {
  return (
    <PosterBrowseHub
      useData={useMoviesCatalogue}
      title="The" accent="Movies" icon={<Film className="w-4 h-4 text-crimson-500" />}
      unit="films" sortOptions={SORTS} defaultSort="popular"
      searchPlaceholder="Search movies..."
      routeFor={(it) => `/movie/${it.tmdb_id}`}
    />
  );
}
