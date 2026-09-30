import { useCallback, useEffect, useState } from 'react';

const NUDGE_DISMISSED_KEY = 'crimson:extBanner:dismissed';

// The companion fires a one-shot `crimson-extension-ready` at document_start, which
// can land before mount, so seed from the global AND listen, racing a short re-check.
export function useCompanionPresence() {
  const [present, setPresent] = useState(() => {
    try { return Boolean(window.CrimsonExtension?.available); } catch { return false; }
  });
  const [version, setVersion] = useState(() => {
    try { return window.CrimsonExtension?.version || null; } catch { return null; }
  });
  useEffect(() => {
    if (present) return;
    const sync = () => {
      try {
        if (window.CrimsonExtension?.available) {
          setPresent(true);
          setVersion(window.CrimsonExtension.version || null);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('crimson-extension-ready', sync, { once: true });
    const t = setTimeout(sync, 400);
    return () => { window.removeEventListener('crimson-extension-ready', sync); clearTimeout(t); };
  }, [present]);
  return { present, version };
}

// One dismiss key for every nudge, so dismissing the home banner also hides the
// one on the watch page.
export function useCompanionNudge() {
  const { present } = useCompanionPresence();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(NUDGE_DISMISSED_KEY) === '1'; } catch { return false; }
  });
  const dismiss = useCallback(() => {
    try { localStorage.setItem(NUDGE_DISMISSED_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  }, []);
  return { show: !present && !dismissed, dismiss };
}
