import { useEffect, useState } from 'react';
import { useLiteBackground } from '../account/liteBackground';

// A window left open beside other work, typically with music playing, would
// otherwise repaint at the display's refresh rate for hours.
function useWindowFocused() {
  const [focused, setFocused] = useState(() => document.hasFocus());
  useEffect(() => {
    const focus = () => setFocused(true);
    const blur = () => setFocused(false);
    window.addEventListener('focus', focus);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('focus', focus);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return focused;
}

// Styles and the performance reasoning live in index.css (.mesh-bg).
export default function MeshBackground() {
  const lite = useLiteBackground();
  const focused = useWindowFocused();
  return (
    <div className={`mesh-bg${lite ? ' is-lite' : ''}${focused ? '' : ' is-paused'}`} aria-hidden="true">
      <span className="mesh-blob mesh-blob-1" />
      <span className="mesh-blob mesh-blob-2" />
      <span className="mesh-blob mesh-blob-3" />
      <span className="mesh-blob mesh-blob-4" />
      <div className="mesh-vignette" />
    </div>
  );
}
