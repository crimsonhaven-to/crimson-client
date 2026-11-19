import { useParams, useNavigate } from 'react-router-dom';
import { useShowOverview } from './hooks';
import { useSeasonParam } from '../watch/seasonParam';
import { useShowResume } from '../watch/resume';
import { useTitle } from '../useTitle';
import OverviewView from '../watch/OverviewView';

const ShowOverview = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const [requestedSeason, setActiveSeason] = useSeasonParam();
  const {
    overview, loading, error,
    activeSeason,
    episodes, episodesLoading,
  } = useShowOverview(tmdbId, requestedSeason);

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
