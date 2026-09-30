// localStorage is not reactive, so auth changes go through setAuthStorage, which
// fires 'crimson-auth' for useSessionToken subscribers in this tab ('storage'
// covers other tabs).
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

// For places that cannot use a hook, notably hls.js's xhrSetup, which must attach
// the bearer to login-walled /local_hls requests.
export function getSessionToken() {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}

// Unauthenticated, so the login page can read demo_mode before sign-in. Cached
// module-wide so every caller shares one request.
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

// FastAPI's own 422s carry `detail` (a string or field-error array). Every raised
// HTTPException is rewritten by the backend into {success, error, message}, where
// `error` is the real reason and `message` is Lumi's voiced banner line.
export function extractError(data, fallback = 'Something went wrong') {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d.length) return d[0]?.msg || fallback;
  if (typeof data?.error === 'string' && data.error) return data.error;
  return fallback;
}

// A 401 on a request that carried a token means the session was revoked or
// expired server-side, so clearing it drops the app back behind the login wall.
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
