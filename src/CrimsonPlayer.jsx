import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, RotateCcw, RotateCw, AlertTriangle, PictureInPicture2, Sparkles,
  Captions, Download, Loader2, SkipForward, Layers, ChevronDown, MonitorPlay, Check,
} from 'lucide-react';
import { downloadStream } from './streamDownload';
import { groupStreams, streamVariantLabel } from './hooks';

// How far the skip-back / skip-forward buttons (and ←/→ keys) jump, in seconds.
const SKIP_SECONDS = 10;

// Grace period shown as a countdown before Auto-Next advances to the next
// episode, giving the viewer a beat to cancel or jump in immediately.
const AUTO_NEXT_SECONDS = 8;
// localStorage key for the (opt-in, off by default) Auto-Next preference, so the
// choice persists across episodes, source switches and sessions.
const AUTO_NEXT_KEY = 'crimson:autoNext';

/**
 * CrimsonPlayer — the Haven's own HLS / MP4 player.
 *
 * Plays the backend's proxied direct streams (VOE / Vidmoly / … m3u8 + mp4)
 * in-app with fully custom, crimson-vampiric controls — no browser chrome, no
 * "Direct Link" dead-end. hls.js drives playback where the browser can't play
 * HLS natively (Chrome/Firefox); native <video> handles mp4 and Safari's HLS.
 *
 * NOTE: hls.js runs with `enableWorker: false` on purpose. The site's CSP is
 * `worker-src 'self'`, which blocks hls.js's blob: web worker — with the worker
 * enabled, playlists load but every fragment silently fails (segments demux in
 * the worker). Main-thread demuxing is CSP-clean and plenty for one stream.
 */
