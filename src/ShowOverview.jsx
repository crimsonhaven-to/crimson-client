import { useParams, useNavigate } from 'react-router-dom';
import { useShowOverview, useAccount, useTitle } from './hooks';
import OverviewView from './OverviewView';

// Non-anime show overview page (/show/:tmdbId). The TMDB-keyed twin of
// AnimeOverview: same shared <OverviewView>, but sourced from useShowOverview and
// navigating into the TMDB-keyed /watch-show route. Shows carry no extras.
const ShowOverview = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const {
    overview, loading, error,
    activeSeason, setActiveSeason,
    episodes, episodesLoading,
  } = useShowOverview(tmdbId);

  useTitle(overview?.title || 'Overview');

  // Favorites — shows are keyed by tmdb_id (compared as strings since the param
  // is a string and stored ids may be numeric). Mirrors the anime overview.
  const { favorites, toggleFavorite } = useAccount();
  const isFavorite = favorites.some(f => String(f.tmdb_id) === String(tmdbId));
  const onToggleFavorite = overview
    ? () => toggleFavorite({ tmdb_id: Number(tmdbId), title: overview.title, poster: overview.poster })
    : undefined;

  const goToEpisode = (season, episodeNumber) =>
    navigate(`/watch-show/${tmdbId}/${season.season_number}/${episodeNumber}`);

  return (
    <OverviewView
      overview={overview}
      loading={loading}
      error={error}
      activeSeason={activeSeason}
      setActiveSeason={setActiveSeason}
      episodes={episodes}
      episodesLoading={episodesLoading}
      onBack={() => navigate(-1)}
      onPlayEpisode={goToEpisode}
      onPlayExtra={() => {}}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      notFoundText="This show could not be summoned from the archives."
    />
  );
};

export default ShowOverview;
