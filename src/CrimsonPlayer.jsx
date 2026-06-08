import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { AlertTriangle, RotateCcw, Settings2 } from 'lucide-react';

/**
 * CrimsonPlayer — the Haven's own HLS / MP4 player.
 *
 * Plays direct streams (the backend's proxied VOE / Vidmoly / … m3u8 + mp4
 * sources) in-app instead of dumping a "Direct Link" URL on the user. Uses
 * hls.js where the browser can't play HLS natively (Chrome/Firefox) and falls
 * back to the native <video> for mp4 and for Safari's built-in HLS.
 *
 * Native controls are kept (reliable fullscreen / PiP / seek / volume, themed
 * with the crimson accent), and we layer the Haven's branding on top: a crimson
 * buffering ring, a styled error + retry overlay, and an HLS quality selector.
 */
export default function CrimsonPlayer({ src, type = '', poster = '', title = '', autoPlay = true }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levels, setLevels] = useState([]);     // HLS quality levels (empty for mp4)
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [showQuality, setShowQuality] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // bump to force a fresh load (retry)

  const isHls = type === 'hls' || (typeof src === 'string' && src.toLowerCase().includes('.m3u8'));

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setLoading(true);
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);

    let hls;

    const onPlaying = () => setLoading(false);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);

    if (isHls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30, enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels || []);
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        // Try the standard hls.js recovery before surfacing a hard error.
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            setError('This stream could not be played. Try another source.');
            hls.destroy();
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS: native HLS.
      video.src = src;
      if (autoPlay) video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), { once: true });
    } else {
      // Progressive mp4 (or anything the browser can play directly).
      video.src = src;
      if (autoPlay) video.addEventListener('loadeddata', () => video.play().catch(() => {}), { once: true });
    }

    const onError = () => {
      // hls.js owns error handling when active; only surface raw <video> errors
      // for the native (mp4 / Safari-HLS) path.
      if (!hlsRef.current) setError('Could not load this stream. Try another source.');
    };
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [src, isHls, autoPlay, reloadKey]);

  const pickLevel = useCallback((lvl) => {
    setShowQuality(false);
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = lvl; // -1 => Auto
    setCurrentLevel(lvl);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const qualityLabel = (lvl) => {
    if (lvl === -1) return 'Auto';
    const h = levels[lvl]?.height;
    return h ? `${h}p` : `Level ${lvl + 1}`;
  };

  return (
    <div className="absolute inset-0 bg-black group/player">
      <video
        ref={videoRef}
        poster={poster || undefined}
        controls
        autoPlay={autoPlay}
        playsInline
        title={title || undefined}
        className="w-full h-full bg-black"
        style={{ accentColor: '#ff003c' }}
      />

      {/* Buffering ring */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full border-4 border-crimson-900/40 border-t-crimson-500 animate-spin shadow-[0_0_30px_rgba(255,0,60,0.35)]" />
        </div>
      )}

      {/* HLS quality selector (only when more than one level is offered) */}
      {!error && levels.length > 1 && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setShowQuality((s) => !s)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-crimson-950/80 border border-crimson-900/70 text-crimson-200 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm hover:border-crimson-500 hover:text-white transition-colors"
            aria-label="Select quality"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {qualityLabel(currentLevel)}
          </button>
          {showQuality && (
            <div className="absolute right-0 mt-1.5 w-32 rounded-lg bg-crimson-950/95 border border-crimson-900/70 backdrop-blur-md overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
              {[-1, ...levels.map((_, i) => i)].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => pickLevel(lvl)}
                  className={`w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors ${
                    currentLevel === lvl
                      ? 'bg-crimson-500 text-white'
                      : 'text-crimson-200 hover:bg-crimson-900/40 hover:text-white'
                  }`}
                >
                  {qualityLabel(lvl)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/90 text-center p-6">
          <AlertTriangle className="w-10 h-10 text-crimson-500 mb-3" />
          <p className="text-white font-bold text-sm sm:text-base mb-1">Playback Disrupted</p>
          <p className="text-crimson-300/80 text-xs max-w-sm mb-4">{error}</p>
          <button
            onClick={retry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-crimson-500 hover:bg-crimson-400 text-white text-xs font-black uppercase tracking-widest transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}
    </div>
  );
}
