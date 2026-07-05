import { useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLocalStreamer, useAuth, useTitle } from './hooks';
import WatchView from './WatchView';

// Local media watch page (/watch-local/:token). The token is the opaque path token
// of a single on-disk file (an episode, or a movie's feature file). It plays through
// the shared <WatchView> in movie mode — no TMDB season/episode picker, since local
// episode navigation lives on the LocalOverview page (each episode is its own token).
// Title + the back link are carried as query params from the overview (a bare file
// token has no title of its own).
function LocalWatch() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const title = params.get('title') || 'Local Media';
  const backUrl = params.get('back') || '/catalogue';
  const poster = params.get('poster') || undefined;

  const { streamData, streamLoading, activeStreamIdx, selectStream, reloadStreams } = useLocalStreamer(token);
  const { isAuthenticated } = useAuth();

  useTitle(title ? `Watch ${title}` : 'Local Media');

  // Live playback position so a source switch resumes where the viewer is now.
  const livePositionRef = useRef(0);
  const handlePlayerProgress = useCallback((position) => {
    livePositionRef.current = position;
  }, []);

  return (
    <WatchView
      isMovie
      streams={streamData?.streams || []}
      streamLoading={streamLoading}
      activeStreamIdx={activeStreamIdx}
      onSelectStream={selectStream}
      onReload={reloadStreams}
      poster={poster}
      playerStartAt={0}
      onPlayerProgress={handlePlayerProgress}
      metadata={{ title }}
      displayTitle={title}
      totalSeasons={0}
      currentSeason={1}
      currentEpisode={1}
      refLabel="LOCAL"
      availableSeasons={[]}
      onSeasonChange={() => {}}
      onEpisodeChange={() => {}}
      isAuthenticated={isAuthenticated}
      watchlistItem={null}
      backUrl={backUrl}
    />
  );
}

export default LocalWatch;
