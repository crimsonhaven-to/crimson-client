import { useEffect, useState, useCallback } from 'react';

export function useFullscreen(wrapRef, videoRef) {
  const [fullscreen, setFullscreen] = useState(false);

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
  }, [wrapRef, videoRef]);

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
  }, [wrapRef, videoRef]);

  return { fullscreen, toggleFullscreen };
}
