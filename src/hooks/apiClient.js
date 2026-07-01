// --- Core API client + reactive session token -------------------------------
// The single choke point through which every backend request flows (apiFetch,
// which attaches the login-wall bearer token), plus the reactive session-token
// plumbing. The session token lives in localStorage, which isn't reactive, so a
// login/logout in one hook instance wouldn't update the others without a remount.
// We bridge them with a window event: auth mutations go through setAuthStorage
// (which dispatches 'crimson-auth'), and every useSessionToken subscriber re-reads
// — so all instances stay in sync within the tab (and across tabs via 'storage').
import { useEffect, useState } from 'react';

import { API_BASE_URL } from './config';

export const SESSION_KEY = 'crimson_session';
export const PUBKEY_KEY = 'crimson_public_key';

export function setAuthStorage(sessionToken, publicKey) {
  if (sessionToken) localStorage.setItem(SESSION_KEY, sessionToken);
  else localStorage.removeItem(SESSION_KEY);
  if (publicKey) localStorage.setItem(PUBKEY_KEY, publicKey);
  else localStorage.removeItem(PUBKEY_KEY);
  window.dispatchEvent(new Event('crimson-auth'));
}

// Plain (non-hook) read of the current session token, for the few places that
// can't use a React hook — notably hls.js's xhrSetup, which must attach the bearer
// to login-walled media requests (the on-the-fly transcode at /local_hls) that a
// <video>/hls.js request can't otherwise authenticate.
export function getSessionToken() {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}

// Public, unauthenticated deployment flags (GET /config) — fetched once at boot and
// cached module-wide so every caller shares a single request. Read pre-login by the
// login page to drop the invite-code requirement on a demo instance (demo_mode).
let _publicConfig = null;
let _publicConfigPromise = null;
export function usePublicConfig() {
  const [config, setConfig] = useState(_publicConfig || {});
  useEffect(() => {
    if (_publicConfig) return;
    if (!_publicConfigPromise) {
      _publicConfigPromise = apiFetch('/config')
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
    }
    let alive = true;
    _publicConfigPromise.then((c) => {
      _publicConfig = c || {};
      if (alive) setConfig(_publicConfig);
    });
    return () => { alive = false; };
  }, []);
  return config;
}

// Pull a human-readable message out of a FastAPI error body (detail can be a
// string, or an array of validation errors on a 422).
export function extractError(data, fallback = 'Something went wrong') {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d.length) return d[0]?.msg || fallback;
  return fallback;
}

// The backend now enforces a login wall: every content/account endpoint needs a
// valid session bearer token. apiFetch is the single choke point that attaches
// it. Pass a path ("/trending") or an absolute URL; the token is read live from
// storage so it always reflects the current session. A 401 on a request we
// *thought* was authed means the session expired/was revoked server-side, so we
// clear it — which re-renders the app behind the login wall.
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const token = localStorage.getItem(SESSION_KEY);
  const headers = { ...(options.headers || {}) };
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && token) {
    setAuthStorage(null, null);
  }
  return res;
}

export function useSessionToken() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY));
  useEffect(() => {
    const sync = () => setToken(localStorage.getItem(SESSION_KEY));
    window.addEventListener('crimson-auth', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-auth', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return token;
}
