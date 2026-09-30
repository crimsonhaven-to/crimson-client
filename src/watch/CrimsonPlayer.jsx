import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, Maximize, Minimize, Settings, RotateCcw, RotateCw, PictureInPicture2,
  SkipForward, ListVideo,
} from 'lucide-react';
import { attachBackendAuth } from './player/backendAuth';
import { useFullscreen } from './player/useFullscreen';
import { useAutoHideControls } from './player/useAutoHideControls';
import { useAutoNext } from './player/useAutoNext';
import { useStreamDownload } from './player/useStreamDownload';
import { usePlayerShortcuts, SKIP_SECONDS } from './player/usePlayerShortcuts';
import BufferingSpinner from './player/BufferingSpinner';
import BigPlayButton from './player/BigPlayButton';
import PlayerTitle from './player/PlayerTitle';
import PlaybackError from './player/PlaybackError';
import SkipSegmentButton from './player/SkipSegmentButton';
import AutoNextCard from './player/AutoNextCard';
import SeekBar from './player/SeekBar';
import VolumeControl from './player/VolumeControl';
import TimeReadout from './player/TimeReadout';
import SourceMenu from './player/SourceMenu';
import QualityMenu from './player/QualityMenu';
import SubtitleMenu from './player/SubtitleMenu';
import DownloadButton from './player/DownloadButton';
import PlayerEpisodeList from './player/PlayerEpisodeList';

