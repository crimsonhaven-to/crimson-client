import { useEffect, useRef } from 'react';

// Runs `callback` every `ms` while the tab is visible, and once on coming back to
// it, so a chat left open in a background tab catches up the moment it is seen.
export function useVisiblePoll(callback, ms) {
  const latest = useRef(callback);
  useEffect(() => { latest.current = callback; });

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') latest.current(); };
    const timer = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms]);
}
