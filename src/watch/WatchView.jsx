import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarClock, Puzzle, X, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { apiFetch } from '../api/client';
import { fetchSubtitles, fetchSkipTimes } from './media';
import { usePlaybackPrefs } from '../account/playbackPrefs';
import { setWatchActivity, clearWatchActivity } from '../presence/discordPresence';
import { stripHtml } from '../stripHtml';
import { formatAirDate } from '../formatAirDate';
import WatchlistButton from '../library/WatchlistButton';
import { useEpisodePicker } from './useEpisodePicker';
import EpisodePicker from './EpisodePicker';
import SourcePicker from './SourcePicker';
import { useCompanionNudge } from '../sources/companion';

const CrimsonPlayer = lazy(() => import('./CrimsonPlayer'));

// Waiting this long before letting the backend cache a source keeps the fastest-resolving
// source from being cached over the one the viewer actually settled on.
const CACHE_CONFIRM_SECONDS = 10;

const WatchView = ({
  streams = [], streamLoading, activeStreamIdx, onSelectStream, onReload,
  unaired,
  poster, playerStartAt, onPlayerProgress,
  metadata, displayTitle, totalSeasons,
  currentSeason, currentEpisode, refLabel,
  availableSeasons = [], onEpisodeChange,
  // onEpisodeChange only moves within the current season; this jumps across seasons.
  onSelectEpisode,
  isAuthenticated, watchlistItem,
  // The page's Save offline button. The page renders it because it alone knows
  // how to find each episode's link again later.
  saveAction = null,
  backUrl,
  isMovie = false,
}) => {
  // Memoized because it feeds an effect's deps, which would otherwise re-run every render.
  const episodesList = useMemo(() => metadata?.episodes_list || [], [metadata]);
  const currentEpisodeData = episodesList.find(e => e.episode_number === currentEpisode);
  const episodeTitle = currentEpisodeData?.title && currentEpisodeData.title !== `Episode ${currentEpisode}`
    ? currentEpisodeData.title
    : null;

  const currentEpisodeIdx = episodesList.findIndex(e => e.episode_number === currentEpisode);
  const nextEpisodeData = !isMovie && currentEpisodeIdx >= 0 ? episodesList[currentEpisodeIdx + 1] : null;
  const goToNextEpisode = useCallback(() => {
    if (nextEpisodeData) onEpisodeChange(nextEpisodeData.episode_number);
  }, [nextEpisodeData, onEpisodeChange]);
  const nextEpisodeLabel = nextEpisodeData
    ? (nextEpisodeData.title && nextEpisodeData.title !== `Episode ${nextEpisodeData.episode_number}`
        ? `E${nextEpisodeData.episode_number} · ${nextEpisodeData.title}`
        : `Episode ${nextEpisodeData.episode_number}`)
    : '';
  const episodeDescription = currentEpisodeData?.overview
    || metadata?.summary
    || stripHtml(metadata?.description)
    || 'No summary asset provided.';

  const activeStream = !streamLoading ? streams[activeStreamIdx] : null;

  // The player stays mounted across episode jumps (to keep fullscreen), so the OLD
  // episode keeps reporting timeupdates while the next one resolves. Forwarding them
  // would make the next episode resume at the old one's end, so progress is only
  // forwarded once the attached stream belongs to the current episode.
  // The key advances one render BEFORE the streamer flips streamLoading, so that
  // render pairs the new key with the old loaded state. Requiring streamLoading to
  // have been seen for this key first keeps the gate shut there.
  const currentPlayKey = `${currentSeason}:${currentEpisode}`;
  const playingKeyRef = useRef(null);
  const loadSeenKeyRef = useRef(null);
  useEffect(() => {
    if (streamLoading) {
      loadSeenKeyRef.current = currentPlayKey;
    } else if (streams.length > 0 && loadSeenKeyRef.current === currentPlayKey) {
      playingKeyRef.current = currentPlayKey;
    }
  }, [streamLoading, streams, currentPlayKey]);

  // activeStream is briefly null while the next episode resolves. Unmounting the
  // player then would drop fullscreen, and browsers need a fresh gesture to re-enter,
  // so the last video stream is held through the gap. iframes can't keep fullscreen
  // this way anyway, so they're excluded.
  // The stream carries its episode key because capture endpoints can serve every
  // episode from the SAME url; the player reloads on the key as well as on src.
  const lastVideoStreamRef = useRef(null);
  useEffect(() => {
    if (activeStream && activeStream.type !== 'iframe' && loadSeenKeyRef.current === currentPlayKey) {
      lastVideoStreamRef.current = { stream: activeStream, key: currentPlayKey };
    }
  }, [activeStream, currentPlayKey]);
  const attachedPlay = (activeStream && activeStream.type !== 'iframe' && loadSeenKeyRef.current === currentPlayKey)
    ? { stream: activeStream, key: currentPlayKey }
    : ((streamLoading || activeStream) ? lastVideoStreamRef.current : null);
  const playerStream = attachedPlay?.stream || null;
  const playerKey = attachedPlay?.key ?? null;

  const episodePicker = useEpisodePicker({
    isMovie, currentSeason, currentEpisode, episodesList, availableSeasons,
    onEpisodeChange, onSelectEpisode,
  });

  const tmdbId = metadata?.tmdb_id;

  // A manual pick is deliberately not persisted across episodes: every load re-ranks
  // on the viewer's language preference.
  const handleSelectStream = useCallback((idx) => {
    onSelectStream?.(idx);
  }, [onSelectStream]);

  // The anonymous beacon feeds the admin Client Resolve Stats.
  const handleReportBroken = useCallback((idx) => {
    const s = streams[idx];
    if (s?.source) {
      try {
        apiFetch('/telemetry/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: [{ source: s.source, ok: false, env: 'report' }] }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* never let a report affect playback */ }
    }
    if (streams.length > 1) handleSelectStream((idx + 1) % streams.length);
  }, [streams, handleSelectStream]);

  const { show: companionNudge, dismiss: dismissNudge } = useCompanionNudge();
  const showCompanionNudge = !unaired && !streamLoading && companionNudge;

  // Explicit expand/collapse choices for stacked source groups, kept here so they
  // survive the source list unmounting while sources rescan.
  const [openGroups, setOpenGroups] = useState({});

  // OpenSubtitles tracks are per title, not per source, so they're fetched here and
  // merged into the active source's own tracks.
  const [prefs] = usePlaybackPrefs();
  const subLangs = prefs.subtitleLanguages || [];
  const subLangKey = subLangs.join(',');
  // Anime season groups aren't 1:1 with TMDB seasons.
  const tmdbSeason = metadata?.current_season ?? currentSeason;
  const [openSubs, setOpenSubs] = useState([]);

  useEffect(() => {
    setOpenSubs([]);
    if (!tmdbId || !subLangs.length) return undefined;
    let cancelled = false;
    fetchSubtitles({
      tmdbId,
      season: isMovie ? null : tmdbSeason,
      episode: isMovie ? null : currentEpisode,
      isMovie,
      languages: subLangs,
    }).then((tracks) => { if (!cancelled) setOpenSubs(tracks); });
    return () => { cancelled = true; };
    // subLangKey stands in for the array identity so we don't refetch each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, tmdbSeason, currentEpisode, isMovie, subLangKey]);

  // AniSkip returns the OP/ED window for the closest episode length it has, and
  // encodes differ by tens of seconds, so it's re-fetched per source with the
  // measured duration of the file actually playing.
  const anilistId = metadata?.anilist_id;
  const [skipTimes, setSkipTimes] = useState(null);
  // 0 until the player reports it, so the first fetch is refined once measured.
  const [playerDuration, setPlayerDuration] = useState(0);
  const activeStreamUrl = activeStream?.url;
  useEffect(() => {
    setSkipTimes(null);
    setPlayerDuration(0);
  }, [anilistId, activeStreamUrl, currentEpisode]);
  // Round so sub-second `timeupdate` jitter doesn't re-fire the fetch.
  const roundedDuration = Math.round(playerDuration) || 0;
  useEffect(() => {
    if (isMovie || !anilistId || !currentEpisode) return undefined;
    let cancelled = false;
    fetchSkipTimes({ anilistId, episode: currentEpisode, episodeLength: roundedDuration })
      .then((st) => { if (!cancelled) setSkipTimes(st); });
    return () => { cancelled = true; };
  }, [anilistId, currentEpisode, isMovie, roundedDuration]);

  const mergedSubtitles = useMemo(() => {
    const base = Array.isArray(activeStream?.subtitles) ? activeStream.subtitles : [];
    const seen = new Set(base.map((s) => s?.url));
    return [...base, ...openSubs.filter((s) => s && !seen.has(s.url))];
  }, [activeStream, openSubs]);

  // Re-runs per episode so Discord's "elapsed" timer resets.
  useEffect(() => {
    if (!displayTitle) return undefined;
    setWatchActivity({
      title: displayTitle,
      isMovie,
      season: currentSeason,
      episode: currentEpisode,
      totalSeasons,
      startedAt: Date.now(),
    });
    return () => clearWatchActivity();
  }, [displayTitle, isMovie, currentSeason, currentEpisode, totalSeasons]);

  const confirmedTicketsRef = useRef(new Set());
  const handlePlayerProgress = useCallback((position, duration) => {
    if (playingKeyRef.current !== currentPlayKey) return;
    if (onPlayerProgress) onPlayerProgress(position, duration);
    if (duration && Number.isFinite(duration)) {
      setPlayerDuration((prev) => (Math.round(prev) === Math.round(duration) ? prev : duration));
    }
    const ticket = activeStream?.cacheTicket;
    if (!ticket || position < CACHE_CONFIRM_SECONDS) return;
    if (confirmedTicketsRef.current.has(ticket)) return;
    confirmedTicketsRef.current.add(ticket);
    // Dropped on failure so a later progress tick retries.
    apiFetch('/cache/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    }).catch(() => confirmedTicketsRef.current.delete(ticket));
  }, [onPlayerProgress, activeStream, currentPlayKey]);

  // e.g. "Frieren - S1E04 - The Land Where Souls Rest"
  const downloadName = isMovie
    ? (displayTitle || 'video')
    : [
        displayTitle || 'video',
        totalSeasons > 1 ? `S${currentSeason}E${currentEpisode}` : `E${currentEpisode}`,
        episodeTitle,
      ].filter(Boolean).join(' - ');

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-4 gap-8 sm:gap-10 animate-in fade-in duration-1000">
      <div className="lg:col-span-3 space-y-8">
        <Link
          to={backUrl}
          className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 hover:bg-crimson-900/30 transition-all duration-300 text-[11px] font-black uppercase tracking-widest active:scale-95 backdrop-blur-sm shadow-xl"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
          Back to Overview
        </Link>
        <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-crimson-900/60 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
          {streamLoading && !unaired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 z-20 p-6 text-center backdrop-blur-md">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
                <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 blur-xl bg-crimson-500/20 rounded-full animate-pulse"></div>
              </div>
              <p className="text-crimson-400 font-black tracking-[0.3em] animate-pulse text-xs uppercase">Resolving manifest vectors</p>
            </div>
          )}
          {unaired ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-crimson-950/70 backdrop-blur-sm">
              <CalendarClock className="w-16 h-16 text-crimson-500 mb-5 opacity-70" />
              <p className="text-crimson-50 font-black uppercase tracking-[0.2em] text-base sm:text-lg">Not Yet Manifested</p>
              <p className="text-crimson-300/80 mt-3 max-w-md font-medium text-sm leading-relaxed">
                This segment hasn't crossed into our dimension yet.
                {unaired.airDate && (
                  <> It materialises <span className="text-crimson-400 font-black">{formatAirDate(unaired.airDate)}</span>.</>
                )}
              </p>
            </div>
          ) : (activeStream && activeStream.type === 'iframe') ? (
              (() => {
                const url = activeStream.url;
                // Our own pages are sandboxed without allow-popups or allow-top-navigation
                // to kill pop-unders; third-party players break inside a sandbox.
                const sandboxed = typeof url === 'string'
                  && (url.startsWith(API_BASE_URL) || url.startsWith(window.location.origin));
                return (
                  <iframe
                    src={url}
                    title="Stream"
                    className="w-full h-full"
                    sandbox={sandboxed ? "allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock" : undefined}
                    allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                    referrerPolicy="no-referrer"
                    allowFullScreen
                    scrolling="no"
                  />
                );
              })()
            ) : playerStream ? (
              <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
                <CrimsonPlayer
                  // No `key` on purpose: a remount would drop fullscreen on every
                  // episode advance. The player reloads sources in place.
                  src={playerStream.url}
                  mediaKey={playerKey}
                  type={playerStream.type}
                  subtitles={mergedSubtitles}
                  poster={poster}
                  title={displayTitle}
                  downloadName={downloadName}
                  // During the resolve gap the OLD episode is on screen, and the
                  // next episode's resume position must not seek it.
                  startAt={streamLoading ? 0 : playerStartAt}
                  onProgress={handlePlayerProgress}
                  onNext={isMovie ? undefined : goToNextEpisode}
                  hasNext={!!nextEpisodeData}
                  nextLabel={nextEpisodeLabel}
                  skipTimes={skipTimes}
                  sources={streams}
                  activeSourceIdx={activeStreamIdx}
                  onSelectSource={handleSelectStream}
                  onReportBroken={handleReportBroken}
                  episodePicker={episodePicker}
                />
              </Suspense>
            ) : (
            !streamLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-crimson-950/50 backdrop-blur-sm">
                <AlertTriangle className="w-16 h-16 text-crimson-500 mb-4 opacity-50" />
                <p className="text-crimson-50 font-black uppercase tracking-widest text-sm">No transport nodes active</p>
              </div>
            )
          )}
        </div>

        <div className="p-6 sm:p-10 bg-crimson-950/40 border border-crimson-900/40 rounded-[2.5rem] backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 relative z-10">
            <div className="space-y-6 w-full">
              <div className="flex flex-wrap gap-3 items-center">
                {metadata?.status && (
                  <span className="bg-crimson-500/10 text-crimson-400 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-crimson-500/30 backdrop-blur-md">
                    {metadata.status}
                  </span>
                )}
                <span className="text-[10px] text-crimson-600 font-black tracking-widest uppercase opacity-70">
                  REF: {refLabel || 'UNK'}
                </span>
                {(saveAction || (isAuthenticated && watchlistItem)) && (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {saveAction}
                    {isAuthenticated && watchlistItem && <WatchlistButton item={watchlistItem} variant="watch" />}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-crimson-50 leading-[1.1]">
                  {displayTitle || 'Unknown Cluster'}
                  {totalSeasons > 1 && (
                    <span className="text-xl text-crimson-500 ml-3 opacity-80">S{currentSeason}</span>
                  )}
                </h1>
                {episodeTitle && (
                  <p className="text-base sm:text-xl font-bold text-crimson-400 tracking-tight leading-snug">
                    <span className="text-crimson-600 font-black uppercase text-sm mr-2 opacity-60">E{currentEpisode}</span> {episodeTitle}
                  </p>
                )}
              </div>
              <p className="text-sm sm:text-base text-crimson-100/60 leading-relaxed text-justify line-clamp-4 sm:line-clamp-none font-medium">
                {episodeDescription}
              </p>
            </div>
            {!isMovie && (
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:flex-none bg-crimson-950/80 border border-crimson-900/60 px-6 py-4 rounded-2xl text-center min-w-[90px] shadow-xl">
                  <p className="text-[10px] uppercase text-crimson-500 font-black tracking-[0.3em] mb-1">SN</p>
                  <p className="text-2xl font-black text-crimson-50">{currentSeason}</p>
                </div>
                <div className="flex-1 sm:flex-none bg-crimson-900/20 border border-crimson-800/40 px-6 py-4 rounded-2xl text-center min-w-[90px] shadow-xl">
                  <p className="text-[10px] uppercase text-crimson-400 font-black tracking-[0.3em] mb-1">EP</p>
                  <p className="text-2xl font-black text-crimson-50">{currentEpisode}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isMovie && episodePicker && <EpisodePicker {...episodePicker} />}
      </div>

      <div className="lg:col-span-1 space-y-6">
        <div className="bg-crimson-950/40 border border-crimson-900/40 p-6 sm:p-8 rounded-[2rem] sticky top-28 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

          <h3 className="text-lg font-black text-crimson-50 mb-8 flex items-center gap-3 uppercase tracking-tighter relative z-10">
            <div className="relative">
               {streamLoading && <div className="w-2.5 h-2.5 rounded-full bg-crimson-500 animate-ping absolute inset-0"></div>}
               <div className="w-2.5 h-2.5 rounded-full bg-crimson-600 relative"></div>
            </div>
            Scraped Targets
            {!unaired && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 normal-nums">
                  {streamLoading
                    ? `Scanning${streams.length ? ` · ${streams.length}` : '…'}`
                    : streams.length
                      ? `${streams.length} found`
                      : 'none'}
                </span>
                {onReload && !streamLoading && (
                  <button
                    onClick={onReload}
                    title="Rescan: re-resolve sources from scratch"
                    aria-label="Rescan sources"
                    className="text-crimson-700 hover:text-crimson-400 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 gap-3 relative z-10">
            {unaired ? (
              <div className="col-span-full p-8 bg-crimson-950/80 rounded-2xl text-center border border-dashed border-crimson-900/40 space-y-2">
                <CalendarClock className="w-6 h-6 text-crimson-700 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 italic">
                  Awaiting transmission{unaired.airDate ? ` · ${formatAirDate(unaired.airDate)}` : ''}
                </p>
              </div>
            ) : streamLoading && !streams.length ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-crimson-950/40 animate-pulse rounded-2xl border border-crimson-900/30"></div>
              ))
            ) : streams.length > 0 ? (
              <SourcePicker
                streams={streams}
                activeStreamIdx={activeStreamIdx}
                onSelectStream={handleSelectStream}
                openGroups={openGroups}
                onOpenGroupsChange={setOpenGroups}
              />
            ) : (
              <div className="col-span-full p-8 bg-crimson-950/80 rounded-2xl text-center border border-dashed border-crimson-900/40 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-800 italic">Zero transport nodes active</p>
                {onReload && (
                  <button
                    onClick={onReload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_10px_25px_rgba(255,0,60,0.2)]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Rescan sources
                  </button>
                )}
              </div>
            )}
          </div>

          {streamLoading && streams.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-2 animate-pulse">
               <div className="w-1.5 h-1.5 bg-crimson-500 rounded-full"></div>
               <span className="text-[8px] font-black uppercase tracking-[0.3em] text-crimson-600">Probing more nodes</span>
            </div>
          )}

          {showCompanionNudge && (
            <div className="mt-6 relative z-10 flex items-start gap-3 p-4 rounded-2xl bg-crimson-500/[0.07] border border-crimson-500/25">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-crimson-500/15 border border-crimson-500/30 text-crimson-400 shrink-0">
                <Puzzle className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-grow">
                <Link to="/extension" className="block text-[11px] font-black text-crimson-50 leading-snug hover:text-crimson-300 transition-colors">
                  Want more transport nodes? Claim the Companion. 🦇
                </Link>
                <p className="text-[10px] text-crimson-100/50 font-medium leading-snug mt-0.5">
                  It resolves &amp; plays extra sources locally, straight from your browser.
                </p>
              </div>
              <button
                onClick={dismissNudge}
                aria-label="Dismiss"
                className="shrink-0 text-crimson-700 hover:text-crimson-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchView;
