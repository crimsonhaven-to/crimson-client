import { useEffect } from 'react';

// Shared with the on-screen back/forward buttons so both jump by the same step.
export const SKIP_SECONDS = 10;

export function usePlayerShortcuts(videoRef, { togglePlay, skip, changeVolume, toggleFullscreen, toggleMute, togglePip, revealControls }) {
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
  }, [togglePlay, skip, changeVolume, toggleFullscreen, toggleMute, togglePip, revealControls, videoRef]);
}
