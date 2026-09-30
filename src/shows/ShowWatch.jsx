import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShowStreamer } from './hooks';
import { useAccount } from '../account/useAccount';
import { useAuth } from '../account/useAuth';
import { useTitle } from '../useTitle';
import { apiFetch } from '../api/client';
import { startsFresh } from '../watch/resumeRules';
import WatchView from '../watch/WatchView';

// The backend keys favorites and progress by tmdb_id when there's no anilist_id.
function ShowWatch() {
  const { tmdbId, season = '1', episode = '1' } = useParams();
  const navigate = useNavigate();
  const currentSeason = parseInt(season);
  const currentEpisode = parseInt(episode);

  const {
    overview, metadata,
    streamData, streamLoading, unaired,
    activeStreamIdx, selectStream, reloadStreams,
  } = useShowStreamer(tmdbId, currentSeason, currentEpisode);

  const { updateProgress } = useAccount();
  const { isAuthenticated } = useAuth();

  const availableSeasons = overview?.seasons || [];
  const displayTitle = overview?.title || metadata?.title;
  const totalSeasons = overview?.total_seasons || availableSeasons.length;
  const poster = overview?.poster || metadata?.poster;

  useTitle(displayTitle ? `Watch ${displayTitle}` : 'Streaming Manifestation');

  // Live playback position so re-mounting the player (source switch) resumes where
  // the viewer is now, not the load-time saved position.
  const playbackRef = useRef(null);
  const livePositionRef = useRef(0);
  const handlePlayerProgress = useCallback((position, duration) => {
    playbackRef.current = { position, duration };
    livePositionRef.current = position;
  }, []);

  // Rolling into the next episode starts it at 0, ignoring a position saved on an
  // earlier watch-through. Direct navigation still resumes.
  const startFreshKeyRef = useRef(null);
  const markEpisodeAdvance = (nextSeason, nextEpisode) => {
    if (startsFresh(playbackRef.current, currentSeason, currentEpisode, nextSeason, nextEpisode)) {
      startFreshKeyRef.current = `${nextSeason}:${nextEpisode}`;
    }
  };

  // Shows have no anilist_id, so progress rows match on tmdb_id.
  const [resumeAt, setResumeAt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResumeAt(0);
    livePositionRef.current = 0;
    if (startFreshKeyRef.current === `${currentSeason}:${currentEpisode}`) {
      startFreshKeyRef.current = null; // one-shot: consumed by this episode load
      return;
    }
    if (!isAuthenticated) return;
    (async () => {
      try {
        const res = await apiFetch(`/account/progress`);
        if (!res.ok) return;
        const data = await res.json();
        const row = (data.progress || []).find(p =>
          String(p.tmdb_id) === String(tmdbId) &&
          Number(p.season_number) === currentSeason &&
          Number(p.episode_number) === currentEpisode
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
  }, [tmdbId, currentSeason, currentEpisode, isAuthenticated]);

  const playerStartAt = livePositionRef.current > 5 ? livePositionRef.current : resumeAt;

  useEffect(() => {
    if (!isAuthenticated || !metadata) return;
    playbackRef.current = null;
    const startedAt = Date.now();
    const save = () => {
      const pb = playbackRef.current;
      const position = pb ? pb.position : (Date.now() - startedAt) / 1000;
      const duration = pb && pb.duration ? pb.duration : 1440;
      if (position < 1) return;
      updateProgress({
        tmdb_id: parseInt(tmdbId),
        season_number: currentSeason,
        episode_number: currentEpisode,
        title: displayTitle,
        poster,
        position_seconds: Math.round(position),
        duration_seconds: Math.round(duration),
      });
    };
    const timer = setInterval(save, 15000);
    return () => { clearInterval(timer); save(); };
  }, [tmdbId, currentSeason, currentEpisode, metadata, isAuthenticated, updateProgress, displayTitle, poster]);

  const watchlistItem = { tmdb_id: parseInt(tmdbId), anilist_id: null, title: displayTitle, poster };

  const onSeasonChange = (newSeason) => navigate(`/watch-show/${tmdbId}/${newSeason}/1`);
  const onEpisodeChange = (newEpisode) => {
    markEpisodeAdvance(currentSeason, newEpisode);
    navigate(`/watch-show/${tmdbId}/${currentSeason}/${newEpisode}`);
  };
  const onSelectEpisode = (newSeason, newEpisode) => {
    markEpisodeAdvance(newSeason, newEpisode);
    navigate(`/watch-show/${tmdbId}/${newSeason}/${newEpisode}`);
  };

  return (
    <WatchView
      streams={streamData?.streams || []}
      streamLoading={streamLoading}
      unaired={unaired}
      activeStreamIdx={activeStreamIdx}
      onSelectStream={selectStream}
      onReload={reloadStreams}
      poster={poster}
      playerStartAt={playerStartAt}
      onPlayerProgress={handlePlayerProgress}
      metadata={metadata}
      displayTitle={displayTitle}
      totalSeasons={totalSeasons}
      currentSeason={currentSeason}
      currentEpisode={currentEpisode}
      refLabel={tmdbId}
      availableSeasons={availableSeasons}
      onSeasonChange={onSeasonChange}
      onEpisodeChange={onEpisodeChange}
      onSelectEpisode={onSelectEpisode}
      isAuthenticated={isAuthenticated}
      watchlistItem={watchlistItem}
      backUrl={`/show/${tmdbId}`}
    />
  );
}

export default ShowWatch;
