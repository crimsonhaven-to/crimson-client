import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, RotateCcw, RotateCw, AlertTriangle, PictureInPicture2, Sparkles,
  Captions, Download, Loader2, SkipForward, Layers, ChevronDown, MonitorPlay, Check,
  ListVideo, Film, Calendar, X,
} from 'lucide-react';
import { downloadStream } from './streamDownload';
import { groupStreams, streamVariantLabel } from './streamUtils';
import { API_BASE_URL } from './hooks/config';
import { getSessionToken } from './hooks/apiClient';

const SKIP_SECONDS = 10;

// Gives the viewer a beat to cancel before Auto-Next advances.
const AUTO_NEXT_SECONDS = 8;
const AUTO_NEXT_KEY = 'crimson:autoNext';

// `mediaKey` identifies the episode `src` belongs to. Capture endpoints can serve
// every episode from the SAME url, so reloading on `src` alone would keep the old
// episode's position.
export default function CrimsonPlayer({ src, mediaKey = null, type = '', subtitles = [], poster = '', title = '', downloadName = '', autoPlay = true, startAt = 0, onProgress, onNext, hasNext = false, nextLabel = '', skipTimes = null, sources = [], activeSourceIdx = -1, onSelectSource, onReportBroken, episodePicker = null, live = false, onFatalError = null, hlsLoader = null }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimer = useRef(null);
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
  const [fullscreen, setFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [seekHover, setSeekHover] = useState(null);
  // Sources, Quality and Subtitles live inside the player so none of them need leaving fullscreen.
  const [showSettings, setShowSettings] = useState(false);
  const [settingsOpenGroup, setSettingsOpenGroup] = useState(null);
  const [showEpisodes, setShowEpisodes] = useState(false);
  // -1 = off. Indexes both `tracks` and the <track> elements in DOM order.
  const [subtitleIdx, setSubtitleIdx] = useState(-1);
  // null when the download size is unknown.
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);
  const dlAbortRef = useRef(null);

  const [autoNext, setAutoNext] = useState(() => {
    try { return localStorage.getItem(AUTO_NEXT_KEY) === '1'; } catch { return false; }
  });
  const [countdown, setCountdown] = useState(null);
  const countdownTimer = useRef(null);

  const tracks = Array.isArray(subtitles) ? subtitles.filter((s) => s && s.url) : [];

  const isHls = type === 'hls' || (typeof src === 'string' && src.toLowerCase().includes('.m3u8'));

  // /local_hls is the only HLS surface behind the login wall. The bearer must never
  // reach a third-party CDN (token leak), and on the public proxies the extra header
  // would make every segment a CORS-preflighted request.
  const attachBackendAuth = (xhr, url) => {
    try {
      const u = new URL(url, window.location.href);
      const backend = new URL(API_BASE_URL, window.location.href).origin;
      if (u.origin !== backend || !u.pathname.startsWith('/local_hls/')) return;
      const token = getSessionToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    } catch { /* malformed URL: the request proceeds unauthenticated */ }
  };

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
      // hlsLoader (Live TV only) routes fetches through the extension, see liveTvExt.
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

  // iOS's native <video> fullscreen fires webkitbegin/endfullscreen on the element
  // instead of updating document.fullscreenElement.
  useEffect(() => {
    const v = videoRef.current;
    const onFs = () => setFullscreen(
      (document.fullscreenElement || document.webkitFullscreenElement) === wrapRef.current
    );
    const onIosBegin = () => setFullscreen(true);
    const onIosEnd = () => setFullscreen(false);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    v?.addEventListener('webkitbeginfullscreen', onIosBegin);
    v?.addEventListener('webkitendfullscreen', onIosEnd);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      v?.removeEventListener('webkitbeginfullscreen', onIosBegin);
      v?.removeEventListener('webkitendfullscreen', onIosEnd);
    };
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2800);
  }, []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  // Capture phase so Esc closes the overlay before the browser exits fullscreen.
  // Only bound while open so it never shadows Esc otherwise.
  useEffect(() => {
    if (!showEpisodes) return undefined;
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowEpisodes(false); } };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [showEpisodes]);

  const toggleAutoNext = useCallback(() => {
    setAutoNext((on) => {
      const next = !on;
      try { localStorage.setItem(AUTO_NEXT_KEY, next ? '1' : '0'); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const cancelAutoNext = useCallback(() => {
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
    setCountdown(null);
  }, []);

  const beginAutoNext = useCallback(() => {
    cancelAutoNext();
    revealControls();
    setCountdown(AUTO_NEXT_SECONDS);
    countdownTimer.current = setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c <= 1) {
          clearInterval(countdownTimer.current);
          countdownTimer.current = null;
          onNextRef.current?.();
          return null;
        }
        return c - 1;
      });
    }, 1000);
  }, [cancelAutoNext, revealControls]);

  const playNextNow = useCallback(() => {
    cancelAutoNext();
    onNextRef.current?.();
  }, [cancelAutoNext]);

  useEffect(() => () => cancelAutoNext(), [cancelAutoNext]);

  // Separate from the []-dep listeners so it sees the current autoNext/hasNext.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const onEnded = () => {
      if (autoNext && hasNext && onNextRef.current) beginAutoNext();
    };
    v.addEventListener('ended', onEnded);
    return () => v.removeEventListener('ended', onEnded);
  }, [autoNext, hasNext, beginAutoNext]);

  const op = skipTimes?.op;
  const ed = skipTimes?.ed;
  // 0.3s guard so a button doesn't flash for a frame at the very edge of a window.
  const inOpRange = !!op && current >= op.start && current < op.end - 0.3;
  const inEdRange = !!ed && current >= ed.start && current < ed.end - 0.3;

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

  // Arming at the outro rather than on `ended` rolls Auto-Next viewers over the credits.
  const edAutoArmed = useRef(false);
  useEffect(() => { edAutoArmed.current = false; }, [src, mediaKey]);
  useEffect(() => {
    if (!inEdRange || edAutoArmed.current || countdown !== null) return;
    if (autoNext && hasNext && onNextRef.current) {
      edAutoArmed.current = true;
      beginAutoNext();
    }
  }, [inEdRange, autoNext, hasNext, countdown, beginAutoNext]);

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
  }, [controlsVisible, revealControls, togglePlay]);

  const seekTo = useCallback((clientX, el) => {
    const v = videoRef.current;
    if (!v || !duration || live) return;
    cancelAutoNext();
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = frac * duration;
    setCurrent(v.currentTime);
  }, [duration, cancelAutoNext, live]);

  const onScrubStart = useCallback((e) => {
    const bar = e.currentTarget;
    seekTo(e.clientX, bar);
    const move = (ev) => seekTo(ev.clientX, bar);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [seekTo]);

  const onSeekHover = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSeekHover(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  }, []);

  const toggleMute = useCallback(() => { const v = videoRef.current; if (v) v.muted = !v.muted; }, []);
  const changeVolume = useCallback((val) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val; v.muted = val === 0;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current;
    const v = videoRef.current;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    // webkit prefix for older Safari.
    if (wrap?.requestFullscreen) { wrap.requestFullscreen(); return; }
    if (wrap?.webkitRequestFullscreen) { wrap.webkitRequestFullscreen(); return; }
    // iPhones and iPad homescreen webapps can only fullscreen the <video> itself,
    // dismissed via the native "Done" button.
    if (v?.webkitEnterFullscreen) { v.webkitEnterFullscreen(); return; }
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

  const sourceGroups = useMemo(() => groupStreams(sources), [sources]);
  const pickSource = useCallback((idx) => {
    setShowSettings(false);
    if (idx !== activeSourceIdx) onSelectSource?.(idx);
  }, [activeSourceIdx, onSelectSource]);

  const retry = useCallback(() => { setError(null); setReloadKey((k) => k + 1); }, []);

  // HLS downloads fetch every segment and can take a while, hence progress and cancel.
  const handleDownload = useCallback(async () => {
    if (downloading) { dlAbortRef.current?.abort(); return; }
    const controller = new AbortController();
    dlAbortRef.current = controller;
    setDownloading(true);
    setDlProgress(0);
    try {
      await downloadStream(
        { url: src, type, name: downloadName || title },
        (fraction) => setDlProgress(fraction == null ? null : fraction),
        controller.signal,
      );
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Download failed:', err);
        setError(`Download failed: ${err.message || 'unknown error'}. Try another source.`);
      }
    } finally {
      setDownloading(false);
      dlAbortRef.current = null;
    }
  }, [downloading, src, type, downloadName, title]);

  useEffect(() => () => dlAbortRef.current?.abort(), [src, mediaKey]);

  // Bound on window: only one player is ever mounted.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const v = videoRef.current;
      switch (e.key) {
        case ' ': case 'k': case 'K': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': case 'l': case 'L': e.preventDefault(); skip(SKIP_SECONDS); break;
        case 'ArrowLeft': case 'j': case 'J': e.preventDefault(); skip(-SKIP_SECONDS); break;
        case 'ArrowUp': e.preventDefault(); changeVolume(Math.min(1, (v?.volume ?? 1) + 0.1)); break;
        case 'ArrowDown': e.preventDefault(); changeVolume(Math.max(0, (v?.volume ?? 0) - 0.1)); break;
        case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
        case 'm': case 'M': e.preventDefault(); toggleMute(); break;
        case 'p': case 'P': e.preventDefault(); togglePip(); break;
        default: return;
      }
      revealControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, skip, changeVolume, toggleFullscreen, toggleMute, togglePip, revealControls]);

  const fmt = (s) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    const h = Math.floor(m / 60);
    const mm = h ? String(m % 60).padStart(2, '0') : m;
    return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
  };
  const qLabel = (lvl) => (lvl === -1 ? 'Auto' : (levels[lvl]?.height ? `${levels[lvl].height}p` : `Q${lvl + 1}`));

  const pct = duration ? (current / duration) * 100 : 0;
  const bufPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;
  const activeGroupKey = sourceGroups.find((g) => g.items.some((it) => it.idx === activeSourceIdx))?.key ?? null;

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

      {loading && !error && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none z-20">
          <div className="relative grid place-items-center">
            <div className="absolute w-28 h-28 rounded-full bg-crimson-500/10 blur-2xl cp-breathe" />
            <div className="w-20 h-20 rounded-full border-[3px] border-crimson-500/10 border-t-crimson-500 animate-spin shadow-[0_0_50px_rgba(255,0,60,0.3)]" />
            <div className="absolute w-12 h-12 rounded-full border-2 border-crimson-500/10 border-b-crimson-400 cp-ring-rev" />
            <Sparkles className="absolute w-6 h-6 text-crimson-400 animate-pulse" />
          </div>
        </div>
      )}

      {!playing && !loading && !error && countdown === null && (
        <div className="absolute inset-0 grid place-items-center z-10 pointer-events-none">
          <div className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-crimson-500/10 blur-2xl cp-breathe" />
          <div className="absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-dashed border-crimson-500/30 cp-ring" />
          <div className="absolute w-[10.5rem] h-[10.5rem] sm:w-44 sm:h-44 rounded-full border border-crimson-500/10 cp-ring-rev" />
          <button
            onClick={togglePlay}
            className="pointer-events-auto relative grid place-items-center w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-crimson-950/50 border border-crimson-500/30 backdrop-blur-md text-crimson-50 shadow-[0_0_60px_rgba(255,0,60,0.4)] hover:bg-crimson-500/20 hover:border-crimson-400 hover:scale-110 transition-all duration-300 active:scale-95 group"
            aria-label="Play"
          >
            <Play className="w-10 h-10 sm:w-12 sm:h-12 translate-x-0.5 fill-current drop-shadow-[0_0_15px_rgba(255,0,60,0.8)]" />
          </button>
        </div>
      )}

      <div className={`absolute top-0 inset-x-0 px-4 sm:px-6 pt-5 pb-14 bg-gradient-to-b from-crimson-950/90 via-crimson-950/40 to-transparent flex items-center transition-all duration-500 ${controlsVisible || !playing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        <div className="flex items-center gap-2.5 min-w-0 px-3.5 py-2 rounded-2xl bg-crimson-950/50 border border-crimson-500/20 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <span className="relative flex w-2 h-2 shrink-0">
            <span className="absolute inline-flex w-full h-full rounded-full bg-crimson-500 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c]" />
          </span>
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-crimson-50 truncate drop-shadow-lg">
            {title || 'Crimson Haven Manifest'}
          </span>
        </div>
      </div>

      {error && (
        <div className="cp-rise absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 text-center p-8 backdrop-blur-xl z-30">
          <div className="relative grid place-items-center mb-6">
            <div className="absolute w-28 h-28 rounded-full bg-crimson-500/15 blur-2xl cp-breathe" />
            <div className="relative p-5 rounded-full bg-crimson-500/10 border border-crimson-500/20">
              <AlertTriangle className="w-12 h-12 text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.5)]" />
            </div>
          </div>
          <p className="text-crimson-50 font-black text-lg sm:text-2xl mb-2 uppercase tracking-tighter">Playback Link Severed</p>
          <p className="text-crimson-400/80 text-xs sm:text-sm max-w-sm mb-8 font-medium leading-relaxed">{error}</p>
          <button onClick={retry} className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_20px_rgba(255,0,60,0.3)] active:scale-95">
            <RotateCcw className="w-4 h-4" /> Re-Establish Node
          </button>
        </div>
      )}

      {!error && countdown === null && (inOpRange || inEdRange) && (
        <button
          onClick={inOpRange ? skipIntro : skipOutro}
          className="cp-rise absolute z-40 bottom-28 right-4 sm:right-6 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-crimson-950/90 border border-crimson-500/40 backdrop-blur-2xl text-crimson-50 shadow-[0_15px_50px_rgba(0,0,0,0.7)] hover:bg-crimson-600 hover:border-crimson-400 hover:scale-[1.03] transition-all active:scale-95"
        >
          <SkipForward className="w-4 h-4 fill-current text-crimson-400" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">
            {inOpRange ? 'Skip Intro' : 'Skip Outro'}
          </span>
        </button>
      )}

      {countdown !== null && !error && (
        <div className="cp-rise absolute z-40 bottom-28 right-4 sm:right-6 w-72 max-w-[calc(100%-2rem)] rounded-3xl bg-crimson-950/95 border border-crimson-500/30 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-5">
          <div className="absolute top-0 inset-x-5 h-0.5 rounded-full bg-crimson-500/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-crimson-600 to-crimson-400 shadow-[0_0_8px_rgba(255,0,60,0.7)] transition-[width] duration-1000 ease-linear"
              style={{ width: `${(countdown / AUTO_NEXT_SECONDS) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c] animate-pulse" />
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">Up Next</p>
          </div>
          <p className="text-sm font-black text-crimson-50 truncate mb-1.5">{nextLabel || 'Next Episode'}</p>
          <p className="text-[11px] font-bold text-crimson-300/70 mb-4">
            Manifesting in <span className="text-crimson-400 tabular-nums font-black">{countdown}</span>s
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={playNextNow}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_8px_20px_rgba(255,0,60,0.3)]"
            >
              <SkipForward className="w-3.5 h-3.5 fill-current" /> Play Now
            </button>
            <button
              onClick={cancelAutoNext}
              className="px-4 py-2.5 rounded-xl bg-crimson-950/60 border border-white/5 text-crimson-300 hover:text-white hover:border-crimson-500/50 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!error && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-0 inset-x-0 px-4 sm:px-6 pb-4 pt-20 bg-gradient-to-t from-crimson-950 via-crimson-950/70 to-transparent transition-opacity duration-500 ${controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {!live && (
          <div
            onPointerDown={onScrubStart}
            onPointerMove={onSeekHover}
            onPointerLeave={() => setSeekHover(null)}
            className="group/seek relative h-6 flex items-center cursor-pointer mb-1"
          >
            {seekHover !== null && duration > 0 && (
              <div
                className="cp-pop absolute -top-9 z-20 px-2.5 py-1 rounded-lg bg-crimson-950/95 border border-crimson-500/40 backdrop-blur-md text-[10px] font-black tabular-nums text-crimson-50 shadow-[0_10px_25px_rgba(0,0,0,0.6)] pointer-events-none"
                style={{ left: `${seekHover * 100}%`, transform: 'translateX(-50%)' }}
              >
                {fmt(seekHover * duration)}
              </div>
            )}
            <div className="absolute inset-x-0 h-1.5 group-hover/seek:h-2.5 rounded-full bg-white/5 overflow-hidden backdrop-blur-sm border border-white/5 shadow-inner transition-all duration-200">
              <div className="absolute inset-y-0 left-0 bg-crimson-500/20 transition-[width] duration-300" style={{ width: `${bufPct}%` }} />
              {seekHover !== null && (
                <div className="absolute inset-y-0 left-0 bg-crimson-400/20" style={{ width: `${seekHover * 100}%` }} />
              )}
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-crimson-800 via-crimson-600 to-crimson-400 shadow-[0_0_20px_rgba(255,0,60,0.8)]" style={{ width: `${pct}%` }} />
            </div>
            {seekHover !== null && (
              <div
                className="absolute w-0.5 h-4 rounded-full bg-crimson-100/70 -translate-x-1/2 pointer-events-none z-[5]"
                style={{ left: `${seekHover * 100}%` }}
              />
            )}
            <div
              className="absolute w-4 h-4 rounded-full bg-white border-[3px] border-crimson-500 shadow-[0_0_15px_rgba(255,0,60,1)] -translate-x-1/2 scale-0 group-hover/seek:scale-100 transition-transform duration-200 z-10"
              style={{ left: `${pct}%` }}
            />
          </div>
          )}

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

            {/* The invisible native range on top keeps drag and keyboard behaviour. */}
            <div className="flex items-center group/vol ml-0.5">
              <button onClick={toggleMute} className="p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90" aria-label="Mute">
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="overflow-hidden w-0 group-hover/vol:w-20 sm:group-hover/vol:w-24 transition-all duration-300 ease-out flex items-center">
                <div className="relative h-1.5 w-full mx-2 rounded-full bg-white/10 border border-white/5">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-crimson-600 to-crimson-400 shadow-[0_0_10px_rgba(255,0,60,0.7)]"
                    style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 w-3 h-3 rounded-full bg-white border-2 border-crimson-500 shadow-[0_0_8px_rgba(255,0,60,0.9)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${(muted ? 0 : volume) * 100}%` }}
                  />
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>

            {live ? (
              <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] bg-crimson-950/60 px-3 py-1.5 rounded-lg border border-crimson-500/30 ml-1 text-crimson-50">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-crimson-500 opacity-60 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c]" />
                </span>
                Live
              </span>
            ) : (
              <span className="text-[11px] font-mono font-black tracking-tighter tabular-nums bg-crimson-950/60 px-3 py-1.5 rounded-lg border border-white/5 ml-1">
                <span className="text-crimson-50">{fmt(current)}</span> <span className="text-crimson-500 mx-0.5">/</span> <span className="text-crimson-300/80">{fmt(duration)}</span>
              </span>
            )}

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
                  onClick={() => { setShowEpisodes(false); setSettingsOpenGroup(activeGroupKey); setShowSettings((s) => !s); }}
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
                      <div className="p-2">
                        <p className="flex items-center gap-2 px-2 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">
                          <MonitorPlay className="w-3.5 h-3.5" /> Sources
                        </p>
                        <div className="space-y-1">
                          {sourceGroups.map((group) => {
                            if (!group.stacked) {
                              const { stream, idx } = group.items[0];
                              return (
                                <button
                                  key={group.key}
                                  onClick={() => pickSource(idx)}
                                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSourceIdx === idx ? 'bg-crimson-600 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
                                >
                                  <span className="truncate">{stream.source}</span>
                                  {activeSourceIdx === idx && <Check className="w-3.5 h-3.5 shrink-0" />}
                                </button>
                              );
                            }
                            const containsActive = group.items.some((it) => it.idx === activeSourceIdx);
                            const open = settingsOpenGroup === group.key;
                            return (
                              <div key={group.key}>
                                <button
                                  onClick={() => setSettingsOpenGroup(open ? null : group.key)}
                                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${containsActive && !open ? 'bg-crimson-600/80 text-crimson-50' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <Layers className="w-3 h-3 shrink-0 text-crimson-500" />
                                    <span className="truncate">{group.label}</span>
                                    <span className="text-crimson-500/80">· {group.items.length}</span>
                                  </span>
                                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                                </button>
                                {open && (
                                  <div className="cp-rise mt-1 ml-3 pl-2 border-l border-crimson-900/60 space-y-1">
                                    {group.items.map(({ stream, idx }) => (
                                      <button
                                        key={idx}
                                        onClick={() => pickSource(idx)}
                                        className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg text-[10px] font-bold tracking-wide transition-all ${activeSourceIdx === idx ? 'bg-crimson-600 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
                                      >
                                        <span className="flex items-center gap-1.5 truncate">
                                          <span className="text-[8px] uppercase font-black px-1.5 py-0.5 rounded bg-crimson-500/10 border border-crimson-500/20 text-crimson-500">{stream.type}</span>
                                          {stream.language && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 rounded bg-crimson-900 text-crimson-400">{stream.language}</span>}
                                          <span className="truncate">{streamVariantLabel(stream)}</span>
                                        </span>
                                        {activeSourceIdx === idx && <Check className="w-3.5 h-3.5 shrink-0" />}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {onReportBroken && activeSourceIdx >= 0 && (
                          <button
                            onClick={() => { onReportBroken(activeSourceIdx); setShowSettings(false); }}
                            title="This source won't play: report it and switch to the next"
                            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-crimson-400 hover:text-white hover:bg-crimson-500/20 transition-all"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Report broken · try next
                          </button>
                        )}
                      </div>
                    )}

                    {levels.length > 1 && (
                      <div className="p-2">
                        <p className="flex items-center gap-2 px-2 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">
                          <Settings className="w-3.5 h-3.5" /> Quality
                        </p>
                        <div className="grid grid-cols-3 gap-1">
                          {[-1, ...levels.map((_, i) => i)].reverse().map((lvl) => (
                            <button
                              key={lvl}
                              onClick={() => pickLevel(lvl)}
                              className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentLevel === lvl ? 'bg-crimson-600 text-white' : 'bg-crimson-950/60 text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
                            >
                              {qLabel(lvl)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {tracks.length > 0 && (
                      <div className="p-2">
                        <p className="flex items-center gap-2 px-2 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">
                          <Captions className="w-3.5 h-3.5" /> Subtitles
                        </p>
                        <div className="space-y-1">
                          <button
                            onClick={() => setSubtitleIdx(-1)}
                            className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subtitleIdx === -1 ? 'bg-crimson-600 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
                          >
                            <span>Off</span>
                            {subtitleIdx === -1 && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                          {tracks.map((s, i) => (
                            <button
                              key={`${s.url}-${i}`}
                              onClick={() => setSubtitleIdx(i)}
                              className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subtitleIdx === i ? 'bg-crimson-600 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
                            >
                              <span className="truncate">{s.label || s.lang || `Track ${i + 1}`}</span>
                              {subtitleIdx === i && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-0.5 rounded-2xl bg-crimson-950/40 border border-white/5 p-1 backdrop-blur-sm">
              {/* An endless live stream never finishes saving. */}
              {!live && (
              <button
                onClick={handleDownload}
                className={`flex items-center gap-1.5 p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90 ${downloading ? 'text-crimson-400' : ''}`}
                aria-label={downloading ? 'Cancel download' : 'Download video'}
                title={downloading ? 'Click to cancel download' : 'Download this source'}
              >
                {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {downloading && (
                  <span className="text-[10px] font-black tabular-nums tracking-tighter">
                    {dlProgress == null ? '…' : `${Math.round(dlProgress * 100)}%`}
                  </span>
                )}
              </button>
              )}

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
        <div className="cp-rise absolute inset-0 z-[60] flex flex-col bg-gradient-to-b from-crimson-950/95 via-crimson-950/90 to-black/95 backdrop-blur-2xl">
          <div className="flex items-center gap-3 px-4 sm:px-8 pt-5 pb-4 shrink-0 border-b border-crimson-500/15 bg-crimson-950/40">
            <div className="grid place-items-center w-9 h-9 rounded-xl bg-crimson-500/10 border border-crimson-500/25 text-crimson-400 shrink-0">
              <ListVideo className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">Manifest Index</p>
              <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-crimson-50 truncate">{title || 'Episodes'}</h3>
            </div>
            <button
              onClick={() => setShowEpisodes(false)}
              aria-label="Close episodes"
              className="ml-auto shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-crimson-950/60 border border-white/5 text-crimson-300 hover:text-white hover:border-crimson-500/50 transition-all active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {episodePicker.seasons.length > 1 && (
            <div className="flex items-center gap-2 px-4 sm:px-8 py-3 shrink-0 overflow-x-auto no-scrollbar border-b border-white/5">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-700 whitespace-nowrap pr-1">Archives</span>
              {episodePicker.seasons.map((s) => {
                const active = episodePicker.expandedSeason === s.season_number;
                const playing = episodePicker.currentSeason === s.season_number;
                return (
                  <button
                    key={s.season_number}
                    onClick={() => episodePicker.onExpandSeason(s.season_number)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border whitespace-nowrap transition-all active:scale-95 ${
                      active
                        ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.25)]'
                        : 'bg-crimson-950/50 border-crimson-900/50 text-crimson-400 hover:border-crimson-600 hover:bg-crimson-900/30'
                    }`}
                  >
                    Season {s.season_number}
                    {playing && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-crimson-300 shadow-[0_0_6px_#ff003c] align-middle" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 sm:px-8 py-5 space-y-2.5">
            {episodePicker.episodesLoading ? (
              [1, 2, 3, 4].map((n) => (
                <div key={n} className="h-24 rounded-2xl bg-crimson-950/40 border border-crimson-900/30 animate-pulse" />
              ))
            ) : episodePicker.episodes.length > 0 ? (
              episodePicker.episodes.map((ep) => {
                const isNow = episodePicker.expandedSeason === episodePicker.currentSeason
                  && ep.episode_number === episodePicker.currentEpisode;
                const hasTitle = ep.title && ep.title !== `Episode ${ep.episode_number}`;
                return (
                  <button
                    key={ep.episode_number}
                    onClick={() => { episodePicker.onSelectEpisode(episodePicker.expandedSeason, ep.episode_number); setShowEpisodes(false); }}
                    className={`group w-full flex gap-3 sm:gap-4 text-left p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 ${
                      isNow
                        ? 'bg-crimson-600/15 border-crimson-500/60 shadow-[0_0_25px_rgba(255,0,60,0.15)]'
                        : 'bg-crimson-950/40 border-crimson-900/50 hover:bg-crimson-900/20 hover:border-crimson-500/50'
                    }`}
                  >
                    <div className="relative w-32 sm:w-44 aspect-video shrink-0 rounded-xl overflow-hidden bg-crimson-900/40 shadow-inner">
                      {ep.thumbnail ? (
                        <img src={ep.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-crimson-800"><Film className="w-7 h-7 opacity-20" /></div>
                      )}
                      <div className="absolute inset-0 grid place-items-center bg-crimson-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="p-2.5 rounded-full bg-crimson-500 shadow-[0_0_15px_rgba(255,0,60,0.5)] translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-crimson-950/90 border border-crimson-800/50 backdrop-blur-md text-[9px] font-black uppercase tracking-widest text-crimson-400">
                        E{ep.episode_number}
                      </span>
                      {isNow && (
                        <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-crimson-600 text-[8px] font-black uppercase tracking-widest text-white shadow-[0_0_10px_rgba(255,0,60,0.6)]">
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> Now
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 py-0.5 flex-1">
                      <h4 className={`text-sm sm:text-base font-black tracking-tight line-clamp-1 transition-colors ${isNow ? 'text-crimson-300' : 'text-crimson-50 group-hover:text-crimson-400'}`}>
                        {hasTitle ? ep.title : `Episode ${ep.episode_number}`}
                      </h4>
                      {ep.air_date && (
                        <span className="flex items-center gap-1 text-[9px] text-crimson-600 font-black uppercase tracking-widest mt-1 opacity-80">
                          <Calendar className="w-3 h-3" /> {ep.air_date}
                        </span>
                      )}
                      {ep.overview && (
                        <p className="text-[11px] sm:text-xs text-crimson-200/50 leading-relaxed line-clamp-2 sm:line-clamp-3 mt-1.5 font-medium">
                          {ep.overview}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-16 text-center space-y-4">
                <div className="w-12 h-12 mx-auto grid place-items-center rounded-full border-2 border-dashed border-crimson-900/50">
                  <Film className="w-6 h-6 text-crimson-900" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-crimson-700 italic">No segment data recorded for this season.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
