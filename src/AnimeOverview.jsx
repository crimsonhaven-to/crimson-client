import { useParams, useNavigate } from 'react-router-dom';
import { useAnimeOverview, useAccount, useTitle } from './hooks';
import OverviewView from './OverviewView';

// Anime overview page (/anime/:anilistId). Thin wrapper: it owns the anime data
// source (useAnimeOverview) and where the play buttons navigate (the anilist-keyed
// /watch route), and hands everything to the shared <OverviewView> for rendering.
// The non-anime twin is ShowOverview, which uses the same view with a tmdb source.
const AnimeOverview = () => {
  const { anilistId } = useParams();
  const navigate = useNavigate();
  const {
    overview, loading, error,
    activeSeason, setActiveSeason,
    episodes, episodesLoading,
  } = useAnimeOverview(anilistId);

  useTitle(overview?.title || 'Overview');

  // Favorites — keyed by anilist_id (the overview payload carries one; fall back
  // to the URL param). toggleFavorite stores the minimal {id, title, poster} the
  // Favorites grid renders, mirroring the watch page's save button.
  const { favorites, toggleFavorite } = useAccount();
  const favId = overview?.anilist_id ?? Number(anilistId);
  const isFavorite = favorites.some(f => f.anilist_id === favId);
  const onToggleFavorite = overview
    ? () => toggleFavorite({ anilist_id: favId, title: overview.title, poster: overview.poster })
    : undefined;

  // A season can have its own anilist_id (TMDB-split long runs fall back to the
  // show's id) — unchanged from the original behaviour.
  const goToEpisode = (season, episodeNumber) => {
    const watchId = season.anilist_id || overview.anilist_id;
    navigate(`/watch/${watchId}/${season.season_number}/${episodeNumber}`);
  };

  const goToExtra = (extra) => navigate(`/watch/${extra.anilist_id}/1/1`);

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
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      notFoundText="This anime could not be summoned from the archives."
    />
  );
};

export default AnimeOverview;
