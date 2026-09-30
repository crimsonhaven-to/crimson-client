import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAnimeStreamer } from './useAnimeStreamer';
import { useAccount } from '../account/useAccount';
import { useAuth } from '../account/useAuth';
import { useTitle } from '../shell/useTitle';
import { startsFresh } from '../watch/resumeRules';
import WatchView from '../watch/WatchView';

export default function AnimeWatch() {
  const { anilistId, season = '1', episode = '1' } = useParams();
  const navigate = useNavigate();
  const progressTimerRef = useRef(null);
  const playbackRef = useRef(null);
  // A re-mounted player (source switch) resumes here rather than at the load-time saved position.
  const livePositionRef = useRef(0);
  const handlePlayerProgress = useCallback((position, duration) => {
    playbackRef.current = { position, duration };
    livePositionRef.current = position;
  }, []);

  const {
    animeMetadata, streamData,
    streamLoading, unaired,
    availableSeasons, seasonGroups,
    currentSeason, setCurrentSeason,
    currentEpisode, setCurrentEpisode,
    activeStreamIdx, setActiveStreamIdx,
    initializeFromIds, reloadStreams
  } = useAnimeStreamer({ initialAnilistId: anilistId, initialSeason: parseInt(season), initialEpisode: parseInt(episode) });

  const { updateProgress, fetchResumePosition } = useAccount();
  const { isAuthenticated } = useAuth();

  // After finishing an episode and rolling into the next, a re-watch must start at 0
  // rather than jump to a stale spot from an earlier watch-through. Stamped at change
  // time because only then is the outgoing episode's playback state still known.
  // Direct navigation never stamps, so it still resumes.
  const startFreshKeyRef = useRef(null);
  const markEpisodeAdvance = (nextSeason, nextEpisode) => {
    if (startsFresh(playbackRef.current, currentSeason, currentEpisode, nextSeason, nextEpisode)) {
      startFreshKeyRef.current = `${nextSeason}:${nextEpisode}`;
    }
  };

  // Reset to 0 first so a new episode never inherits a stale seek.
  const [resumeAt, setResumeAt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResumeAt(0);
    livePositionRef.current = 0;
    if (startFreshKeyRef.current === `${currentSeason}:${currentEpisode}`) {
      startFreshKeyRef.current = null;
      return;
    }
    if (!isAuthenticated) return;
    fetchResumePosition(anilistId, parseInt(currentSeason), parseInt(currentEpisode))
      .then(pos => { if (!cancelled && pos) setResumeAt(pos); });
    return () => { cancelled = true; };
  }, [anilistId, currentSeason, currentEpisode, isAuthenticated, fetchResumePosition]);

  const playerStartAt = livePositionRef.current > 5 ? livePositionRef.current : resumeAt;
  
  useTitle(animeMetadata?.title ? `Watch ${animeMetadata.title}` : 'Streaming Manifestation');

  const watchlistItem = { ...animeMetadata, anilist_id: parseInt(anilistId) };

  useEffect(() => {
    if (anilistId) {
      initializeFromIds(anilistId, parseInt(season), parseInt(episode));
    }
  }, [anilistId, season, episode, initializeFromIds]);

  useEffect(() => {
    if (!isAuthenticated || !animeMetadata) return;

    playbackRef.current = null;
    const startedAt = Date.now();

    const save = () => {
      const pb = playbackRef.current;
      const position = pb ? pb.position : (Date.now() - startedAt) / 1000;
      const duration = pb && pb.duration ? pb.duration : 1440;
      if (position < 1) return;
      updateProgress({
        tmdb_id: animeMetadata.tmdb_id,
        anilist_id: parseInt(anilistId),
        season_number: parseInt(currentSeason),
        episode_number: parseInt(currentEpisode),
        title: animeMetadata.title,
        poster: animeMetadata.poster,
        position_seconds: Math.round(position),
        duration_seconds: Math.round(duration),
      });
    };

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(save, 15000);

    return () => {
      clearInterval(progressTimerRef.current);
      save();
    };
  }, [anilistId, currentSeason, currentEpisode, animeMetadata, isAuthenticated, updateProgress]);

  const handleEpisodeChange = (newEpisode) => {
    markEpisodeAdvance(currentSeason, newEpisode);
    setCurrentEpisode(newEpisode);
    navigate(`/watch/${anilistId}/${currentSeason}/${newEpisode}`);
  };

  const handleSelectEpisode = (newSeason, newEpisode) => {
    markEpisodeAdvance(newSeason, newEpisode);
    setCurrentSeason(newSeason);
    setCurrentEpisode(newEpisode);
    navigate(`/watch/${anilistId}/${newSeason}/${newEpisode}`);
  };

  return (
    <WatchView
      streams={streamData?.streams || []}
      streamLoading={streamLoading}
      unaired={unaired}
      activeStreamIdx={activeStreamIdx}
      onSelectStream={setActiveStreamIdx}
      onReload={reloadStreams}
      poster={animeMetadata?.poster}
      playerStartAt={playerStartAt}
      onPlayerProgress={handlePlayerProgress}
      metadata={animeMetadata}
      displayTitle={seasonGroups?.title || animeMetadata?.title}
      totalSeasons={seasonGroups?.totalSeasons}
      currentSeason={currentSeason}
      currentEpisode={currentEpisode}
      refLabel={animeMetadata?.anilist_id}
      availableSeasons={availableSeasons}
      onEpisodeChange={handleEpisodeChange}
      onSelectEpisode={handleSelectEpisode}
      isAuthenticated={isAuthenticated}
      watchlistItem={watchlistItem}
      backUrl={`/anime/${anilistId}`}
    />
  );
}
