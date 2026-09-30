import { useParams, useNavigate } from 'react-router-dom';
import { useShowOverview } from './hooks/shows';
import { useShowResume } from './watch/resume';
import { useTitle } from './shell/useTitle';
import OverviewView from './OverviewView';

const ShowOverview = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const {
    overview, loading, error,
    activeSeason, setActiveSeason,
    episodes, episodesLoading,
  } = useShowOverview(tmdbId);

  useTitle(overview?.title || 'Overview');

  const watchlistItem = overview
    ? { tmdb_id: Number(tmdbId), title: overview.title, poster: overview.poster }
    : undefined;

  const resume = useShowResume({ tmdbId: Number(tmdbId) });

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
      watchlistItem={watchlistItem}
      resume={resume}
      notFoundText="This show could not be summoned from the archives."
    />
  );
};

export default ShowOverview;
