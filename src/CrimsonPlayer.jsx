import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings2, RotateCcw, RotateCw, AlertTriangle, PictureInPicture2, Sparkles,
} from 'lucide-react';

// How far the skip-back / skip-forward buttons (and ←/→ keys) jump, in seconds.
const SKIP_SECONDS = 10;

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
export default function CrimsonPlayer({ src, type = '', poster = '', title = '', autoPlay = true, startAt = 0, onProgress }) {
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
  const [showQuality, setShowQuality] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

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

  // ---- Fullscreen state --------------------------------------------------
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
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

  // ---- Actions -----------------------------------------------------------
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
    revealControls();
  }, [revealControls]);

  const skip = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    const dur = v.duration || duration || 0;
    const target = v.currentTime + delta;
    v.currentTime = dur ? Math.min(dur, Math.max(0, target)) : Math.max(0, target);
    setCurrent(v.currentTime);
    revealControls();
  }, [duration, revealControls]);

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
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = frac * duration;
    setCurrent(v.currentTime);
  }, [duration]);

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
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrapRef.current?.requestFullscreen?.();
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch { /* unsupported */ }
  }, []);

  const pickLevel = useCallback((lvl) => {
    setShowQuality(false);
    const hls = hlsRef.current;
    if (hls) { hls.currentLevel = lvl; setCurrentLevel(lvl); }
  }, []);

  const retry = useCallback(() => { setError(null); setReloadKey((k) => k + 1); }, []);

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
        onPointerDown={(e) => { lastPointerType.current = e.pointerType || 'mouse'; }}
        onClick={onVideoTap}
        className="w-full h-full bg-black object-contain"
      />

      {/* Buffering sigil */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-[3px] border-crimson-500/10 border-t-crimson-500 animate-spin shadow-[0_0_50px_rgba(255,0,60,0.3)]" />
            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-crimson-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Center play crest (paused, idle) */}
      {!playing && !loading && !error && (
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

            {/* Quality */}
            {levels.length > 1 && (
              <div className="relative">
                <button onClick={() => setShowQuality((s) => !s)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-crimson-950/40 border border-white/5 hover:border-crimson-500/50 hover:text-white transition-all active:scale-95" aria-label="Quality">
                  <Settings2 className="w-4 h-4 text-crimson-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{qLabel(currentLevel)}</span>
                </button>
                {showQuality && (
                  <div className="absolute bottom-full right-0 mb-4 w-32 rounded-2xl bg-crimson-950/95 border border-crimson-500/20 backdrop-blur-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-2 duration-300 z-50">
                    {[-1, ...levels.map((_, i) => i)].reverse().map((lvl) => (
                      <button key={lvl} onClick={() => pickLevel(lvl)} className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b border-white/5 last:border-0 ${currentLevel === lvl ? 'bg-crimson-600 text-white' : 'text-crimson-400 hover:bg-crimson-500/20 hover:text-white'}`}>
                        {qLabel(lvl)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1">
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
