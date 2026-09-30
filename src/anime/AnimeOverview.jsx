import { useParams, useNavigate } from 'react-router-dom';
import { useAnimeOverview } from './hooks';
import { useShowResume } from '../watch/resume';
import { useTitle } from '../useTitle';
import OverviewView from '../watch/OverviewView';

const AnimeOverview = () => {
  const { anilistId } = useParams();
  const navigate = useNavigate();
  const {
    overview, loading, error,
    activeSeason, setActiveSeason,
    episodes, episodesLoading,
  } = useAnimeOverview(anilistId);

  useTitle(overview?.title || 'Overview');

  const favId = overview?.anilist_id ?? Number(anilistId);
  const watchlistItem = overview
    ? { anilist_id: favId, title: overview.title, poster: overview.poster }
    : undefined;

  const resume = useShowResume({ anilistId: favId });

  // A season can have its own anilist_id (TMDB-split long runs fall back to the show's id).
  const goToEpisode = (season, episodeNumber) => {
    const watchId = season.anilist_id || overview.anilist_id;
    navigate(`/watch/${watchId}/${season.season_number}/${episodeNumber}`);
  };

  // Extras split by what they actually are. A film TMDB tracks in its own right
  // carries a tmdb_movie_id and plays through the movie route (the anime route
  // would build a season/episode URL a film has no page for); a special/OVA/ONA
  // stays on the anilist route as season 0, the specials season.
  const goToExtra = (extra) => navigate(
    extra.tmdb_movie_id
      ? `/watch-movie/${extra.tmdb_movie_id}`
      : `/watch/${extra.anilist_id}/0/1`
  );

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
      onPlayExtra={goToExtra}
      watchlistItem={watchlistItem}
      resume={resume}
      genres={overview?.genres || []}
      mediaKind="anime"
      notFoundText="This anime could not be summoned from the archives."
    />
  );
};

export default AnimeOverview;
