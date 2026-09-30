import { useEffect, useRef, useState, useCallback } from 'react';

// Gives the viewer a beat to cancel before Auto-Next advances.
export const AUTO_NEXT_SECONDS = 8;
const AUTO_NEXT_KEY = 'crimson:autoNext';

export function useAutoNext({ videoRef, onNextRef, hasNext, inEdRange, src, mediaKey, revealControls }) {
  const [autoNext, setAutoNext] = useState(() => {
    try { return localStorage.getItem(AUTO_NEXT_KEY) === '1'; } catch { return false; }
  });
  const [countdown, setCountdown] = useState(null);
  const countdownTimer = useRef(null);

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
  }, [cancelAutoNext, revealControls, onNextRef]);

  const playNextNow = useCallback(() => {
    cancelAutoNext();
    onNextRef.current?.();
  }, [cancelAutoNext, onNextRef]);

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
  }, [autoNext, hasNext, beginAutoNext, videoRef, onNextRef]);

  // Arming at the outro rather than on `ended` rolls Auto-Next viewers over the credits.
  const edAutoArmed = useRef(false);
  useEffect(() => { edAutoArmed.current = false; }, [src, mediaKey]);
  useEffect(() => {
    if (!inEdRange || edAutoArmed.current || countdown !== null) return;
    if (autoNext && hasNext && onNextRef.current) {
      edAutoArmed.current = true;
      beginAutoNext();
    }
  }, [inEdRange, autoNext, hasNext, countdown, beginAutoNext, onNextRef]);

  return { autoNext, toggleAutoNext, countdown, cancelAutoNext, playNextNow };
}
