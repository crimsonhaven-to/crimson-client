import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useMovieStreamer } from './hooks';
import { useAccount } from '../account/useAccount';
import { useAuth } from '../account/useAuth';
import { useTitle } from '../useTitle';
import { apiFetch } from '../api/client';
import WatchView from '../watch/WatchView';
import SaveOffline from '../offline/SaveOffline';

function MovieWatch() {
  const { tmdbId } = useParams();

  const {
    overview, streamData, streamLoading,
    activeStreamIdx, selectStream, reloadStreams,
  } = useMovieStreamer(tmdbId);

  const { updateProgress } = useAccount();
  const { isAuthenticated } = useAuth();

  const displayTitle = overview?.title || streamData?.title;
  const poster = overview?.poster;

  useTitle(displayTitle ? `Watch ${displayTitle}` : 'Streaming Manifestation');

  // Live playback position so re-mounting the player (source switch) resumes where
  // the viewer is now, not the load-time saved position.
  const playbackRef = useRef(null);
  const livePositionRef = useRef(0);
  const handlePlayerProgress = useCallback((position, duration) => {
    playbackRef.current = { position, duration };
    livePositionRef.current = position;
  }, []);

  // Saved-position resume, keyed by tmdb_id in the movie namespace.
  const [resumeAt, setResumeAt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResumeAt(0);
    livePositionRef.current = 0;
    if (!isAuthenticated) return;
    (async () => {
      try {
        const res = await apiFetch(`/account/progress`);
        if (!res.ok) return;
        const data = await res.json();
        const row = (data.progress || []).find(p =>
          String(p.tmdb_id) === String(tmdbId) && p.media_type === 'movie'
        );
        if (cancelled || !row || row.status === 'completed') return;
        const pos = row.position_seconds || 0;
        const dur = row.duration_seconds || 0;
        if (pos < 5) return;
        if (dur && pos > dur - 15) return;
        setResumeAt(pos);
      } catch { /* best-effort resume */ }
    })();
    return () => { cancelled = true; };
  }, [tmdbId, isAuthenticated]);

  const playerStartAt = livePositionRef.current > 5 ? livePositionRef.current : resumeAt;

  useEffect(() => {
    if (!isAuthenticated || !streamData) return;
    playbackRef.current = null;
    const startedAt = Date.now();
    const save = () => {
      const pb = playbackRef.current;
      const position = pb ? pb.position : (Date.now() - startedAt) / 1000;
      const duration = pb && pb.duration ? pb.duration : 6000;
      if (position < 1) return;
      updateProgress({
        tmdb_id: parseInt(tmdbId),
        media_type: 'movie',
        title: displayTitle,
        poster,
        position_seconds: Math.round(position),
        duration_seconds: Math.round(duration),
      });
    };
    const timer = setInterval(save, 15000);
    return () => { clearInterval(timer); save(); };
  }, [tmdbId, streamData, isAuthenticated, updateProgress, displayTitle, poster]);

  const watchlistItem = { tmdb_id: parseInt(tmdbId), anilist_id: null, media_type: 'movie', title: displayTitle, poster };

  const offlineItems = [{
    id: `movie-${tmdbId}`,
    titleKey: `movie-${tmdbId}`,
    titleName: displayTitle || 'Movie',
    poster,
    href: `/movie/${tmdbId}`,
    kind: 'movie',
    target: { path: `/watch/movie/${tmdbId}`, ctx: { tmdbId, mediaType: 'movie' } },
    subtitleQuery: { tmdbId, isMovie: true },
  }];

  return (
    <WatchView
      isMovie
      streams={streamData?.streams || []}
      streamLoading={streamLoading}
      activeStreamIdx={activeStreamIdx}
      onSelectStream={selectStream}
      onReload={reloadStreams}
      poster={poster}
      playerStartAt={playerStartAt}
      onPlayerProgress={handlePlayerProgress}
      metadata={overview}
      displayTitle={displayTitle}
      totalSeasons={0}
      currentSeason={1}
      currentEpisode={1}
      refLabel={tmdbId}
      availableSeasons={[]}
      onSeasonChange={() => {}}
      onEpisodeChange={() => {}}
      isAuthenticated={isAuthenticated}
      watchlistItem={watchlistItem}
      saveAction={(
        <SaveOffline streams={streamData?.streams || []} activeStreamIdx={activeStreamIdx} items={offlineItems} />
      )}
      backUrl={`/movie/${tmdbId}`}
    />
  );
}

export default MovieWatch;
