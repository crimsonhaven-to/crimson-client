import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLocalStreamer, useAccount, useAuth, useTitle, apiFetch } from './hooks';
import WatchView from './WatchView';

// Local media watch page (/watch-local/:token). The token is the opaque path token
// of a single on-disk file (an episode, or a movie's feature file). It plays through
// the shared <WatchView> in movie mode — no TMDB season/episode picker, since local
// episode navigation lives on the LocalOverview page (each episode is its own token).
//
// Watch progress lives in the `local:` namespace: keyed by `localId` (the TITLE token,
// so all episodes dedup as one show in history) + season/episode. Title, back link,
// poster and that identity are carried as query params from the overview (a bare file
// token has none of its own).
function LocalWatch() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const title = params.get('title') || 'Local Media';
  const backUrl = params.get('back') || '/catalogue';
  const poster = params.get('poster') || undefined;
  const localId = params.get('localId') || null;
  const season = params.get('season');
  const episode = params.get('episode');
  const seasonNum = season != null ? parseInt(season) : null;
  const episodeNum = episode != null ? parseInt(episode) : null;

  const { streamData, streamLoading, activeStreamIdx, selectStream, reloadStreams } = useLocalStreamer(token);
  const { updateProgress } = useAccount();
  const { isAuthenticated } = useAuth();

  useTitle(title ? `Watch ${title}` : 'Local Media');

  // Live playback position so a source switch resumes where the viewer is now.
  const playbackRef = useRef(null);
  const livePositionRef = useRef(0);
  const handlePlayerProgress = useCallback((position, duration) => {
    playbackRef.current = { position, duration };
    livePositionRef.current = position;
  }, []);

  // Saved-position resume: find the matching row in the `local:` namespace (same
  // local_id + season + episode). Movies have no season/episode, so match on
  // local_id alone.
  const [resumeAt, setResumeAt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResumeAt(0);
    livePositionRef.current = 0;
    if (!isAuthenticated || !localId) return undefined;
    (async () => {
      try {
        const res = await apiFetch(`/account/progress`);
        if (!res.ok) return;
        const rows = (await res.json()).progress || [];
        const row = rows.find(p =>
          p.media_type === 'local' &&
          String(p.local_id) === String(localId) &&
          (seasonNum == null || Number(p.season_number) === seasonNum) &&
          (episodeNum == null || Number(p.episode_number) === episodeNum)
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
  }, [localId, seasonNum, episodeNum, isAuthenticated]);

  const playerStartAt = livePositionRef.current > 5 ? livePositionRef.current : resumeAt;

  // Periodic + on-exit progress save into the `local:` namespace.
  useEffect(() => {
    if (!isAuthenticated || !localId || !streamData) return undefined;
    playbackRef.current = null;
    const startedAt = Date.now();
    const save = () => {
      const pb = playbackRef.current;
      const position = pb ? pb.position : (Date.now() - startedAt) / 1000;
      const duration = pb && pb.duration ? pb.duration : 0;
      if (position < 1) return;
      updateProgress({
        media_type: 'local',
        local_id: localId,
        season_number: seasonNum,
        episode_number: episodeNum,
        title,
        poster,
        position_seconds: Math.round(position),
        duration_seconds: Math.round(duration) || undefined,
      });
    };
    const timer = setInterval(save, 15000);
    return () => { clearInterval(timer); save(); };
  }, [localId, seasonNum, episodeNum, streamData, isAuthenticated, updateProgress, title, poster]);

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
