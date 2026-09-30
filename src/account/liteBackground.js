// Per-device on purpose, not in the account-synced playback prefs: a weak phone
// and a desktop want different answers.
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
