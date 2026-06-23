import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMovieStreamer, useAccount, useAuth, useTitle, apiFetch } from './hooks';
import WatchView from './WatchView';

// General (non-anime) movie watch page (/watch-movie/:tmdbId). The movie twin of
// ShowWatch: it owns the movie data source (useMovieStreamer) + the account wiring
// (favorites + progress in the movie: namespace), then renders the shared
// <WatchView> in movie mode (no season/episode UI). Anime/shows untouched.
function MovieWatch() {
  const { tmdbId } = useParams();
  const navigate = useNavigate();

  const {
    overview, streamData, streamLoading,
    activeStreamIdx, selectStream,
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

  // Periodic + on-exit progress save (movie namespace; no season/episode).
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

  return (
    <WatchView
      isMovie
      streams={streamData?.streams || []}
      streamLoading={streamLoading}
      activeStreamIdx={activeStreamIdx}
      onSelectStream={selectStream}
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
      backUrl={`/movie/${tmdbId}`}
    />
  );
}

export default MovieWatch;
