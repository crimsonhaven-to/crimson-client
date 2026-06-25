import { useEffect, useRef } from 'react';

// ↑ ↑ ↓ ↓ ← → ← → B A — the old incantation. useKonamiCode watches global
// keydowns and fires `onUnlock` when the full sequence is entered in order; a
// wrong key resets progress (but a key that is itself the first key restarts it).
// Lives in its own tiny module so App can mount the hook eagerly at the root while
// the secret page it reveals stays lazily code-split.
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
