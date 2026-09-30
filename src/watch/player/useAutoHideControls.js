import { useEffect, useRef, useState, useCallback } from 'react';

export function useAutoHideControls(videoRef) {
  const hideTimer = useRef(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2800);
  }, [videoRef]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  return { controlsVisible, setControlsVisible, revealControls };
}
