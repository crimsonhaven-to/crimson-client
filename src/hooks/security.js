// The account's own security surface (backend: account_engine/security_routes).
//
// Sessions, the slice of the security ledger that belongs to you, a full export
// and self-service deletion. Everything here is read-only except the two
// destructive actions, both of which re-confirm rather than trusting the bearer
// token already in hand.
import { useCallback, useEffect, useState } from 'react';

import { apiFetch, extractError, setAuthStorage, useSessionToken } from './apiClient';

// Nothing here is decoded client-side: a session is addressed by the opaque id
// the server derives, and the ledger arrives already filtered and stripped.

export function useSessions() {
  const sessionToken = useSessionToken();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!sessionToken) { setSessions([]); setLoading(false); return; }
    try {
      const res = await apiFetch('/account/sessions');
      if (!res.ok) throw new Error('sessions unavailable');
      setSessions((await res.json()).sessions || []);
      setError(null);
    } catch (e) {
      console.error('Sessions fetch error:', e);
      setError('Your sessions could not be read just now.');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { refresh(); }, [refresh]);

  const revoke = useCallback(async (id) => {
    try {
      const res = await apiFetch(`/account/sessions/${id}`, { method: 'DELETE' });
      // Signing out the session you are using clears the token app-wide, which
      // apiFetch already does on the 401 that follows. Refreshing is enough.
      if (res.ok) { await refresh(); return true; }
    } catch (e) {
      console.error('Revoke error:', e);
    }
    return false;
  }, [refresh]);

  const revokeOthers = useCallback(async () => {
    try {
      const res = await apiFetch('/account/sessions', { method: 'DELETE' });
      if (res.ok) { await refresh(); return (await res.json()).revoked ?? 0; }
    } catch (e) {
      console.error('Revoke-others error:', e);
    }
    return null;
  }, [refresh]);

  return { sessions, loading, error, refresh, revoke, revokeOthers };
}

export function useSecurityEvents() {
  const sessionToken = useSessionToken();
  const [events, setEvents] = useState([]);
  const [retentionDays, setRetentionDays] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) { setEvents([]); setLoading(false); return; }
    let alive = true;
    apiFetch('/account/security-events')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setEvents(data.events || []);
        setRetentionDays(data.retention_days ?? null);
      })
      .catch((e) => console.error('Security events fetch error:', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sessionToken]);

  return { events, retentionDays, loading };
}

// The export is an attachment, and the login wall needs a bearer header, so it
// cannot be a plain <a download>. Fetch it, then hand the blob to the browser.
export async function downloadAccountExport() {
  const res = await apiFetch('/account/export');
  if (!res.ok) throw new Error('The export could not be prepared.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `crimson-account-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Deletion is confirmed again, with the password for an email account or a
// signed challenge for a mnemonic one. `confirmation` is whichever the caller
// gathered; the server decides which one this account needs.
export async function deleteAccount(confirmation) {
  const res = await apiFetch('/account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(confirmation || {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(extractError(data, 'The account could not be deleted.'));
  }
  // The session is gone with the account; clearing it drops the app back behind
  // the login wall rather than leaving a dead token in storage.
  setAuthStorage(null, null);
  return true;
}