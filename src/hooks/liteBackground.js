// --- Lite background (client-only performance preference) -------------------
// Disables the animated mesh background's motion/blur/layer-promotion in favour
// of a static gradient (see MeshBackground.jsx + .mesh-bg.is-lite in index.css).
// Deliberately a per-DEVICE choice kept in its own localStorage key — NOT folded
// into the account-synced playback-prefs blob: a weak phone and a desktop want
// different answers, and keeping it local means it never touches the
// /account/preferences contract. Mirrors the playback-prefs event pattern so the
// background (mounted high in the tree) reacts the instant the toggle flips.
import { useEffect, useState } from 'react';

const LITE_BG_KEY = 'crimson:lite-background';

export function getLiteBackground() {
  return localStorage.getItem(LITE_BG_KEY) === '1';
}

export function setLiteBackground(on) {
  localStorage.setItem(LITE_BG_KEY, on ? '1' : '0');
  window.dispatchEvent(new Event('crimson-lite-background'));
}

export function useLiteBackground() {
  const [lite, setLite] = useState(getLiteBackground);
  useEffect(() => {
    const sync = () => setLite(getLiteBackground());
    window.addEventListener('crimson-lite-background', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-lite-background', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return lite;
}
