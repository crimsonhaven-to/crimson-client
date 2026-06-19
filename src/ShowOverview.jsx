import { useParams, useNavigate } from 'react-router-dom';
import { useShowOverview, useShowResume, useTitle } from './hooks';
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

  // Watchlists — shows are keyed by tmdb_id. The minimal identity is handed to the
  // <WatchlistButton> inside the view, which owns the add/remove/create UI.
  const watchlistItem = overview
    ? { tmdb_id: Number(tmdbId), title: overview.title, poster: overview.poster }
    : undefined;

  // "Pick up where you left off" — latest tracked episode for this show (or null).
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