export default function CrimsonPlayer({ src, type = '', subtitles = [], poster = '', title = '', downloadName = '', autoPlay = true, startAt = 0, onProgress, onNext, hasNext = false, nextLabel = '', skipTimes = null, sources = [], activeSourceIdx = -1, onSelectSource }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimer = useRef(null);
  // Resume support: seek to `startAt` (seconds) once the media is ready. Kept in
  // a ref so the [] -dep events effect can read the latest value, and guarded by
  // `seekedRef` so we only auto-seek once per loaded source (not on every
  // loadedmetadata, and never fighting the user after they start scrubbing).
  const startAtRef = useRef(startAt);
  const seekedRef = useRef(false);
  useEffect(() => { startAtRef.current = startAt; }, [startAt]);
  // Keep the latest onProgress in a ref so the [] -dep event effect below always
  // calls the current callback without needing to re-subscribe the listeners.
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  // Same pattern for the "advance to next episode" callback: read the latest one
  // from inside the [] -dep `ended` listener and the countdown timer without
  // re-subscribing on every render.
  const onNextRef = useRef(onNext);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);
  // Remembers whether the last interaction with the <video> was a touch or a
  // mouse press, so the tap handler can treat the two differently (mobile taps
  // reveal controls; desktop clicks play/pause). Set on pointerdown, read on click.
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
  // The in-player settings cog (movie-web-style): Sources / Quality / Subtitles in
  // one panel so none of them need leaving fullscreen. `settingsOpenGroup` tracks
  // which provider deck is expanded inside the Sources section (one at a time).
  const [showSettings, setShowSettings] = useState(false);
  const [settingsOpenGroup, setSettingsOpenGroup] = useState(null);
  // External subtitle tracks (ShowBox/Febbox + OpenSubtitles). -1 = off. Index maps
  // to both the `tracks` array below and the <track> elements in DOM order.
  const [subtitleIdx, setSubtitleIdx] = useState(-1);
  // Download state. `downloading` gates the button; `dlProgress` is 0..1, or null
  // for an indeterminate (size-unknown) download.
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);
  const dlAbortRef = useRef(null);

  // Auto-Next: opt-in (off by default), persisted so the choice survives episode
  // changes and sessions. `countdown` is the seconds remaining before we advance
  // (null = no countdown running); `countdownTimer` holds its interval.
  const [autoNext, setAutoNext] = useState(() => {
    try { return localStorage.getItem(AUTO_NEXT_KEY) === '1'; } catch { return false; }
  });
  const [countdown, setCountdown] = useState(null);
  const countdownTimer = useRef(null);

  // Defensive: only keep well-formed subtitle entries (need a url to load).
  const tracks = Array.isArray(subtitles) ? subtitles.filter((s) => s && s.url) : [];

  const isHls = type === 'hls' || (typeof src === 'string' && src.toLowerCase().includes('.m3u8'));

  // ---- Source / hls.js wiring -------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setLoading(true);
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);
    seekedRef.current = false; // new source: allow one resume-seek again

    let hls;
    if (isHls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30, enableWorker: false });
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
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
          case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
          default:
            setError('This stream could not be played. Try another source.');
            hls.destroy();
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src; // Safari / iOS native HLS
      if (autoPlay) video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), { once: true });
    } else {
      video.src = src; // progressive mp4
      if (autoPlay) video.addEventListener('loadeddata', () => video.play().catch(() => {}), { once: true });
    }

    return () => {
      if (hls) { hls.destroy(); hlsRef.current = null; }
      video.removeAttribute('src');
      video.load();
    };
  }, [src, isHls, autoPlay, reloadKey]);

  // Seek to the saved resume position once the media knows its duration. No-op
  // unless we have a positive startAt we haven't applied yet for this source.
  const maybeResume = useCallback(() => {
    const v = videoRef.current;
    if (!v || seekedRef.current) return;
    const at = startAtRef.current || 0;
    if (at > 0 && Number.isFinite(v.duration) && at < v.duration - 1) {
      try { v.currentTime = at; } catch { /* seek not ready yet */ }
      seekedRef.current = true;
    }
  }, []);

  // Resume position can land after metadata already loaded (the lookup is async),
  // so attempt the seek whenever startAt changes too — not just on loadedmetadata.
  useEffect(() => { maybeResume(); }, [startAt, maybeResume]);

  // ---- <video> element events -------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      const t = video.currentTime || 0;
      setCurrent(t);
      // Report real playback position up to the watch page for progress saving.
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
    const onErr = () => { if (!hlsRef.current) setError('Could not load this stream. Try another source.'); };
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

  // ---- Subtitle tracks ---------------------------------------------------
  // The browser exposes one TextTrack per <track> element in DOM order, which
  // matches our `tracks` array. Drive visibility off `subtitleIdx` (-1 = off)
  // rather than the <track default> attribute so the CC menu stays in control.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tt = v.textTracks;
    for (let i = 0; i < tt.length; i++) {
      tt[i].mode = i === subtitleIdx ? 'showing' : 'disabled';
    }
  }, [subtitleIdx, tracks.length, reloadKey]);

  // ---- Fullscreen state --------------------------------------------------
  // Tracks both the standard Fullscreen API (desktop, Android, iPad Safari) and
  // iOS's native <video> fullscreen, which fires webkitbegin/endfullscreen on
  // the element instead of updating document.fullscreenElement.
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

  // ---- Controls auto-hide ------------------------------------------------
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2800);
  }, []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  // ---- Auto-Next ---------------------------------------------------------
  // Toggle persists the preference; cancel tears down any running countdown.
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

  // Start the grace-period countdown, then hand off to the next episode. Reveals
  // the controls so the countdown card is visible even if they'd auto-hidden.
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

  // Clear any pending countdown on unmount so the timer can't fire into a gone
  // component (e.g. the viewer navigates away mid-countdown).
  useEffect(() => () => cancelAutoNext(), [cancelAutoNext]);

  // When playback reaches the end and Auto-Next is armed (and a next episode
  // exists), kick off the countdown. Declared after `beginAutoNext` so it can
  // depend on it; sees the current `autoNext`/`hasNext` without re-binding the
  // [] -dep events listeners. `onNext` is read through its ref.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const onEnded = () => {
      if (autoNext && hasNext && onNextRef.current) beginAutoNext();
    };
    v.addEventListener('ended', onEnded);
    return () => v.removeEventListener('ended', onEnded);
  }, [autoNext, hasNext, beginAutoNext]);

  // ---- Skip Intro / Outro (AniSkip, anime-only) --------------------------
  // `skipTimes` is { op:{start,end}, ed:{start,end} } (either may be null). We show
  // a "Skip Intro" button while inside the OP window and a "Skip Outro" button
  // inside the ED window; and when Auto-Next is armed, entering the ED window kicks
  // off the existing "Up Next" card early so it doubles as a Continue-Watching prompt.
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

  // Auto-arm the Up Next card when playback reaches the outro (not just on `ended`),
  // so Auto-Next viewers roll into the next episode over the credits. Once per source.
  const edAutoArmed = useRef(false);
  useEffect(() => { edAutoArmed.current = false; }, [src]);
  useEffect(() => {
    if (!inEdRange || edAutoArmed.current || countdown !== null) return;
    if (autoNext && hasNext && onNextRef.current) {
      edAutoArmed.current = true;
      beginAutoNext();
    }
  }, [inEdRange, autoNext, hasNext, countdown, beginAutoNext]);

  // ---- Actions -----------------------------------------------------------
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    cancelAutoNext(); // the viewer took over — don't yank them to the next episode
    if (v.paused) v.play().catch(() => {}); else v.pause();
    revealControls();
  }, [revealControls, cancelAutoNext]);

  const skip = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    cancelAutoNext();
    const dur = v.duration || duration || 0;
    const target = v.currentTime + delta;
    v.currentTime = dur ? Math.min(dur, Math.max(0, target)) : Math.max(0, target);
    setCurrent(v.currentTime);
    revealControls();
  }, [duration, revealControls, cancelAutoNext]);

  // Tapping the video: on touch (mobile) the first tap only summons the controls
  // and a second tap dismisses them — it must NOT pause, which is jarring on a
  // phone. With a mouse, a click still toggles play/pause as usual.
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
    if (!v || !duration) return;
    cancelAutoNext();
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = frac * duration;
    setCurrent(v.currentTime);
  }, [duration, cancelAutoNext]);

  const onScrubStart = useCallback((e) => {
    const bar = e.currentTarget;
    seekTo(e.clientX, bar);
    const move = (ev) => seekTo(ev.clientX, bar);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [seekTo]);

  const toggleMute = useCallback(() => { const v = videoRef.current; if (v) v.muted = !v.muted; }, []);
  const changeVolume = useCallback((val) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val; v.muted = val === 0;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current;
    const v = videoRef.current;
    // Already fullscreen via the standard API? Exit it.
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    // Standard Fullscreen API (desktop, Android, iPad Safari in-browser), with
    // the webkit-prefixed form for older Safari.
    if (wrap?.requestFullscreen) { wrap.requestFullscreen(); return; }
    if (wrap?.webkitRequestFullscreen) { wrap.webkitRequestFullscreen(); return; }
    // iOS fallback: iPhones (every browser) and iPad homescreen webapps can't
    // fullscreen an arbitrary element — only the <video> itself can, and it's
    // dismissed with the native "Done" button rather than an exit call.
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

  // HLS level switch (the settings panel stays open so the viewer can keep tuning).
  const pickLevel = useCallback((lvl) => {
    const hls = hlsRef.current;
    if (hls) { hls.currentLevel = lvl; setCurrentLevel(lvl); }
  }, []);

  // Provider-grouped sources for the cog's Sources section (shared grouping with
  // the sidebar). Picking a source closes the panel — it remounts the player.
  const sourceGroups = useMemo(() => groupStreams(sources), [sources]);
  const pickSource = useCallback((idx) => {
    setShowSettings(false);
    if (idx !== activeSourceIdx) onSelectSource?.(idx);
  }, [activeSourceIdx, onSelectSource]);

  const retry = useCallback(() => { setError(null); setReloadKey((k) => k + 1); }, []);

  // Download the current source to disk. For mp4 this streams the file straight
  // through; for HLS it fetches + concatenates (and AES-decrypts) every segment,
  // so on long episodes it can take a while — hence the live progress + cancel.
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

  // Abort an in-flight download if the source changes or the player unmounts.
  useEffect(() => () => dlAbortRef.current?.abort(), [src]);

  // ---- Keyboard shortcuts -----------------------------------------------
  // Active while the player is mounted (only one ever is). Ignored while typing
  // in a field. Space/K play·pause, ←/→ (and J/L) seek, ↑/↓ volume, F fullscreen,
  // M mute, P picture-in-picture.
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
  // Provider deck that holds the currently-playing source, so opening the cog
  // auto-expands it in the Sources section.
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
        // Only opt into CORS when we actually have external <track>s to fetch:
        // cross-origin text tracks need it, but forcing it on every source would
        // make plain media playback depend on CORS headers unnecessarily.
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

      {/* Buffering sigil */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-[3px] border-crimson-500/10 border-t-crimson-500 animate-spin shadow-[0_0_50px_rgba(255,0,60,0.3)]" />
            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-crimson-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Center play crest (paused, idle) — hidden while the Auto-Next card is up */}
      {!playing && !loading && !error && countdown === null && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-24 h-24 sm:w-28 sm:h-24 grid place-items-center rounded-full bg-crimson-950/40 border border-crimson-500/30 backdrop-blur-md text-white shadow-[0_0_60px_rgba(255,0,60,0.4)] hover:bg-crimson-500/20 hover:border-crimson-400 hover:scale-110 transition-all duration-300 active:scale-95 group z-10"
          aria-label="Play"
        >
          <Play className="w-10 h-10 sm:w-12 sm:h-12 translate-x-0.5 fill-current drop-shadow-[0_0_15px_rgba(255,0,60,0.8)]" />
        </button>
      )}

      {/* Top title ribbon */}
      <div className={`absolute top-0 inset-x-0 px-6 sm:px-8 pt-6 pb-12 bg-gradient-to-b from-crimson-950/90 via-crimson-950/40 to-transparent flex items-center gap-3 transition-opacity duration-500 ${controlsVisible || !playing ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c]"></div>
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-crimson-50 truncate drop-shadow-lg">
          {title || 'Crimson Haven Manifest'}
        </span>
      </div>

      {/* Error sigil */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 text-center p-8 backdrop-blur-xl z-30">
          <div className="p-5 rounded-full bg-crimson-500/10 border border-crimson-500/20 mb-6">
             <AlertTriangle className="w-12 h-12 text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.5)]" />
          </div>
          <p className="text-white font-black text-lg sm:text-2xl mb-2 uppercase tracking-tighter">Playback Link Severed</p>
          <p className="text-crimson-400/80 text-xs sm:text-sm max-w-sm mb-8 font-medium leading-relaxed">{error}</p>
          <button onClick={retry} className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_20px_rgba(255,0,60,0.3)] active:scale-95">
            <RotateCcw className="w-4 h-4" /> Re-Establish Node
          </button>
        </div>
      )}

      {/* Skip Intro / Skip Outro crests (AniSkip). Hidden while the Up Next card is
          up (the card supersedes the outro button when Auto-Next is armed). */}
      {!error && countdown === null && (inOpRange || inEdRange) && (
        <button
          onClick={inOpRange ? skipIntro : skipOutro}
          className="absolute z-40 bottom-28 right-4 sm:right-6 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-crimson-950/90 border border-crimson-500/40 backdrop-blur-2xl text-white shadow-[0_15px_50px_rgba(0,0,0,0.7)] hover:bg-crimson-600 hover:border-crimson-400 hover:scale-[1.03] transition-all active:scale-95 animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <SkipForward className="w-4 h-4 fill-current text-crimson-400" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">
            {inOpRange ? 'Skip Intro' : 'Skip Outro'}
          </span>
        </button>
      )}

      {/* Auto-Next countdown crest — Netflix-style "Up Next" with a grace period */}
      {countdown !== null && !error && (
        <div className="absolute z-40 bottom-28 right-4 sm:right-6 w-72 max-w-[calc(100%-2rem)] rounded-3xl bg-crimson-950/95 border border-crimson-500/30 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-5 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c] animate-pulse" />
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-500">Up Next</p>
          </div>
          <p className="text-sm font-black text-white truncate mb-1.5">{nextLabel || 'Next Episode'}</p>
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

      {/* Control altar */}
      {!error && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-0 inset-x-0 px-4 sm:px-6 pb-4 pt-20 bg-gradient-to-t from-crimson-950 via-crimson-950/70 to-transparent transition-opacity duration-500 ${controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {/* Seek bar */}
          <div
            onPointerDown={onScrubStart}
            className="group/seek relative h-6 flex items-center cursor-pointer mb-2"
          >
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/5 overflow-hidden backdrop-blur-sm border border-white/5 shadow-inner">
              <div className="absolute inset-y-0 left-0 bg-crimson-500/20" style={{ width: `${bufPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-crimson-800 via-crimson-600 to-crimson-400 shadow-[0_0_20px_rgba(255,0,60,0.8)]" style={{ width: `${pct}%` }}>
                 <div className="absolute top-0 right-0 w-12 h-full bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
              </div>
            </div>
            <div
              className="absolute w-4 h-4 rounded-full bg-white border-[3px] border-crimson-500 shadow-[0_0_15px_rgba(255,0,60,1)] -translate-x-1/2 scale-0 group-hover/seek:scale-100 transition-transform duration-200 z-10"
              style={{ left: `${pct}%` }}
            />
          </div>

          {/* Button row */}
          <div className="flex items-center gap-2 sm:gap-4 text-crimson-100">
            <button onClick={togglePlay} className="p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current translate-x-px" />}
            </button>

            {/* Skip back / forward */}
            <div className="flex items-center gap-1">
              <button onClick={() => skip(-SKIP_SECONDS)} className="relative p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90" aria-label={`Back ${SKIP_SECONDS} seconds`}>
                <RotateCcw className="w-5 h-5" />
                <span className="absolute inset-0 grid place-items-center text-[7px] font-black tabular-nums pointer-events-none">{SKIP_SECONDS}</span>
              </button>
              <button onClick={() => skip(SKIP_SECONDS)} className="relative p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all active:scale-90" aria-label={`Forward ${SKIP_SECONDS} seconds`}>
                <RotateCw className="w-5 h-5" />
                <span className="absolute inset-0 grid place-items-center text-[7px] font-black tabular-nums pointer-events-none">{SKIP_SECONDS}</span>
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center group/vol ml-2">
              <button onClick={toggleMute} className="p-2 rounded-xl hover:bg-crimson-500/20 hover:text-white transition-all" aria-label="Mute">
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="overflow-hidden w-0 group-hover/vol:w-20 sm:group-hover/vol:w-24 transition-all duration-300 ease-out flex items-center">
                 <input
                  type="range" min="0" max="1" step="0.05"
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  className="w-full opacity-0 group-hover/vol:opacity-100 transition-opacity duration-300 h-1 cursor-pointer mx-2"
                  style={{ accentColor: '#ff003c' }}
                  aria-label="Volume"
                />
              </div>
            </div>

            <span className="text-[11px] font-mono font-black text-crimson-100 tracking-tighter tabular-nums bg-crimson-950/60 px-3 py-1.5 rounded-lg border border-white/5 ml-2">
              {fmt(current)} <span className="text-crimson-500 mx-0.5">/</span> {fmt(duration)}
            </span>

            <div className="flex-1" />

            {/* Auto-Next toggle — only for episodic content (onNext provided). Off
                by default; persisted. Advances to the next episode when one ends. */}
            {onNext && (
              <button
                onClick={toggleAutoNext}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-crimson-950/40 border transition-all active:scale-95 hover:text-white ${
                  autoNext ? 'border-crimson-500/60 text-white' : 'border-white/5 hover:border-crimson-500/50'
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

            {/* Settings cog — Sources / Quality / Subtitles in one altar so none of
                them need leaving fullscreen (movie-web-style, dressed in crimson). */}
            {(sources.length > 1 || levels.length > 1 || tracks.length > 0) && (
              <div className="relative">
                <button
                  onClick={() => { setSettingsOpenGroup(activeGroupKey); setShowSettings((s) => !s); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-crimson-950/40 border transition-all active:scale-95 hover:text-white ${
                    showSettings ? 'border-crimson-500/60 text-white' : 'border-white/5 hover:border-crimson-500/50'
                  }`}
                  aria-label="Settings"
                  aria-pressed={showSettings}
                  title="Sources · Quality · Subtitles"
                >
                  <Settings className={`w-4 h-4 transition-transform duration-500 ${showSettings ? 'rotate-90 text-crimson-400' : 'text-crimson-500'}`} />
                </button>
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-4 w-72 max-h-[60vh] overflow-y-auto no-scrollbar rounded-2xl bg-crimson-950/95 border border-crimson-500/20 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom-2 fade-in duration-300 z-50 divide-y divide-white/5">

                    {/* Sources */}
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
                                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${containsActive && !open ? 'bg-crimson-600/80 text-white' : 'text-crimson-300 hover:bg-crimson-500/20 hover:text-white'}`}
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <Layers className="w-3 h-3 shrink-0 text-crimson-500" />
                                    <span className="truncate">{group.label}</span>
                                    <span className="text-crimson-500/80">· {group.items.length}</span>
                                  </span>
                                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                                </button>
                                {open && (
                                  <div className="mt-1 ml-3 pl-2 border-l border-crimson-900/60 space-y-1 animate-in slide-in-from-top-1 fade-in duration-200">
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
                      </div>
                    )}

                    {/* Quality (HLS levels of the active source) */}
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

                    {/* Subtitles */}
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

            <div className="flex items-center gap-1">
              {/* Download the current source to disk. Disabled label flips to a
                  live %/cancel affordance while a download is in flight. */}
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
    </div>
  );
}
