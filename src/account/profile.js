import { useEffect, useState } from 'react';
import { apiFetch, extractError, useSessionToken } from '../hooks/apiClient';
import { syncPlaybackPrefsFromAccount } from '../hooks/playbackPrefs';

// /account/me only, so the nav can check is_admin without the full useAccount
// fan-out on every page.
export function useProfile() {
  const sessionToken = useSessionToken();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!sessionToken) { setProfile(null); return; }
    let cancelled = false;
    const load = () => {
      apiFetch('/account/me')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (cancelled || !data) return;
          setProfile(data);
          // Always mounted, so prefs follow the user to a new device before they ever
          // open settings.
          syncPlaybackPrefsFromAccount(data.preferences);
        })
        .catch(() => {});
    };
    load();
    // A display name saved elsewhere updates greetings without a reload.
    window.addEventListener('crimson-profile', load);
    return () => { cancelled = true; window.removeEventListener('crimson-profile', load); };
  }, [sessionToken]);

  return profile;
}

// '' clears the display name. Returns the stored value or null.
export async function updateUsername(username) {
  const res = await apiFetch('/account/username', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(extractError(data, 'Could not save your display name'));
  }
  const data = await res.json();
  window.dispatchEvent(new Event('crimson-profile'));
  return data.username ?? null;
}
