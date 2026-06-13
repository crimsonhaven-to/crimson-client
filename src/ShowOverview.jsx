import { useParams, useNavigate } from 'react-router-dom';
import { useShowOverview, useTitle } from './hooks';
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
      notFoundText="This show could not be summoned from the archives."
    />
  );
};

export default ShowOverview;
