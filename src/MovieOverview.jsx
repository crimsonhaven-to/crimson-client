import { useParams, useNavigate } from 'react-router-dom';
import { useMovieOverview, useShowResume, useTitle } from './hooks';
import OverviewView from './OverviewView';

const MovieOverview = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const { overview, loading, error } = useMovieOverview(tmdbId);

  useTitle(overview?.title || 'Overview');

  // Movies are keyed by tmdb_id in the movie: namespace, so the identity carries
  // media_type 'movie'.
  const watchlistItem = overview
    ? { tmdb_id: Number(tmdbId), media_type: 'movie', title: overview.title, poster: overview.poster }
    : undefined;

  const resume = useShowResume({ tmdbId: Number(tmdbId), mediaType: 'movie' });

  const play = () => navigate(`/watch-movie/${tmdbId}`);

  return (
    <OverviewView
      overview={overview}
      loading={loading}
      error={error}
      isMovie
      onPlay={play}
      runtime={overview?.runtime}
      genres={overview?.genres || []}
      // Movies have no seasons/episodes; these stay no-ops / empty.
      activeSeason={null}
      setActiveSeason={() => {}}
      episodes={[]}
      episodesLoading={false}
      onBack={() => navigate(-1)}
      onPlayEpisode={() => {}}
      onPlayExtra={() => {}}
      watchlistItem={watchlistItem}
      resume={resume}
      notFoundText="This film could not be summoned from the archives."
    />
  );
};

export default MovieOverview;