// `mediaKey` identifies the episode `src` belongs to. Capture endpoints can serve
// every episode from the SAME url, so reloading on `src` alone would keep the old
// episode's position.
export default function CrimsonPlayer({ src, mediaKey = null, type = '', subtitles = [], poster = '', title = '', downloadName = '', autoPlay = true, startAt = 0, onProgress, onNext, hasNext = false, nextLabel = '', skipTimes = null, sources = [], activeSourceIdx = -1, onSelectSource, onReportBroken, episodePicker = null, live = false, onFatalError = null, hlsLoader = null }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  // Refs so the []-dep event listeners see the latest values without re-subscribing.
  // seekedRef limits the resume seek to once per source, so it never fights a scrubbing user.
  const startAtRef = useRef(startAt);
  const seekedRef = useRef(false);
  useEffect(() => { startAtRef.current = startAt; }, [startAt]);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  const onNextRef = useRef(onNext);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);
  // Live TV: returning true means the parent swapped `src` to a fallback, so no error screen.
  const onFatalErrorRef = useRef(onFatalError);
  useEffect(() => { onFatalErrorRef.current = onFatalError; }, [onFatalError]);
  const netRetriesRef = useRef(0);
  const lastPointerType = useRef('mouse');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [pipActive, setPipActive] = useState(false);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0);
  // Sources, Quality and Subtitles live inside the player so none of them need leaving fullscreen.
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  // -1 = off. Indexes both `tracks` and the <track> elements in DOM order.
  const [subtitleIdx, setSubtitleIdx] = useState(-1);

  const tracks = Array.isArray(subtitles) ? subtitles.filter((s) => s && s.url) : [];

  const isHls = type === 'hls' || (typeof src === 'string' && src.toLowerCase().includes('.m3u8'));

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setLoading(true);
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);
    seekedRef.current = false;
    netRetriesRef.current = 0;

    let hls;
    if (isHls && Hls.isSupported()) {
      // The site's CSP (`worker-src 'self'`) blocks hls.js's blob: worker, and with it
      // enabled every fragment fails silently, hence enableWorker: false.
      // hlsLoader (Live TV only) routes fetches through the extension, see livetv/extension.js.
      hls = new Hls({
        maxBufferLength: 30,
        enableWorker: false,
        xhrSetup: attachBackendAuth,
        ...(hlsLoader ? { loader: hlsLoader } : {}),
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels || []);
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) =>
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Flaky VOD hosts usually come back, so retry forever, unless a fallback
          // handler exists: then a CORS-blocked manifest must fail fast.
          if (!onFatalErrorRef.current || netRetriesRef.current < 1) {
            netRetriesRef.current += 1;
            hls.startLoad();
            return;
          }
        }
        hls.destroy();
        if (onFatalErrorRef.current?.()) return;
        setError('This stream could not be played. Try another source.');
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      if (autoPlay) video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), { once: true });
    } else {
      video.src = src;
      if (autoPlay) video.addEventListener('loadeddata', () => video.play().catch(() => {}), { once: true });
    }

    return () => {
      if (hls) { hls.destroy(); hlsRef.current = null; }
      video.removeAttribute('src');
      video.load();
    };
    // hlsLoader: a Live TV tier escalation can keep the same src but still needs a re-init.
  }, [src, mediaKey, isHls, autoPlay, reloadKey, hlsLoader]);

  const maybeResume = useCallback(() => {
    const v = videoRef.current;
    if (!v || seekedRef.current) return;
    const at = startAtRef.current || 0;
    if (at > 0 && Number.isFinite(v.duration) && at < v.duration - 1) {
      try { v.currentTime = at; } catch { /* seek not ready yet */ }
      seekedRef.current = true;
    }
  }, []);

  // The resume lookup is async and can land after loadedmetadata.
  useEffect(() => { maybeResume(); }, [startAt, maybeResume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      const t = video.currentTime || 0;
      setCurrent(t);
      if (onProgressRef.current) onProgressRef.current(t, video.duration || 0);
    };
    const onDur = () => { setDuration(video.duration || 0); maybeResume(); };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onCanPlay = () => setLoading(false);
    const onVol = () => { setMuted(video.muted); setVolume(video.volume); };
    const onProgress = () => {
      try {
        const b = video.buffered;
        if (b.length) setBuffered(b.end(b.length - 1));
      } catch { /* no-op */ }
    };
    const onErr = () => {
      if (hlsRef.current) return; // hls.js reports through its own handler
      if (onFatalErrorRef.current?.()) return;
      setError('Could not load this stream. Try another source.');
    };
    const onEnter = () => setPipActive(true);
    const onLeave = () => setPipActive(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('loadedmetadata', onDur);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('volumechange', onVol);
    video.addEventListener('progress', onProgress);
    video.addEventListener('error', onErr);
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('loadedmetadata', onDur);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('volumechange', onVol);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('error', onErr);
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  // Driven by subtitleIdx rather than <track default> so the CC menu stays in control.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tt = v.textTracks;
    for (let i = 0; i < tt.length; i++) {
      tt[i].mode = i === subtitleIdx ? 'showing' : 'disabled';
    }
  }, [subtitleIdx, tracks.length, reloadKey]);

  const { fullscreen, toggleFullscreen } = useFullscreen(wrapRef, videoRef);
  const { controlsVisible, setControlsVisible, revealControls } = useAutoHideControls(videoRef);

  // Capture phase so Esc closes the overlay before the browser exits fullscreen.
  // Only bound while open so it never shadows Esc otherwise.
  useEffect(() => {
    if (!showEpisodes) return undefined;
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowEpisodes(false); } };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [showEpisodes]);

  const op = skipTimes?.op;
  const ed = skipTimes?.ed;
  // 0.3s guard so a button doesn't flash for a frame at the very edge of a window.
  const inOpRange = !!op && current >= op.start && current < op.end - 0.3;
  const inEdRange = !!ed && current >= ed.start && current < ed.end - 0.3;

  const { autoNext, toggleAutoNext, countdown, cancelAutoNext, playNextNow } = useAutoNext({
    videoRef, onNextRef, hasNext, inEdRange, src, mediaKey, revealControls,
  });

  const skipIntro = useCallback(() => {
    const v = videoRef.current;
    if (!v || !skipTimes?.op) return;
    cancelAutoNext();
    try { v.currentTime = skipTimes.op.end; } catch { /* not seekable yet */ }
    setCurrent(v.currentTime);
    revealControls();
  }, [skipTimes, cancelAutoNext, revealControls]);

  const skipOutro = useCallback(() => {
    const v = videoRef.current;
    if (!v || !skipTimes?.ed) return;
    cancelAutoNext();
    const dur = v.duration || duration || 0;
    const target = dur ? Math.min(dur - 0.1, skipTimes.ed.end) : skipTimes.ed.end;
    try { v.currentTime = target; } catch { /* not seekable yet */ }
    setCurrent(v.currentTime);
    revealControls();
  }, [skipTimes, duration, cancelAutoNext, revealControls]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    cancelAutoNext(); // the viewer took over, so don't yank them to the next episode
    if (v.paused) v.play().catch(() => {}); else v.pause();
    revealControls();
  }, [revealControls, cancelAutoNext]);

  const skip = useCallback((delta) => {
    const v = videoRef.current;
    if (!v || live) return;
    cancelAutoNext();
    const dur = v.duration || duration || 0;
    const target = v.currentTime + delta;
    v.currentTime = dur ? Math.min(dur, Math.max(0, target)) : Math.max(0, target);
    setCurrent(v.currentTime);
    revealControls();
  }, [duration, revealControls, cancelAutoNext, live]);

  // On touch a tap toggles the controls instead of pausing, which is jarring on a phone.
  const onVideoTap = useCallback(() => {
    if (lastPointerType.current === 'touch') {
      if (controlsVisible) setControlsVisible(false);
      else revealControls();
      return;
    }
    togglePlay();
  }, [controlsVisible, setControlsVisible, revealControls, togglePlay]);

  const seekTo = useCallback((clientX, el) => {
    const v = videoRef.current;
    if (!v || !duration || live) return;
    cancelAutoNext();
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = frac * duration;
    setCurrent(v.currentTime);
  }, [duration, cancelAutoNext, live]);

  const toggleMute = useCallback(() => { const v = videoRef.current; if (v) v.muted = !v.muted; }, []);
  const changeVolume = useCallback((val) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val; v.muted = val === 0;
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch { /* unsupported */ }
  }, []);

  // The settings panel stays open so the viewer can keep tuning.
  const pickLevel = useCallback((lvl) => {
    const hls = hlsRef.current;
    if (hls) { hls.currentLevel = lvl; setCurrentLevel(lvl); }
  }, []);

  const pickSource = useCallback((idx) => {
    setShowSettings(false);
    if (idx !== activeSourceIdx) onSelectSource?.(idx);
  }, [activeSourceIdx, onSelectSource]);

  const retry = useCallback(() => { setError(null); setReloadKey((k) => k + 1); }, []);

  const { downloading, progress: dlProgress, toggleDownload } = useStreamDownload({
    src, mediaKey, type, downloadName, title, onError: setError,
  });

  usePlayerShortcuts(videoRef, { togglePlay, skip, changeVolume, toggleFullscreen, toggleMute, togglePip, revealControls });

  return (
    <div
      ref={wrapRef}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      className="absolute inset-0 bg-black overflow-hidden select-none"
      style={{ cursor: controlsVisible ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        poster={poster || undefined}
        playsInline
        // Cross-origin <track>s need CORS, but forcing it always would make plain
        // playback depend on CORS headers.
        crossOrigin={tracks.length ? 'anonymous' : undefined}
        onPointerDown={(e) => { lastPointerType.current = e.pointerType || 'mouse'; }}
        onClick={onVideoTap}
        className="w-full h-full bg-black object-contain"
      >
        {tracks.map((s, i) => (
          <track
            key={`${s.url}-${i}`}
            kind="subtitles"
            src={s.url}
            srcLang={s.lang || undefined}
            label={s.label || s.lang || `Track ${i + 1}`}
          />
        ))}
      </video>

      {loading && !error && <BufferingSpinner />}

      {!playing && !loading && !error && countdown === null && <BigPlayButton onPlay={togglePlay} />}

      <PlayerTitle title={title} visible={controlsVisible || !playing} />

      {error && <PlaybackError message={error} onRetry={retry} />}

      {!error && countdown === null && (inOpRange || inEdRange) && (
        <SkipSegmentButton
          label={inOpRange ? 'Skip Intro' : 'Skip Outro'}
          onSkip={inOpRange ? skipIntro : skipOutro}
        />
      )}

      {countdown !== null && !error && (
        <AutoNextCard countdown={countdown} nextLabel={nextLabel} onPlayNow={playNextNow} onCancel={cancelAutoNext} />
      )}

      {!error && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-0 inset-x-0 px-4 sm:px-6 pb-4 pt-20 bg-gradient-to-t from-crimson-950 via-crimson-950/70 to-transparent transition-opacity duration-500 ${controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {!live && <SeekBar current={current} duration={duration} buffered={buffered} seekTo={seekTo} />}

          <div className="flex items-center gap-1.5 sm:gap-2.5 text-crimson-100">
            <div className="flex items-center gap-0.5 sm:gap-1 rounded-2xl bg-crimson-950/40 border border-white/5 p-1 backdrop-blur-sm">
              <button onClick={togglePlay} className="grid place-items-center w-10 h-10 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white shadow-[0_0_18px_rgba(255,0,60,0.45)] transition-all active:scale-90" aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-px" />}
              </button>

              {!live && (
                <>
                  <button onClick={() => skip(-SKIP_SECONDS)} className="relative p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90" aria-label={`Back ${SKIP_SECONDS} seconds`}>
                    <RotateCcw className="w-5 h-5" />
                    <span className="absolute inset-0 grid place-items-center text-[7px] font-black tabular-nums pointer-events-none">{SKIP_SECONDS}</span>
                  </button>
                  <button onClick={() => skip(SKIP_SECONDS)} className="relative p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90" aria-label={`Forward ${SKIP_SECONDS} seconds`}>
                    <RotateCw className="w-5 h-5" />
                    <span className="absolute inset-0 grid place-items-center text-[7px] font-black tabular-nums pointer-events-none">{SKIP_SECONDS}</span>
                  </button>
                </>
              )}
            </div>

            <VolumeControl muted={muted} volume={volume} onToggleMute={toggleMute} onChangeVolume={changeVolume} />

            <TimeReadout live={live} current={current} duration={duration} />

            <div className="flex-1" />

            {onNext && (
              <button
                onClick={toggleAutoNext}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-crimson-950/40 border transition-all active:scale-95 hover:text-white ${
                  autoNext ? 'border-crimson-500/60 text-crimson-50' : 'border-white/5 hover:border-crimson-500/50'
                }`}
                aria-label="Auto-play next episode"
                aria-pressed={autoNext}
                title={autoNext ? 'Auto-Next: on' : 'Auto-Next: off'}
              >
                <SkipForward className={`w-4 h-4 ${autoNext ? 'text-crimson-400' : 'text-crimson-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                  Auto {autoNext ? 'On' : 'Off'}
                </span>
              </button>
            )}

            {episodePicker && (
              <button
                onClick={() => { setShowSettings(false); revealControls(); setShowEpisodes((s) => !s); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-crimson-950/40 border transition-all active:scale-95 hover:text-white ${
                  showEpisodes ? 'border-crimson-500/60 text-crimson-50' : 'border-white/5 hover:border-crimson-500/50'
                }`}
                aria-label="Episodes"
                aria-pressed={showEpisodes}
                title="Seasons &amp; Episodes"
              >
                <ListVideo className={`w-4 h-4 ${showEpisodes ? 'text-crimson-400' : 'text-crimson-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Episodes</span>
              </button>
            )}

            {(sources.length > 1 || levels.length > 1 || tracks.length > 0) && (
              <div className="relative">
                <button
                  onClick={() => { setShowEpisodes(false); setShowSettings((s) => !s); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-crimson-950/40 border transition-all active:scale-95 hover:text-white ${
                    showSettings ? 'border-crimson-500/60 text-crimson-50' : 'border-white/5 hover:border-crimson-500/50'
                  }`}
                  aria-label="Settings"
                  aria-pressed={showSettings}
                  title="Sources · Quality · Subtitles"
                >
                  <Settings className={`w-4 h-4 transition-transform duration-500 ${showSettings ? 'rotate-90 text-crimson-400' : 'text-crimson-500'}`} />
                </button>
                {showSettings && (
                  <div className="cp-rise absolute bottom-full right-0 mb-4 w-72 max-h-[60vh] overflow-y-auto no-scrollbar rounded-2xl bg-crimson-950/95 border border-crimson-500/20 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] z-50 divide-y divide-white/5">
                    {sources.length > 1 && (
                      <SourceMenu
                        sources={sources}
                        activeSourceIdx={activeSourceIdx}
                        onPick={pickSource}
                        onReportBroken={onReportBroken}
                        onClose={() => setShowSettings(false)}
                      />
                    )}
                    {levels.length > 1 && <QualityMenu levels={levels} currentLevel={currentLevel} onPick={pickLevel} />}
                    {tracks.length > 0 && <SubtitleMenu tracks={tracks} selectedIdx={subtitleIdx} onSelect={setSubtitleIdx} />}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-0.5 rounded-2xl bg-crimson-950/40 border border-white/5 p-1 backdrop-blur-sm">
              {/* An endless live stream never finishes saving. */}
              {!live && <DownloadButton downloading={downloading} progress={dlProgress} onClick={toggleDownload} />}

              {document.pictureInPictureEnabled && (
                <button onClick={togglePip} className={`p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90 ${pipActive ? 'text-crimson-400' : ''}`} aria-label="Picture in picture">
                  <PictureInPicture2 className="w-5 h-5" />
                </button>
              )}

              <button onClick={toggleFullscreen} className="p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90" aria-label="Fullscreen">
                {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inside the player wrapper so it's reachable in fullscreen. */}
      {episodePicker && showEpisodes && (
        <PlayerEpisodeList picker={episodePicker} title={title} onClose={() => setShowEpisodes(false)} />
      )}
    </div>
  );
}
