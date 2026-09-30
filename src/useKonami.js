import { useEffect, useRef } from 'react';

// A wrong key resets progress, unless it is itself the first key, which restarts it.
// Own module so App can mount the hook eagerly while the secret page stays code-split.
const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
];

export function useKonamiCode(onUnlock) {
  const progress = useRef(0);
  // Keep the latest callback without re-binding the listener each render.
  const cb = useRef(onUnlock);
  cb.current = onUnlock;

  useEffect(() => {
    const onKey = (e) => {
      // Don't hijack typing in inputs/textareas (e.g. the search box).
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

      const want = KONAMI[progress.current];
      if (e.key === want || e.key?.toLowerCase() === want) {
        progress.current += 1;
        if (progress.current === KONAMI.length) {
          progress.current = 0;
          cb.current?.();
        }
      } else {
        progress.current = e.key === KONAMI[0] ? 1 : 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
