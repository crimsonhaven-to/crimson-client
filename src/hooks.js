import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { streamLocalSources, clientSourcesEnabled } from './clientSources';
// Pure stream ranking/grouping moved to streamUtils.js. streamRank is used here by
// the streamer hooks; the grouping/label helpers are re-exported for the existing
// importers (WatchView, CrimsonPlayer) that still import them from './hooks'.
import { streamRank } from './streamUtils';
export { groupStreams, streamVariantLabel, streamProviderLabel, streamPriority } from './streamUtils';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend.crimsonhaven.to';
//export const API_BASE_URL = 'http://localhost:8000'; // For local development against a locally running backend
export const CLIENT_VERSION = '11.4.0';

// Deployment-specific copy that used to be hardcoded (from when the repo was
// private). Baked in at BUILD time like VITE_API_BASE_URL, so set these as build
// args / env vars in the deploy pipeline — not at container runtime.
//   VITE_HOSTED_IN  — where user data lives, e.g. "Switzerland" or "🇨🇭 Switzerland".
//   VITE_DMCA_MAIL  — contact address for takedown / DMCA requests.
export const HOSTED_IN = import.meta.env.VITE_HOSTED_IN || 'Secret:3';
export const DMCA_MAIL = import.meta.env.VITE_DMCA_MAIL || 'NoEmailProvided';

// Hex-encode a byte array. Replaces the `buffer` polyfill we previously pulled in
// just for this one call — the crypto libs already hand back plain Uint8Arrays.
const toHex = (arr) => Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');

// --- Lazy crypto -----------------------------------------------------------
// ed25519 + the bip39 wordlist are only ever needed when the viewer actually
// signs in or mints a mnemonic identity — never for logged-out first paint or
// for the rest of the app. Importing them on demand (memoized) keeps ~tens of KB
// of key-derivation code out of the eager main bundle. Every consumer below is
// already async, so awaiting the load adds no UX cost.
let _cryptoPromise;
const loadCrypto = () =>
  (_cryptoPromise ||= Promise.all([
    import('@scure/bip39'),
    import('@scure/bip39/wordlists/english.js'),
    import('@noble/ed25519'),
  ]).then(([bip39, { wordlist }, ed]) => ({
    generateMnemonic: bip39.generateMnemonic,
    mnemonicToSeedSync: bip39.mnemonicToSeedSync,
    wordlist,
    ed,
  })));

// --- Lightweight in-memory cache (per page session) -------------------------
// Trending and the catalogue are global, slow-changing payloads. Without this,
// navigating away and back re-downloads them on every mount (the catalogue can
// be large). A short TTL keeps them fresh enough while removing the repeat
// fetches. Lives in module scope so it persists across component remounts.
const _memCache = new Map();
const MEM_TTL_MS = 5 * 60 * 1000; // 5 minutes

function memGet(key) {
  const hit = _memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiry) {
    _memCache.delete(key);
    return null;
  }
  return hit.data;
}

function memSet(key, data, ttlMs = MEM_TTL_MS) {
  _memCache.set(key, { data, expiry: Date.now() + ttlMs });
}

// --- User language / dub-sub preference -------------------------------------
// A purely client-side preference (stored in localStorage, exactly like the
// custom watchlists above) that biases which source auto-plays. It layers ON TOP
// of the global source priority: streams whose `language` tag matches the user's
// preferred language/type are ranked first, and WITHIN that matching tier the
// global source order (Cache > Voe > Jellyfin) still decides — so "Cache German
// Dub" still beats "Voe German Dub". With no preference set, every stream scores
// equal on language and pure source priority is restored (the original behaviour).
//
// localStorage is the synchronous cache the ranker reads; the choice is also
// synced to the account (see persistPlaybackPrefsRemote / syncPlaybackPrefsFromAccount)
// so it follows the user across devices. The sync is best-effort — if the backend
// is unreachable the local cache stays authoritative, so ranking never breaks.
const PLAYBACK_PREFS_KEY = 'crimson:playback-prefs';
// `discordPresence` opts the viewer into broadcasting a Discord Rich Presence
// (see discordPresence.js). It rides in the same client-preferences blob as the
// language/dub-sub choice so it persists locally AND syncs to the account exactly
// like them — one PUT carries all three.
const EMPTY_PLAYBACK_PREFS = { language: '', type: '', discordPresence: false, subtitleLanguages: [] };

// The languages/types offered in the settings UI. `value` is matched as a
// case-insensitive substring against the scraper's language tag ("German Dub",
// "English Sub", …), so it stays robust to minor label variations.
export const PREF_LANGUAGES = ['German', 'English', 'Japanese', 'Spanish', 'French', 'Italian'];
export const PREF_TYPES = ['Dub', 'Sub'];

// Languages offered for OpenSubtitles external subtitle tracks (player CC menu).
// `code` is the 2-letter code the backend passes to OpenSubtitles; `label` is what
// the settings UI shows. Distinct from PREF_LANGUAGES (which biases SOURCE choice
// by audio language) — these only pick which downloadable .vtt tracks to fetch.
export const SUBTITLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'pt-br', label: 'Portuguese (BR)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
];
const SUBTITLE_LANGUAGE_CODES = new Set(SUBTITLE_LANGUAGES.map((l) => l.code));

// Defensive sanitiser for the subtitle-language list: keep only known 2-letter
// codes, de-duped, capped — the value is round-tripped through the synced prefs
// blob and the URL, so we never trust it blindly.
function cleanSubtitleLanguages(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value) {
    const code = typeof v === 'string' ? v.trim().toLowerCase() : '';
    if (SUBTITLE_LANGUAGE_CODES.has(code) && !out.includes(code)) out.push(code);
    if (out.length >= 8) break;
  }
  return out;
}

export function getPlaybackPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAYBACK_PREFS_KEY) || '{}');
    return {
      language: typeof raw.language === 'string' ? raw.language : '',
      type: typeof raw.type === 'string' ? raw.type : '',
      discordPresence: typeof raw.discordPresence === 'boolean' ? raw.discordPresence : false,
      subtitleLanguages: cleanSubtitleLanguages(raw.subtitleLanguages),
    };
  } catch {
    return { ...EMPTY_PLAYBACK_PREFS };
  }
}

export function setPlaybackPrefs(prefs) {
  const clean = {
    language: typeof prefs?.language === 'string' ? prefs.language : '',
    type: typeof prefs?.type === 'string' ? prefs.type : '',
    discordPresence: typeof prefs?.discordPresence === 'boolean' ? prefs.discordPresence : false,
    subtitleLanguages: cleanSubtitleLanguages(prefs?.subtitleLanguages),
  };
  localStorage.setItem(PLAYBACK_PREFS_KEY, JSON.stringify(clean));
  // Broadcast so any open watch page / other tab can pick up the change live.
  window.dispatchEvent(new Event('crimson-playback-prefs'));
  return clean;
}

// Durably persist the preference to the account so it follows the user across
// devices. Fire-and-forget: the local cache (read by the ranker) is already
// updated, so a failed/offline write never blocks the UI — the next change or the
// next login re-syncs. Skipped when signed out (the PUT would just 401).
function persistPlaybackPrefsRemote(prefs) {
  if (!localStorage.getItem(SESSION_KEY)) return;
  apiFetch('/account/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  }).catch(() => {});
}

// Reconcile the account's server-side preference (from /account/me) with the local
// cache the stream ranker reads. The server is authoritative when it has a value
// (mirror it down so the choice follows the user to a fresh device); when it has
// none yet, push any existing local choice up so it becomes the account default —
// a one-time, silent migration for users who set a preference before this synced.
function syncPlaybackPrefsFromAccount(remote) {
  const r = remote && typeof remote === 'object' ? remote : {};
  // The account holds a value once any preference has ever been saved — note a
  // stored `discordPresence: false` still counts, so we don't clobber a deliberate
  // opt-out by pushing a stale local default back up.
  const hasRemote = r.language || r.type || typeof r.discordPresence === 'boolean' || Array.isArray(r.subtitleLanguages);
  if (hasRemote) {
    const next = {
      language: r.language || '',
      type: r.type || '',
      discordPresence: !!r.discordPresence,
      subtitleLanguages: cleanSubtitleLanguages(r.subtitleLanguages),
    };
    const local = getPlaybackPrefs();
    const subsChanged = local.subtitleLanguages.join(',') !== next.subtitleLanguages.join(',');
    if (local.language !== next.language || local.type !== next.type || local.discordPresence !== next.discordPresence || subsChanged) {
      setPlaybackPrefs(next);
    }
  } else {
    const local = getPlaybackPrefs();
    if (local.language || local.type || local.discordPresence || local.subtitleLanguages.length) persistPlaybackPrefsRemote(local);
  }
}

// Reactive accessor for the settings page. Returns [prefs, update] where update
// writes the local cache (read synchronously by the ranker), broadcasts to other
// tabs, and persists to the account. Hydration from the account happens in
// useProfile (always mounted), which broadcasts the same event this listens to.
export function usePlaybackPrefs() {
  const [prefs, setPrefs] = useState(getPlaybackPrefs);
  useEffect(() => {
    const sync = () => setPrefs(getPlaybackPrefs());
    window.addEventListener('crimson-playback-prefs', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-playback-prefs', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const update = useCallback((next) => {
    const clean = setPlaybackPrefs(next); // local cache + 'crimson-playback-prefs' event
    persistPlaybackPrefsRemote(clean);    // durable, cross-device (best-effort)
    return clean;
  }, []);
  return [prefs, update];
}

// Fetch OpenSubtitles tracks for a title from the backend (GET /subtitles), as
// `[{ url, lang, label }]` ready to merge into CrimsonPlayer's `subtitles` prop.
// `url` is absolutised to API_BASE_URL because the player's <track> loads it
// cross-origin (the backend is a separate origin). Best-effort: any error (incl.
// the 503 when OpenSubtitles isn't configured) resolves to [] so playback is never
// blocked by missing subtitles. Pass the SHOW's tmdb id for episodes.
export async function fetchSubtitles({ tmdbId, season = null, episode = null, isMovie = false, languages = [] } = {}) {
  const langs = cleanSubtitleLanguages(languages);
  if (!tmdbId || !langs.length) return [];
  const p = new URLSearchParams({ tmdb_id: String(tmdbId), languages: langs.join(',') });
  if (isMovie) p.set('is_movie', 'true');
  else {
    if (season != null) p.set('season', String(season));
    if (episode != null) p.set('episode', String(episode));
  }
  try {
    const res = await apiFetch(`/subtitles?${p.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const subs = Array.isArray(data?.subtitles) ? data.subtitles : [];
    return subs
      .filter((s) => s && s.url)
      .map((s) => ({
        url: s.url.startsWith('http') ? s.url : `${API_BASE_URL}${s.url}`,
        lang: s.lang,
        label: s.label || (s.lang || '').toUpperCase(),
      }));
  } catch {
    return [];
  }
}

// Fetch AniSkip intro/outro (OP/ED) skip timestamps for an anime episode from the
// backend (GET /skiptimes), as `{ op:{start,end}, ed:{start,end} }` (either may be
// null). AniList-keyed, so this is anime-only — non-anime titles have no
// `anilist_id` and the caller simply won't invoke it. Best-effort: any error, or a
// title/episode AniSkip has no submissions for, resolves to null so the player just
// shows no skip affordances.
export async function fetchSkipTimes({ anilistId, episode, episodeLength = 0 } = {}) {
  if (!anilistId || !episode) return null;
  const p = new URLSearchParams({ anilist_id: String(anilistId), episode: String(episode) });
  if (episodeLength) p.set('episode_length', String(Math.round(episodeLength)));
  try {
    const res = await apiFetch(`/skiptimes?${p.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.found) return null;
    return { op: data.op || null, ed: data.ed || null };
  } catch {
    return null;
  }
}

// --- Lite background (client-only performance preference) -------------------
// Disables the animated mesh background's motion/blur/layer-promotion in favour
// of a static gradient (see MeshBackground.jsx + .mesh-bg.is-lite in index.css).
// Deliberately a per-DEVICE choice kept in its own localStorage key — NOT folded
// into the account-synced playback-prefs blob: a weak phone and a desktop want
// different answers, and keeping it local means it never touches the
// /account/preferences contract. Mirrors the playback-prefs event pattern so the
// background (mounted high in the tree) reacts the instant the toggle flips.
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

// --- Reactive session token -------------------------------------------------
// The session token lives in localStorage, which isn't reactive. useAuth and
// useAccount are independent hook instances, so a login/logout in one wouldn't
// update the others without a remount. We bridge them with a window event:
// auth mutations go through setAuthStorage (which dispatches 'crimson-auth'),
// and every useSessionToken subscriber re-reads — so all instances stay in sync
// within the tab (and across tabs via the native 'storage' event).
const SESSION_KEY = 'crimson_session';
const PUBKEY_KEY = 'crimson_public_key';

function setAuthStorage(sessionToken, publicKey) {
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
function extractError(data, fallback = 'Something went wrong') {
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

export function useAuth() {
  // Reactive across all hook instances in the tab (see useSessionToken).
  const sessionToken = useSessionToken();
  const [publicKey, setPublicKey] = useState(() => localStorage.getItem(PUBKEY_KEY));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep publicKey in sync when auth changes in another hook instance / tab.
  useEffect(() => {
    const sync = () => setPublicKey(localStorage.getItem(PUBKEY_KEY));
    window.addEventListener('crimson-auth', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-auth', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const isAuthenticated = !!sessionToken;

  const deriveKeypair = async (mnemonic) => {
    const { mnemonicToSeedSync, ed } = await loadCrypto();
    const seed = mnemonicToSeedSync(mnemonic).slice(0, 32);
    const pubKeyArr = await ed.getPublicKeyAsync(seed);
    const pubKeyHex = toHex(pubKeyArr);
    return { seed, publicKey: pubKeyHex };
  };

  // Get a one-time challenge for this key and sign it with the private seed —
  // the shared first half of both mnemonic login and registration.
  const challengeAndSign = async (pubKey, seed) => {
    const { ed } = await loadCrypto();
    const challRes = await fetch(`${API_BASE_URL}/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: pubKey })
    });
    if (!challRes.ok) throw new Error('Failed to get auth challenge');
    const { challenge } = await challRes.json();
    const signatureArr = await ed.signAsync(new TextEncoder().encode(challenge), seed);
    return { challenge, signature: toHex(signatureArr) };
  };

  // Sign in to an EXISTING mnemonic account. No invite code: creating new
  // accounts is a separate, invite-gated step (registerMnemonic) so a freshly
  // generated mnemonic can't bypass the invite system. A 404 here means "no such
  // account yet" — the UI steers the user to the create-identity flow.
  const login = async (mnemonic) => {
    setLoading(true);
    setError(null);
    try {
      const { seed, publicKey: pubKey } = await deriveKeypair(mnemonic);
      const { challenge, signature } = await challengeAndSign(pubKey, seed);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: pubKey, challenge, signature })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractError(
          data,
          res.status === 404 ? 'No account for this mnemonic — create a new identity instead.' : 'Authentication failed',
        ));
      }
      const { session_token } = await res.json();
      // Persist + broadcast: updates this hook (via the event) and every other
      // useAuth / useAccount instance in the tab.
      setAuthStorage(session_token, pubKey);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Create a NEW mnemonic account. Invite-gated exactly like email signup: the
  // backend /auth/register now requires a valid invite_code, so this is the only
  // way to mint a mnemonic account and it can't sidestep the invite gate.
  const registerMnemonic = async (mnemonic, inviteCode) => {
    setLoading(true);
    setError(null);
    try {
      const { seed, publicKey: pubKey } = await deriveKeypair(mnemonic);
      const { challenge, signature } = await challengeAndSign(pubKey, seed);

      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: pubKey, challenge, signature, invite_code: inviteCode })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractError(
          data,
          res.status === 409 ? 'This mnemonic is already registered — sign in instead.' : 'Registration failed',
        ));
      }
      const { session_token } = await res.json();
      setAuthStorage(session_token, pubKey);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (sessionToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
      } catch (e) {
        console.error("Logout error:", e);
      }
    }
    setAuthStorage(null, null);
  };

  const createNewMnemonic = async () => {
    const { generateMnemonic, wordlist } = await loadCrypto();
    return generateMnemonic(wordlist);
  };

  // --- email + password auth ------------------------------------------------
  const emailLogin = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/email/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = extractError(data, 'Login failed');
        setError(err);
        // 403 == account exists but email isn't verified yet.
        return { ok: false, error: err, needsVerification: res.status === 403 };
      }
      setAuthStorage(data.session_token, null);
      return { ok: true };
    } catch (e) {
      setError(e.message);
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  const emailRegister = async (email, password, inviteCode) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/email/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, invite_code: inviteCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = extractError(data, 'Registration failed');
        setError(err);
        return { ok: false, error: err };
      }
      // Demo instances auto-verify and return a session straight away — store it so
      // the user is signed in without the email round-trip.
      if (data.session_token) setAuthStorage(data.session_token, null);
      return {
        ok: true,
        message: data.message,
        requiresVerification: data.requires_verification,
        session: !!data.session_token,
      };
    } catch (e) {
      setError(e.message);
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  // Used by the /verify page: confirms the email and (server-side) returns a
  // session so the user lands logged straight in.
  const verifyEmail = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: extractError(data, 'Verification failed') };
      if (data.session_token) setAuthStorage(data.session_token, null);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const resendVerification = async (email) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/email/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, message: data.message };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/email/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, message: data.message };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const resetPassword = async (token, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/email/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: extractError(data, 'Reset failed') };
      return { ok: true, message: data.message };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  return {
    sessionToken,
    publicKey,
    isAuthenticated,
    loading,
    error,
    setError,
    login,
    registerMnemonic,
    logout,
    createNewMnemonic,
    emailLogin,
    emailRegister,
    verifyEmail,
    resendVerification,
    requestPasswordReset,
    resetPassword,
  };
}

// The default list every account has (the original single "Favorites" tab). Any
// other list_name is a user-made watchlist (e.g. "Todo", "Done", "Paused").
export const DEFAULT_LIST = 'favorites';
// A virtual, read-only list surfaced only on the Watchlists page: the
// de-duplicated union of every list's shows. It is NOT a real list_name and is
// never sent to the server — keep it out of the hook's `lists` so it can't show
// up as an "add to list" target in WatchlistButton.
export const ALL_LIST = '__all__';
const CUSTOM_LISTS_KEY = 'crimson:watchlists';

// Human label for a list name — the default list reads as "Favorites", the
// virtual aggregate reads as "All".
export const listLabel = (name) =>
  name === DEFAULT_LIST ? 'Favorites' : name === ALL_LIST ? 'All' : name;

const loadCustomLists = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_LISTS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(n => typeof n === 'string') : [];
  } catch {
    return [];
  }
};
const saveCustomLists = (names) =>
  localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(names));

// True when a stored favorite row refers to the same show as `item`. Mirrors the
// backend dedup key (account_engine/routes.py:_favorite_item_key): AniList id is
// preferred, otherwise it's a TMDB-only row.
const rowMatchesItem = (row, item) => {
  if (item.anilist_id != null) return row.anilist_id === item.anilist_id;
  if (item.tmdb_id != null) {
    // Movies share the TMDB id space with shows, so a movie favorite must only
    // match movie rows (and vice-versa) — mirrors the backend's movie: namespace.
    if (item.media_type === 'movie') return String(row.tmdb_id) === String(item.tmdb_id) && row.media_type === 'movie';
    return String(row.tmdb_id) === String(item.tmdb_id) && row.anilist_id == null && row.media_type !== 'movie';
  }
  return false;
};

// Query params identifying one show for the DELETE endpoint (AniList preferred).
const itemQuery = (item, listName) => {
  const p = new URLSearchParams();
  if (item.anilist_id != null) p.set('anilist_id', item.anilist_id);
  else if (item.tmdb_id != null) {
    p.set('tmdb_id', item.tmdb_id);
    if (item.media_type === 'movie') p.set('media_type', 'movie');
  }
  if (listName != null) p.set('list_name', listName);
  return p;
};

// Watchlists data layer. Lighter than useAccount (no profile/history fetches), so
// it's cheap to mount inside the per-show "add to list" button as well as the
// Watchlists page. Empty lists (created but not yet populated) live in
// localStorage, since the server only knows a list once it has ≥1 item.
export function useWatchlists() {
  const sessionToken = useSessionToken();
  const [items, setItems] = useState([]);        // every favorite row, all lists
  const [serverLists, setServerLists] = useState([]); // [{list_name, count}]
  const [customLists, setCustomLists] = useState(loadCustomLists);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionToken) { setItems([]); setServerLists([]); return; }
    setLoading(true);
    try {
      const [favRes, listRes] = await Promise.all([
        apiFetch(`/account/favorites`),
        apiFetch(`/account/watchlists`),
      ]);
      if (favRes.ok) setItems((await favRes.json()).favorites || []);
      if (listRes.ok) setServerLists((await listRes.json()).watchlists || []);
    } catch (e) {
      console.error("Watchlists fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { refresh(); }, [refresh]);

  // Union of the default list, server lists (with counts) and any empty
  // client-side lists, ordered with "Favorites" first then alphabetical.
  const lists = useMemo(() => {
    const map = new Map();
    map.set(DEFAULT_LIST, { name: DEFAULT_LIST, count: 0 });
    customLists.forEach(n => { if (!map.has(n)) map.set(n, { name: n, count: 0 }); });
    serverLists.forEach(l => map.set(l.list_name, { name: l.list_name, count: l.count }));
    return Array.from(map.values()).sort((a, b) => {
      if (a.name === DEFAULT_LIST) return -1;
      if (b.name === DEFAULT_LIST) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [serverLists, customLists]);

  // Names of the lists a given show currently belongs to.
  const listsForItem = useCallback(
    (item) => items.filter(r => rowMatchesItem(r, item)).map(r => r.list_name),
    [items]
  );

  const addToList = useCallback(async (item, listName) => {
    if (!sessionToken) return false;
    try {
      const res = await apiFetch(`/account/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: item.tmdb_id ?? null,
          anilist_id: item.anilist_id ?? null,
          media_type: item.media_type ?? null,
          title: item.title || item.name,
          poster: item.poster,
          list_name: listName,
        }),
      });
      if (res.ok) { await refresh(); return true; }
    } catch (e) {
      console.error("Add to list error:", e);
    }
    return false;
  }, [sessionToken, refresh]);

  const removeFromList = useCallback(async (item, listName) => {
    if (!sessionToken) return false;
    try {
      const res = await apiFetch(`/account/favorites?${itemQuery(item, listName)}`, {
        method: 'DELETE',
      });
      if (res.ok) { await refresh(); return true; }
    } catch (e) {
      console.error("Remove from list error:", e);
    }
    return false;
  }, [sessionToken, refresh]);

  const toggleInList = useCallback(async (item, listName) => {
    const inList = items.some(r => rowMatchesItem(r, item) && r.list_name === listName);
    return inList ? removeFromList(item, listName) : addToList(item, listName);
  }, [items, addToList, removeFromList]);

  // Create an (initially empty) list. Persists client-side until it gets items.
  const createList = useCallback((name) => {
    const clean = (name || '').trim().slice(0, 100);
    if (!clean || clean === DEFAULT_LIST) return false;
    setCustomLists(prev => {
      if (prev.includes(clean)) return prev;
      const next = [...prev, clean];
      saveCustomLists(next);
      return next;
    });
    return true;
  }, []);

  // Remove a whole list: delete its server rows, then drop the client entry. The
  // default list can be emptied but not removed.
  const deleteList = useCallback(async (name) => {
    if (name === DEFAULT_LIST) return false;
    const rows = items.filter(r => r.list_name === name);
    await Promise.all(rows.map(r =>
      apiFetch(`/account/favorites?${itemQuery(r, name)}`, { method: 'DELETE' }).catch(() => {})
    ));
    setCustomLists(prev => {
      const next = prev.filter(n => n !== name);
      saveCustomLists(next);
      return next;
    });
    await refresh();
    return true;
  }, [items, refresh]);

  // Download every watchlist as one file. `format` is 'csv' (spreadsheet-friendly,
  // default) or 'json' (a round-trippable backup). The export is auth-gated, so we
  // fetch it through apiFetch (which attaches the bearer token) and trigger the
  // save from the resulting blob — a plain <a download> wouldn't carry the token.
  const exportWatchlists = useCallback(async (format = 'csv') => {
    if (!sessionToken) return false;
    try {
      const res = await apiFetch(`/account/favorites/export?format=${format}`);
      if (!res.ok) return false;
      const blob = await res.blob();
      // Honour the server's filename (Content-Disposition) when present.
      const disp = res.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `crimson-watchlists.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('Export watchlists error:', e);
      return false;
    }
  }, [sessionToken]);

  // Restore watchlists from an exported CSV/JSON file. The file is sent as the
  // raw request body (the backend sniffs CSV vs JSON from the content). `mode` is
  // 'merge' (default — add to existing lists) or 'replace' (wipe all lists first).
  // Resolves to the server's summary ({ imported, skipped, total, ... }) so the
  // UI can report what happened; refreshes so imported lists/items show at once.
  const importWatchlists = useCallback(async (file, mode = 'merge') => {
    if (!sessionToken) return { ok: false, error: 'You need to be signed in.' };
    if (!file) return { ok: false, error: 'No file selected.' };
    try {
      const text = await file.text();
      const isJson = (file.name || '').toLowerCase().endsWith('.json');
      const res = await apiFetch(`/account/favorites/import?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': isJson ? 'application/json' : 'text/csv' },
        body: text,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.detail || 'Import failed.' };
      await refresh();
      return { ok: true, ...data };
    } catch (e) {
      console.error('Import watchlists error:', e);
      return { ok: false, error: e.message || 'Import failed.' };
    }
  }, [sessionToken, refresh]);

  return {
    items, lists, loading,
    listsForItem, addToList, removeFromList, toggleInList,
    createList, deleteList, exportWatchlists, importWatchlists,
    refresh,
  };
}

// Profile + watch-history layer. Watchlists are intentionally NOT fetched here —
// they live in useWatchlists() (used by the Watchlists page and the per-show
// WatchlistButton), so watch/account pages don't pay for an unused fetch.
export function useAccount() {
  const [profile, setProfile] = useState(null);
  const [continueWatching, setContinueWatching] = useState([]);
  const [recentlyWatched, setRecentlyWatched] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reactive: re-runs the fetch effect when the user logs in/out (see useAuth).
  const sessionToken = useSessionToken();

  const fetchProfile = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await apiFetch(`/account/me`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  }, [sessionToken]);

  const fetchContinueWatching = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/account/continue-watching`);
      if (res.ok) {
        const data = await res.json();
        setContinueWatching(data.items || []);
      }
    } catch (e) {
      console.error("Continue watching fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  const fetchRecent = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      // Pull the full history (server caps at 100) so the History page's search
      // and filters operate over everything, not just the latest handful.
      const res = await apiFetch(`/account/recent?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setRecentlyWatched(data.items || []);
      }
    } catch (e) {
      console.error("Recent fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  // Remove a show from watch history entirely. The history is collapsed to one
  // card per show, but a show can have many episode-level progress rows — so we
  // fetch the full progress list and delete every row for this show, otherwise it
  // would just reappear carrying an older episode. Optimistically drops it from
  // the visible list first for a snappy feel.
  const removeFromHistory = useCallback(async (item) => {
    if (!sessionToken) return false;
    const matches = (r) => {
      if (item.anilist_id != null) return String(r.anilist_id) === String(item.anilist_id);
      if (item.media_type === 'movie') return String(r.tmdb_id) === String(item.tmdb_id) && r.media_type === 'movie';
      return String(r.tmdb_id) === String(item.tmdb_id) && r.anilist_id == null && r.media_type !== 'movie';
    };
    setRecentlyWatched(prev => prev.filter(r => !matches(r)));
    try {
      const res = await apiFetch(`/account/progress`);
      const rows = res.ok ? ((await res.json()).progress || []) : [];
      const targets = rows.filter(matches);
      await Promise.all(targets.map(r =>
        apiFetch(`/account/progress?item_key=${encodeURIComponent(r.item_key)}`, { method: 'DELETE' }).catch(() => {})
      ));
      return true;
    } catch (e) {
      console.error("Remove from history error:", e);
      // Re-sync so the optimistic removal doesn't desync from the server.
      fetchRecent();
      return false;
    }
  }, [sessionToken, fetchRecent]);


  // useCallback so the reference is stable across renders: the watch page keys a
  // periodic-save effect on this, and an unstable identity would re-run that
  // effect every render (redundant POSTs + losing the tracked playback position).
  const updateProgress = useCallback(async (progressData) => {
    if (!sessionToken) return;
    try {
      await apiFetch(`/account/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      });
    } catch (e) {
      console.error("Progress update error:", e);
    }
  }, [sessionToken]);

  // Saved playback position for one specific episode, so the watch page can seek
  // the player to where the user left off ("resume"). Returns the position in
  // seconds, or null when there's nothing meaningful to resume to — no row, a
  // finished episode, a position right at the start, or one within the last few
  // seconds of the runtime (treat those as "done", start fresh).
  const fetchResumePosition = useCallback(async (anilistId, season, episode) => {
    if (!sessionToken) return null;
    try {
      const res = await apiFetch(`/account/progress`);
      if (!res.ok) return null;
      const data = await res.json();
      const row = (data.progress || []).find(p =>
        String(p.anilist_id) === String(anilistId) &&
        Number(p.season_number) === Number(season) &&
        Number(p.episode_number) === Number(episode)
      );
      if (!row || row.status === 'completed') return null;
      const pos = row.position_seconds || 0;
      const dur = row.duration_seconds || 0;
      if (pos < 5) return null;
      if (dur && pos > dur - 15) return null;
      return pos;
    } catch (e) {
      console.error("Resume position fetch error:", e);
      return null;
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken) {
      fetchProfile();
      fetchContinueWatching();
      fetchRecent();
    }
  }, [sessionToken, fetchProfile, fetchContinueWatching, fetchRecent]);

  return {
    profile,
    continueWatching,
    recentlyWatched,
    loading,
    updateProgress,
    fetchResumePosition,
    removeFromHistory,
    refreshContinueWatching: fetchContinueWatching,
    refreshRecent: fetchRecent
  };
}

export function useAnimeStreamer(externalProps = {}) {
  // Search & Autocomplete state
  const [queryName, setQueryName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Trackers
  const [selectedAnilistId, setSelectedAnilistId] = useState(null);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  
  // Mirror of the streams array (so we can pick the best source synchronously as
  // each one arrives) + whether the user has manually chosen a source (so an
  // auto-upgrade to a preferred source never overrides an explicit pick).
  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);

  // Manual source selection from the sidebar — pins the choice so later-arriving
  // preferred sources don't yank it away.
  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);


  // Multi-season support
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [seasonGroups, setSeasonGroups] = useState(null);
  const [currentSeasonAnilistId, setCurrentSeasonAnilistId] = useState(null);

  // Dynamic state loaders
  const [animeMetadata, setAnimeMetadata] = useState(null);
  const [streamData, setStreamData] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  // Set (to { airDate }) when the backend reports the episode hasn't aired yet, so
  // the watch UI shows a "not yet aired" notice instead of resolving zero sources.
  const [unaired, setUnaired] = useState(null);

  // Bumping this re-runs the stream-resolution effect (a manual "rescan sources"),
  // re-resolving the current episode from scratch — for when every source is dead.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

  // ---------- Helper: fetch search suggestions ----------
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3) return;
    try {
      const res = await apiFetch(`/search/anime?query_name=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Failed to fetch search suggestions. HTTP Status: ${res.status}`);
      const data = await res.json();

      if (data && Array.isArray(data.suggestions)) {
        setSearchResults(data.suggestions);
      } else if (Array.isArray(data)) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      console.error("Search suggestion fetch failed:", e);
      setSearchResults([]);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    if (queryName.trim().length >= 3) {
      const delayDebounceFn = setTimeout(() => {
        fetchSuggestions(queryName);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  }, [queryName, fetchSuggestions]);

  // ---------- Helper: fetch available seasons for an anime ----------
const fetchAvailableSeasons = useCallback(async (anilistId) => {
    try {
        const res = await apiFetch(`/seasons/${anilistId}`);
        if (!res.ok) throw new Error('Failed to fetch season information');
        const data = await res.json();
        
        if (data.success && data.seasons) {
            setAvailableSeasons(data.seasons);
            let title = data.title;
            // If title is missing or "Unknown Anime", try to get it from first season's metadata
            if ((!title || title === "Unknown Anime") && data.seasons.length > 0) {
                const firstSeason = data.seasons[0];
                const metaRes = await apiFetch(`/info/${firstSeason.tmdb_id}?season=${firstSeason.tmdb_season}`);
                if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    title = metaData.title;
                }
            }
            setSeasonGroups({
                title: title || 'Unknown Anime',
                totalSeasons: data.total_seasons
            });
            return data.seasons;
        }
        return [];
    } catch (err) {
        console.error("Season fetch error:", err);
        setApiError('Could not load season information');
        return [];
    }
}, []);

  // ---------- Core: initialise everything from anilistId, season, episode ----------
  const initializeFromIds = useCallback(async (anilistId, seasonNumber = 1, episodeNumber = 1) => {
    setMetaLoading(true);
    setApiError(null);
    setAnimeMetadata(null);
    setAvailableSeasons([]);
    setStreamData(null);

    try {
      // 1. Fetch available seasons
      const seasons = await fetchAvailableSeasons(anilistId);
      
      // 2. Find the requested season (or fallback to first)
      let targetSeason = seasons.find(s => s.season_number === seasonNumber);
      if (!targetSeason && seasons.length) targetSeason = seasons[0];
      if (!targetSeason) throw new Error('No season data found for this anime');

      // An anilist_id that matches none of the numbered seasons is an extra
      // (special/OVA/movie). Those have no TMDB season, so we stream them
      // directly through the 2-segment /watch/{anilist_id}/{episode} route by
      // pinning selectedAnilistId to the requested id (the show's numbered
      // seasons are still shown for metadata/context).
      const requestedId = parseInt(anilistId);
      const isExtra = seasons.length > 0 && !seasons.some(s => s.anilist_id === requestedId);

      // 3. Fetch metadata for that season using tmdb_id + tmdb_season
      const res = await apiFetch(`/info/${targetSeason.tmdb_id}?season=${targetSeason.tmdb_season}`);
      if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
      const data = await res.json();

      setAnimeMetadata(data);
      if (isExtra) {
        setSelectedAnilistId(requestedId);
        setCurrentSeasonAnilistId(null);
      } else {
        setSelectedAnilistId(targetSeason.anilist_id);
        setCurrentSeasonAnilistId(targetSeason.anilist_id);
      }
      setCurrentSeason(targetSeason.season_number);
      setCurrentEpisode(episodeNumber);
      
    } catch (err) {
      console.error("Initialization error:", err);
      setApiError(err.message || 'Failed to load anime data');
    } finally {
      setMetaLoading(false);
    }
  }, [fetchAvailableSeasons]);

  // If external initial props are provided, run initialisation once on mount
  useEffect(() => {
    if (externalProps.initialAnilistId) {
      initializeFromIds(
        externalProps.initialAnilistId,
        externalProps.initialSeason || 1,
        externalProps.initialEpisode || 1
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount, externalProps changes are ignored intentionally

  // ---------- Handle selection from search or trending (router-aware) ----------
  const handleSelectSuggestion = async (suggestion, navigateCallback) => {
    const displayTitle = suggestion.title || suggestion.name || "Selected Anime";
    setQueryName(displayTitle);
    setShowSuggestions(false);

    const anilistId = suggestion.anilist_id;
    if (!anilistId) {
      setApiError('Selection failed: No AniList ID found.');
      return;
    }

    try {
      const seasons = await fetchAvailableSeasons(anilistId);
      const firstSeason = seasons?.[0]?.season_number || 1;
      if (navigateCallback) {
        navigateCallback(anilistId, firstSeason, 1);
      }
    } catch (err) {
      setApiError('Could not load season information for this anime.');
    }
  };

  // ---------- Update season manually (used by watch page) ----------
  const updateSeason = useCallback(async (seasonNumber) => {
    if (!availableSeasons.length) return;
    
    const selectedSeason = availableSeasons.find(s => s.season_number === seasonNumber);
    if (!selectedSeason) return;
    
    setCurrentSeason(seasonNumber);
    setCurrentSeasonAnilistId(selectedSeason.anilist_id);
    setCurrentEpisode(1);
    setMetaLoading(true);
    
    try {
      const res = await apiFetch(`/info/${selectedSeason.tmdb_id}?season=${selectedSeason.tmdb_season}`);
      if (res.ok) {
        const data = await res.json();
        setAnimeMetadata(data);
        setSelectedAnilistId(selectedSeason.anilist_id);
      } else {
        throw new Error('Season metadata fetch failed');
      }
    } catch (err) {
      console.error("Season update error:", err);
      setApiError('Failed to load season data');
    } finally {
      setMetaLoading(false);
    }
  }, [availableSeasons]);

  // NOTE: metadata for a season is fetched by initializeFromIds (on mount / URL
  // change) and by updateSeason (when the user switches season). A previous
  // effect here re-fetched /info on every currentSeason change too, which simply
  // duplicated those requests — removed so each season switch hits /info once.

  // ---------- Stream sources progressively (NDJSON) when anilistId + episode changes ----------
  // The backend now streams one JSON object per line: a `meta` line first, then a
  // `stream` line the instant each scraper resolves, then a final `done` line.
  // We read the body incrementally and append sources as they land instead of
  // waiting for a single aggregated JSON blob.
  useEffect(() => {
    const anilistIdToUse = currentSeasonAnilistId || selectedAnilistId;
    if (!anilistIdToUse) return;

    const controller = new AbortController();

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0);
    setUnaired(null);
    streamsRef.current = [];
    userPickedRef.current = false;

    // When the client engine is on, an anime source may resolve both locally and on
    // the backend. Dedup by (source, language) and PREFER the local line: it streams
    // straight from the CDN (token minted from the viewer's own ASN), so it
    // supersedes a backend duplicate even if the backend arrived first. Guarded by
    // clientSourcesEnabled() so default behavior is untouched when the engine is off.
    //   key -> { idx, origin: 'local' | 'backend' }
    const dedup = new Map();

    const handleLine = (line, origin = 'backend') => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        console.warn('Skipping malformed stream line:', trimmed);
        return;
      }

      if (msg.type === 'unaired') {
        // Episode is dated in the future — no scraping happened server-side. Show
        // the "coming soon" state instead of an empty sources list.
        setUnaired({ airDate: msg.air_date });
        setStreamLoading(false);
      } else if (msg.type === 'meta') {
        // Initialise the container as soon as metadata flushes (before any scraper).
        setStreamData((prev) => ({ ...(prev || {}), ...msg, streams: prev?.streams || [] }));
      } else if (msg.type === 'stream') {
        // Normalise `streamType` -> `type` so the existing player/sidebar rendering
        // keeps working unchanged. `language`/`subtitles`/`cacheTicket` are optional
        // (only some scrapers supply them) and stay undefined otherwise.
        const incoming = { source: msg.source, type: msg.streamType, url: msg.url, language: msg.language, subtitles: msg.subtitles, cacheTicket: msg.cacheTicket };

        // Auto-select the most preferred source available unless the user has
        // already picked one manually. Ranking honours the viewer's language/
        // dub-sub preference first, then the global source order (see streamRank).
        const reselect = () => {
          if (userPickedRef.current) return;
          const prefs = getPlaybackPrefs();
          let bestIdx = 0, bestRank = Infinity;
          streamsRef.current.forEach((s, i) => {
            const r = streamRank(s, prefs);
            if (r < bestRank) { bestRank = r; bestIdx = i; }
          });
          setActiveStreamIdx(bestIdx);
        };

        if (clientSourcesEnabled()) {
          const key = `${msg.source}|${msg.language || ''}`;
          const prior = dedup.get(key);
          if (prior) {
            // A local line replaces an earlier backend one (in place); a backend
            // line never displaces a local one, and same-origin dupes are dropped.
            if (origin === 'local' && prior.origin !== 'local') {
              const swapped = streamsRef.current.slice();
              swapped[prior.idx] = incoming;
              streamsRef.current = swapped;
              dedup.set(key, { idx: prior.idx, origin });
              setStreamData((prev) => ({ ...(prev || {}), streams: swapped }));
              reselect();
            }
            return;
          }
          dedup.set(key, { idx: streamsRef.current.length, origin });
        }

        const next = [...streamsRef.current, incoming];
        streamsRef.current = next;
        setStreamData((prev) => ({ ...(prev || {}), streams: next }));
        reselect();
        // First playable source is in — drop the loading veil so it renders immediately.
        setStreamLoading(false);
      } else if (msg.type === 'done') {
        setStreamLoading(false);
      }
    };

    const consumeStream = async () => {
      try {
        const res = await apiFetch(`/watch/${anilistIdToUse}/${currentEpisode}`, {
          signal: controller.signal,
          headers: { Accept: 'application/x-ndjson' },
        });
        if (!res.ok || !res.body) throw new Error('Could not resolve streaming sources.');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx;
          while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            handleLine(line);
          }
        }
        // Flush any trailing line that wasn't newline-terminated.
        if (buffer.trim()) handleLine(buffer);

        setStreamLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return; // Superseded by a newer episode/season selection.
        console.error('Stream fetch error:', err);
        setStreamLoading(false);
        setApiError('Failed to load streaming sources');
      }
    };

    // E3/E2 client-side resolution for anime (no-op unless opted in via the
    // companion + flag). Runs alongside the backend stream and feeds the SAME
    // handleLine, so a locally-resolved anime source (VOE/AniWorld/S.to, minted from
    // the viewer's own ASN) supersedes the backend duplicate. The backend stays the
    // floor (E0). The engine's discovery sources match by title + synonyms +
    // anilistId; tmdbId/season let enrichMediaCtx pull the AniList title set from
    // the backend /scrape-meta grant exactly as the backend scrapers do.
    const seasonRec =
      availableSeasons.find((s) => s.anilist_id === anilistIdToUse) ||
      availableSeasons.find((s) => s.season_number === currentSeason);
    const mediaCtx = {
      tmdbId: seasonRec?.tmdb_id,
      mediaType: 'tv',
      season: seasonRec?.tmdb_season ?? null,
      episode: currentEpisode,
      title: animeMetadata?.title || seasonGroups?.title || undefined,
      anilistId: anilistIdToUse,
    };

    (async () => {
      const local = streamLocalSources(mediaCtx, {
        signal: controller.signal,
        onLine: (s) => handleLine(s, 'local'),
      });
      await consumeStream();
      await local;
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeasonAnilistId, selectedAnilistId, currentEpisode, reloadNonce]);

  return {
    // search & suggestions
    queryName, setQueryName,
    searchResults, showSuggestions, setShowSuggestions,
    metaLoading, apiError, setApiError,
    
    // season & episode
    currentSeason, setCurrentSeason: updateSeason,
    currentEpisode, setCurrentEpisode,
    activeStreamIdx, setActiveStreamIdx: selectStream,   
    
    // data
    animeMetadata, streamData, streamLoading,
    availableSeasons, seasonGroups,
    unaired,

    // actions
    handleSelectSuggestion,
    initializeFromIds,
    reloadStreams,
  };
}

// --- Per-anime overview page -------------------------------------------------
// Fetches the aggregated /overview payload (show metadata + season list + extras)
// in one round-trip, then lazily loads the episode list for whichever season is
// active via /info (so we don't pull every season's episodes up front). Episode
// lists are memoised per (tmdb_id, season) so flipping back to a season is
// instant. This is what powers the new Overview page that sits between picking a
// show and actually watching an episode.
export function useAnimeOverview(anilistId) {
  const [overview, setOverview] = useState(() => (anilistId ? memGet(`overview:${anilistId}`) : null));
  const [loading, setLoading] = useState(() => !(anilistId && memGet(`overview:${anilistId}`)));
  const [error, setError] = useState(null);

  // Active season + its episodes.
  const [activeSeason, setActiveSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const episodeCache = useRef(new Map());

  // Load the show overview shell.
  useEffect(() => {
    if (!anilistId) return;
    const cached = memGet(`overview:${anilistId}`);
    if (cached) {
      setOverview(cached);
      setActiveSeason(cached.seasons?.[0]?.season_number ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(`/overview/${anilistId}`);
        if (!res.ok) throw new Error(`Failed to load overview (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`overview:${anilistId}`, data);
        setActiveSeason(data.seasons?.[0]?.season_number ?? null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [anilistId]);

  // Load episodes for the active season (lazily, cached per season).
  useEffect(() => {
    if (!overview || activeSeason == null) return;
    const season = overview.seasons?.find(s => s.season_number === activeSeason);
    if (!season) { setEpisodes([]); return; }

    const cacheKey = `${season.tmdb_id}:${season.tmdb_season}`;
    if (episodeCache.current.has(cacheKey)) {
      setEpisodes(episodeCache.current.get(cacheKey));
      return;
    }

    let cancelled = false;
    setEpisodesLoading(true);
    setEpisodes([]);
    (async () => {
      try {
        const res = await apiFetch(`/info/${season.tmdb_id}?season=${season.tmdb_season}`);
        if (!res.ok) throw new Error(`Failed to load episodes (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data.episodes_list) ? data.episodes_list : [];
        episodeCache.current.set(cacheKey, list);
        setEpisodes(list);
      } catch (e) {
        if (!cancelled) { console.error('Episode list fetch failed:', e); setEpisodes([]); }
      } finally {
        if (!cancelled) setEpisodesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [overview, activeSeason]);

  return {
    overview, loading, error,
    activeSeason, setActiveSeason,
    episodes, episodesLoading,
  };
}

export function useTrendingAnime() {
  // Seed from the in-memory cache so a remount within the TTL paints instantly
  // and skips the fetch (no setState in the effect body).
  const [trendingAnimes, setTrendingAnimes] = useState(() => memGet('trending') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending'));

  useEffect(() => {
    if (memGet('trending')) return; // already seeded from cache
    const fetchTrending = async () => {
      setTrendLoading(true);
      try {
        const res = await apiFetch(`/trending`);
        if (!res.ok) throw new Error('Failed to fetch trending data.');
        const data = await res.json();
        if (data.success && Array.isArray(data.animes)) {
          setTrendingAnimes(data.animes);
          memSet('trending', data.animes);
        }
      } catch (e) {
        console.error('Error fetching trending anime:', e);
      } finally {
        setTrendLoading(false);
      }
    };
    fetchTrending();
  }, []);

  return { trendingAnimes, trendLoading };
}

export function useHealthStatus() {
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);

  useEffect(() => {
    apiFetch(`/health`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch(e => setHealthError(e.message))
      .finally(() => setHealthLoading(false));
  }, []);

  return { health, healthLoading, healthError };
}

export function useCatalogue() {
  // Seed from the in-memory cache so a remount within the TTL paints instantly
  // and skips the fetch (no setState in the effect body).
  const [catalogue, setCatalogue] = useState(() => memGet('catalogue') || { animes: [], categories: [], genres: [], total: 0 });
  const [loading, setLoading] = useState(() => !memGet('catalogue'));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (memGet('catalogue')) return; // already seeded from cache
    const fetchCatalogue = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/catalogue`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          const next = {
            animes: data.animes || [],
            categories: data.categories || [],
            genres: data.genres || [],
            total: data.total || 0
          };
          setCatalogue(next);
          memSet('catalogue', next);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalogue();
  }, []);

  return { catalogue, loading, error };
}

export function useTitle(title) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} | Crimsonhaven` : 'Crimsonhaven | Your Anime Sanctuary';
    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}

// --- Non-anime TV shows (secondary surface) ---------------------------------
// These mirror the anime hooks above but key off tmdb_id and the TMDB-keyed
// backend endpoints (/search/shows, /trending/shows, /show-overview, and the
// existing /info + 3-segment /watch). The anime hooks are deliberately left
// untouched — shows are a separate, parallel surface so anime stays priority 1.

// Reads one /watch NDJSON stream, invoking onLine for each JSON line. Shared by
// the show streamer (the anime streamer keeps its own inline copy unchanged).
async function streamWatchNdjson(path, { signal, onLine }) {
  const res = await apiFetch(path, { signal, headers: { Accept: 'application/x-ndjson' } });
  if (!res.ok || !res.body) throw new Error('Could not resolve streaming sources.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      onLine(line);
    }
  }
  if (buffer.trim()) onLine(buffer); // trailing, non-newline-terminated line
}

// Unified search for the landing page: queries the anime AND show endpoints in
// parallel and returns a merged suggestion list with anime FIRST (priority 1),
// each item tagged with `kind` ('anime' | 'show') so the UI can route it to the
// right overview page. Replaces the search half of useAnimeStreamer on the
// landing page (which never used the streaming half there).
export function useUnifiedSearch() {
  const [queryName, setQueryName] = useState('');
  const [results, setResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3) return;
    try {
      const [animeRes, showRes, movieRes] = await Promise.all([
        apiFetch(`/search/anime?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/search/shows?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/search/movies?query_name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const anime = (animeRes?.suggestions || []).map(s => ({ ...s, kind: 'anime' }));
      const shows = (showRes?.suggestions || []).map(s => ({ ...s, kind: 'show' }));
      const movies = (movieRes?.suggestions || []).map(s => ({ ...s, kind: 'movie' }));
      setResults([...anime, ...shows, ...movies]); // anime first, then shows, then movies
    } catch (e) {
      console.error('Unified search failed:', e);
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (queryName.trim().length >= 3) {
      const t = setTimeout(() => fetchSuggestions(queryName), 300);
      return () => clearTimeout(t);
    }
    setResults([]);
    setShowSuggestions(false);
  }, [queryName, fetchSuggestions]);

  return { queryName, setQueryName, results, showSuggestions, setShowSuggestions };
}

// Trending non-anime shows for the landing page's secondary row.
export function useTrendingShows() {
  const [trendingShows, setTrendingShows] = useState(() => memGet('trending-shows') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending-shows'));

  useEffect(() => {
    if (memGet('trending-shows')) return;
    (async () => {
      setTrendLoading(true);
      try {
        const res = await apiFetch(`/trending/shows`);
        if (!res.ok) throw new Error('Failed to fetch trending shows.');
        const data = await res.json();
        if (data.success && Array.isArray(data.shows)) {
          setTrendingShows(data.shows);
          memSet('trending-shows', data.shows);
        }
      } catch (e) {
        console.error('Error fetching trending shows:', e);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, []);

  return { trendingShows, trendLoading };
}

// TMDB-keyed twin of useAnimeOverview: fetches /show-overview/{tmdbId} (same shape
// as /overview) and lazily loads each season's episodes via /info.
export function useShowOverview(tmdbId) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`show-overview:${tmdbId}`) : null));
  const [loading, setLoading] = useState(() => !(tmdbId && memGet(`show-overview:${tmdbId}`)));
  const [error, setError] = useState(null);

  const [activeSeason, setActiveSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const episodeCache = useRef(new Map());

  useEffect(() => {
    if (!tmdbId) return;
    const cached = memGet(`show-overview:${tmdbId}`);
    if (cached) {
      setOverview(cached);
      setActiveSeason(cached.seasons?.[0]?.season_number ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(`/show-overview/${tmdbId}`);
        if (!res.ok) throw new Error(`Failed to load overview (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`show-overview:${tmdbId}`, data);
        setActiveSeason(data.seasons?.[0]?.season_number ?? null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId]);

  useEffect(() => {
    if (!overview || activeSeason == null) return;
    const season = overview.seasons?.find(s => s.season_number === activeSeason);
    if (!season) { setEpisodes([]); return; }

    const cacheKey = `${season.tmdb_id}:${season.tmdb_season}`;
    if (episodeCache.current.has(cacheKey)) {
      setEpisodes(episodeCache.current.get(cacheKey));
      return;
    }

    let cancelled = false;
    setEpisodesLoading(true);
    setEpisodes([]);
    (async () => {
      try {
        const res = await apiFetch(`/info/${season.tmdb_id}?season=${season.tmdb_season}`);
        if (!res.ok) throw new Error(`Failed to load episodes (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data.episodes_list) ? data.episodes_list : [];
        episodeCache.current.set(cacheKey, list);
        setEpisodes(list);
      } catch (e) {
        if (!cancelled) { console.error('Episode list fetch failed:', e); setEpisodes([]); }
      } finally {
        if (!cancelled) setEpisodesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [overview, activeSeason]);

  return { overview, loading, error, activeSeason, setActiveSeason, episodes, episodesLoading };
}

// Latest watch-progress row for ONE show, so an overview page can surface a
// "continue where you left off" banner. Anime match on anilist_id; non-anime shows
// match on tmdb_id (and a null anilist_id, mirroring the backend dedup key). Rows
// come back newest-first (updated_at DESC), so the first match is the most recent
// episode. Returns the row (with season/episode/status/position) or null. Reactive
// to login/logout; best-effort and silent on failure.
export function useShowResume({ anilistId = null, tmdbId = null, mediaType = null } = {}) {
  const sessionToken = useSessionToken();
  const [resume, setResume] = useState(null);

  useEffect(() => {
    if (!sessionToken || (anilistId == null && tmdbId == null)) { setResume(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/account/progress`);
        if (!res.ok) return;
        const rows = (await res.json()).progress || [];
        const match = (r) => {
          if (anilistId != null) return String(r.anilist_id) === String(anilistId);
          // Movies share the TMDB id space with shows — disambiguate by media_type.
          if (mediaType === 'movie') return String(r.tmdb_id) === String(tmdbId) && r.media_type === 'movie';
          return String(r.tmdb_id) === String(tmdbId) && r.anilist_id == null && r.media_type !== 'movie';
        };
        const latest = rows.find(match) || null;
        if (!cancelled) setResume(latest);
      } catch { /* best-effort: no banner on failure */ }
    })();
    return () => { cancelled = true; };
  }, [sessionToken, anilistId, tmdbId, mediaType]);

  return resume;
}

// TMDB-keyed twin of useAnimeStreamer's playback half. Season/episode are driven
// by the URL (the show watch page passes them in), so this is simpler than the
// anime version: no anilist->season mapping. Loads the season list + season
// metadata, and streams sources via the 3-segment /watch/{tmdb}/{season}/{episode}.
export function useShowStreamer(tmdbId, season, episode) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`show-overview:${tmdbId}`) : null));
  const [metadata, setMetadata] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [streamData, setStreamData] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  const [apiError, setApiError] = useState(null);
  // Set (to { airDate }) when the backend reports the episode hasn't aired yet.
  const [unaired, setUnaired] = useState(null);

  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);
  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);

  // Manual "rescan sources" — bump to re-run the resolution effect from scratch.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

  // Season list + title (reuses the overview payload / its cache).
  useEffect(() => {
    if (!tmdbId) return;
    const cached = memGet(`show-overview:${tmdbId}`);
    if (cached) { setOverview(cached); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/show-overview/${tmdbId}`);
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`show-overview:${tmdbId}`, data);
      } catch (e) {
        if (!cancelled) setApiError('Could not load show information');
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId]);

  // Season metadata (episode list, summary) via /info.
  useEffect(() => {
    if (!tmdbId || !season) return;
    let cancelled = false;
    setMetaLoading(true);
    setMetadata(null);
    (async () => {
      try {
        const res = await apiFetch(`/info/${tmdbId}?season=${season}`);
        if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setMetadata(data);
      } catch (e) {
        if (!cancelled) setApiError('Failed to load season data');
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId, season]);

  // Progressive NDJSON source streaming via the 3-segment /watch route.
  useEffect(() => {
    if (!tmdbId || !season || !episode) return;
    const controller = new AbortController();

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0);
    setUnaired(null);
    streamsRef.current = [];
    userPickedRef.current = false;

    // When the client engine is on, a source may resolve both locally and on the
    // backend. Dedup by (source, language) and PREFER the local line: it streams
    // straight from the CDN, so it supersedes a backend duplicate even if the
    // backend arrived first. Guarded so default behavior is untouched when off.
    //   key -> { idx, origin: 'local' | 'backend' }
    const dedup = new Map();

    const handleLine = (line, origin = 'backend') => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try { msg = JSON.parse(trimmed); } catch { return; }

      if (msg.type === 'unaired') {
        setUnaired({ airDate: msg.air_date });
        setStreamLoading(false);
      } else if (msg.type === 'meta') {
        setStreamData((prev) => ({ ...(prev || {}), ...msg, streams: prev?.streams || [] }));
      } else if (msg.type === 'stream') {
        const incoming = { source: msg.source, type: msg.streamType, url: msg.url, language: msg.language, subtitles: msg.subtitles, cacheTicket: msg.cacheTicket };
        const reselect = () => {
          if (userPickedRef.current) return;
          const prefs = getPlaybackPrefs();
          let bestIdx = 0, bestRank = Infinity;
          streamsRef.current.forEach((s, i) => {
            const r = streamRank(s, prefs);
            if (r < bestRank) { bestRank = r; bestIdx = i; }
          });
          setActiveStreamIdx(bestIdx);
        };
        if (clientSourcesEnabled()) {
          // Dedup by (source, language) — distinct dub/sub variants stay separate
          // (e.g. VOE English Sub vs German Dub). Prefer local: a locally-resolved
          // line (direct CDN) supersedes a backend duplicate even if the backend
          // arrived first; a backend line never displaces a local one.
          const key = `${msg.source}|${msg.language || ''}`;
          const prior = dedup.get(key);
          if (prior) {
            if (origin === 'local' && prior.origin !== 'local') {
              const swapped = streamsRef.current.slice();
              swapped[prior.idx] = incoming;
              streamsRef.current = swapped;
              dedup.set(key, { idx: prior.idx, origin });
              setStreamData((prev) => ({ ...(prev || {}), streams: swapped }));
              reselect();
            }
            return; // local already won, or a same-origin duplicate
          }
          dedup.set(key, { idx: streamsRef.current.length, origin });
        }
        const next = [...streamsRef.current, incoming];
        streamsRef.current = next;
        setStreamData((prev) => ({ ...(prev || {}), streams: next }));
        reselect();
        setStreamLoading(false);
      } else if (msg.type === 'done') {
        setStreamLoading(false);
      }
    };

    (async () => {
      try {
        // E3/E2 client-side resolution (no-op unless opted in). Runs alongside the
        // backend stream and feeds the same handleLine; the backend stays the floor.
        const local = streamLocalSources(
          { tmdbId, mediaType: 'tv', season, episode },
          { signal: controller.signal, onLine: (s) => handleLine(s, 'local') },
        );
        await streamWatchNdjson(`/watch/${tmdbId}/${season}/${episode}`, {
          signal: controller.signal,
          onLine: handleLine,
        });
        await local;
        setStreamLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Stream fetch error:', err);
        setStreamLoading(false);
        setApiError('Failed to load streaming sources');
      }
    })();

    return () => controller.abort();
  }, [tmdbId, season, episode, reloadNonce]);

  return {
    overview, metadata, metaLoading,
    streamData, streamLoading, unaired,
    activeStreamIdx, selectStream,
    apiError,
    reloadStreams,
  };
}

// --- General (non-anime) movies (secondary surface) -------------------------
// The movie twins of the show hooks. A movie has no seasons/episodes, so these
// are simpler: one /movie-overview payload and a single /watch/movie stream. Anime
// and shows are untouched.

// Trending general movies for the landing page's secondary row.
export function useTrendingMovies() {
  const [trendingMovies, setTrendingMovies] = useState(() => memGet('trending-movies') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending-movies'));

  useEffect(() => {
    if (memGet('trending-movies')) return;
    (async () => {
      setTrendLoading(true);
      try {
        const res = await apiFetch(`/trending/movies`);
        if (!res.ok) throw new Error('Failed to fetch trending movies.');
        const data = await res.json();
        if (data.success && Array.isArray(data.movies)) {
          setTrendingMovies(data.movies);
          memSet('trending-movies', data.movies);
        }
      } catch (e) {
        console.error('Error fetching trending movies:', e);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, []);

  return { trendingMovies, trendLoading };
}

// Movie overview: fetches /movie-overview/{tmdbId}. No seasons/episodes — the page
// renders a single "Start Watching" using the shared OverviewView in movie mode.
export function useMovieOverview(tmdbId) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`movie-overview:${tmdbId}`) : null));
  const [loading, setLoading] = useState(() => !(tmdbId && memGet(`movie-overview:${tmdbId}`)));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tmdbId) return;
    const cached = memGet(`movie-overview:${tmdbId}`);
    if (cached) { setOverview(cached); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch(`/movie-overview/${tmdbId}`);
        if (!res.ok) throw new Error(`Failed to load overview (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`movie-overview:${tmdbId}`, data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId]);

  return { overview, loading, error };
}

// Movie streamer: loads the overview (title/poster) + streams sources via the
// /watch/movie/{tmdbId} NDJSON route. No season/episode dimension.
export function useMovieStreamer(tmdbId) {
  const [overview, setOverview] = useState(() => (tmdbId ? memGet(`movie-overview:${tmdbId}`) : null));
  const [streamData, setStreamData] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  const [apiError, setApiError] = useState(null);

  const streamsRef = useRef([]);
  const userPickedRef = useRef(false);
  const selectStream = useCallback((idx) => {
    userPickedRef.current = true;
    setActiveStreamIdx(idx);
  }, []);

  // Manual "rescan sources" — bump to re-run the resolution effect from scratch.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadStreams = useCallback(() => setReloadNonce((n) => n + 1), []);

  // Movie metadata (title/poster) — reuses the overview payload / its cache.
  useEffect(() => {
    if (!tmdbId) return;
    const cached = memGet(`movie-overview:${tmdbId}`);
    if (cached) { setOverview(cached); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/movie-overview/${tmdbId}`);
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setOverview(data);
        memSet(`movie-overview:${tmdbId}`, data);
      } catch (e) {
        if (!cancelled) setApiError('Could not load movie information');
      }
    })();
    return () => { cancelled = true; };
  }, [tmdbId]);

  // Progressive NDJSON source streaming via /watch/movie/{tmdbId}.
  useEffect(() => {
    if (!tmdbId) return;
    const controller = new AbortController();

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0);
    streamsRef.current = [];
    userPickedRef.current = false;

    //   key -> { idx, origin: 'local' | 'backend' }; prefer-local dedup, see the
    //   show hook above for the rationale.
    const dedup = new Map();

    const handleLine = (line, origin = 'backend') => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try { msg = JSON.parse(trimmed); } catch { return; }

      if (msg.type === 'meta') {
        setStreamData((prev) => ({ ...(prev || {}), ...msg, streams: prev?.streams || [] }));
      } else if (msg.type === 'stream') {
        const incoming = { source: msg.source, type: msg.streamType, url: msg.url, language: msg.language, subtitles: msg.subtitles };
        const reselect = () => {
          if (userPickedRef.current) return;
          const prefs = getPlaybackPrefs();
          let bestIdx = 0, bestRank = Infinity;
          streamsRef.current.forEach((s, i) => {
            const r = streamRank(s, prefs);
            if (r < bestRank) { bestRank = r; bestIdx = i; }
          });
          setActiveStreamIdx(bestIdx);
        };
        if (clientSourcesEnabled()) {
          // Prefer local over a backend duplicate; distinct dub/sub variants stay
          // separate. A local line supersedes backend even if backend arrived first.
          const key = `${msg.source}|${msg.language || ''}`;
          const prior = dedup.get(key);
          if (prior) {
            if (origin === 'local' && prior.origin !== 'local') {
              const swapped = streamsRef.current.slice();
              swapped[prior.idx] = incoming;
              streamsRef.current = swapped;
              dedup.set(key, { idx: prior.idx, origin });
              setStreamData((prev) => ({ ...(prev || {}), streams: swapped }));
              reselect();
            }
            return;
          }
          dedup.set(key, { idx: streamsRef.current.length, origin });
        }
        const next = [...streamsRef.current, incoming];
        streamsRef.current = next;
        setStreamData((prev) => ({ ...(prev || {}), streams: next }));
        reselect();
        setStreamLoading(false);
      } else if (msg.type === 'done') {
        setStreamLoading(false);
      }
    };

    (async () => {
      try {
        // Client-side resolution (no-op unless opted in); backend stays the floor.
        const local = streamLocalSources(
          { tmdbId, mediaType: 'movie' },
          { signal: controller.signal, onLine: (s) => handleLine(s, 'local') },
        );
        await streamWatchNdjson(`/watch/movie/${tmdbId}`, {
          signal: controller.signal,
          onLine: handleLine,
        });
        await local;
        setStreamLoading(false);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Stream fetch error:', err);
        setStreamLoading(false);
        setApiError('Failed to load streaming sources');
      }
    })();

    return () => controller.abort();
  }, [tmdbId, reloadNonce]);

  return { overview, streamData, streamLoading, activeStreamIdx, selectStream, apiError, reloadStreams };
}

export function useSupporters() {
  const [supporters, setSupporters] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSupportersData = async () => {
      setLoading(true);
      try {
        const [suppRes, statsRes] = await Promise.all([
          apiFetch(`/supporters`),
          apiFetch(`/supporters/stats`)
        ]);

        if (!suppRes.ok) throw new Error(`Supporters: ${suppRes.status}`);
        if (!statsRes.ok) throw new Error(`Stats: ${statsRes.status}`);

        const suppData = await suppRes.json();
        const statsData = await statsRes.json();

        // Handle both array-only and {success, supporters} formats
        if (Array.isArray(suppData)) {
          setSupporters(suppData);
        } else if (suppData && Array.isArray(suppData.supporters)) {
          setSupporters(suppData.supporters);
        } else {
          setSupporters([]);
        }

        setStats(statsData);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSupportersData();
  }, []);

  return { supporters, stats, loading, error };
}

// --- Changelog ---------------------------------------------------------------
// Public view of the repo's GitHub Releases, surfaced by the backend's changelog
// engine (GET /changelog → { changelog: [{tag, name, body(Markdown),
// published_at, url, prerelease, author}], repo, count, stale }). The endpoint
// 503s until the backend has a GITHUB_TOKEN configured — we treat that as a
// distinct "slumbering" state rather than an error so the page can say so kindly.
// Cached in the shared in-memory store (same TTL as trending/catalogue) so the
// About-page preview and the full page don't double-fetch.
export function useChangelog() {
  const seed = memGet('changelog');
  const [entries, setEntries] = useState(() => seed?.entries || []);
  const [meta, setMeta] = useState(() => seed?.meta || null);
  const [loading, setLoading] = useState(() => !seed);
  const [error, setError] = useState(null);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    if (memGet('changelog')) return; // already seeded from cache
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/changelog`);
        // 503 == backend changelog engine has no GITHUB_TOKEN yet (not an error).
        if (res.status === 503) {
          if (!cancelled) setNotConfigured(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data.changelog) ? data.changelog : [];
        const m = { repo: data.repo, stale: !!data.stale, count: data.count ?? list.length };
        setEntries(list);
        setMeta(m);
        memSet('changelog', { entries: list, meta: m });
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { entries, meta, loading, error, notConfigured };
}

// Lightweight profile hook — fetches /account/me only (no favorites/progress).
// Used by the nav to decide whether to surface the Admin link (profile.is_admin)
// without paying for the full useAccount fan-out on every page.
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
          // Mirror the account's saved playback preference into the local cache the
          // stream ranker reads, so it follows the user across devices even before
          // they open the settings page. Best-effort and additive (see helper).
          syncPlaybackPrefsFromAccount(data.preferences);
        })
        .catch(() => {});
    };
    load();
    // Refetch when the profile changes elsewhere (e.g. display name saved on the
    // preferences page) so greetings like "Recommended for you, {username}" update
    // live without a reload.
    window.addEventListener('crimson-profile', load);
    return () => { cancelled = true; window.removeEventListener('crimson-profile', load); };
  }, [sessionToken]);

  return profile;
}

// Save (or clear, with '') the account's cosmetic display name, then broadcast so
// every useProfile instance refetches. Returns the stored value (or null).
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

// Personalized "watch next" feed (anime + shows + movies), ranked by the genres of
// what you've saved and watched (see the backend recommend_engine). Cached briefly
// in-memory so navigating back to the home page paints instantly.
export function useRecommendations(limit = 24) {
  const sessionToken = useSessionToken();
  // Cache key is per-session so switching accounts in one tab never shows the
  // previous user's picks (recommendations are personal, unlike trending).
  const key = sessionToken ? `recommendations:${sessionToken}` : null;
  const [recommendations, setRecommendations] = useState(() => (key && memGet(key)?.recs) || []);
  const [basedOn, setBasedOn] = useState(() => (key && memGet(key)?.basedOn) || null);
  const [loading, setLoading] = useState(() => !(key && memGet(key)));

  useEffect(() => {
    if (!key) { setRecommendations([]); setBasedOn(null); setLoading(false); return; }
    const cached = memGet(key);
    if (cached) { setRecommendations(cached.recs); setBasedOn(cached.basedOn); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/recommendations?limit=${limit}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        const recs = data.recommendations || [];
        const based = data.based_on || null;
        setRecommendations(recs);
        setBasedOn(based);
        memSet(key, { recs, basedOn: based });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, limit]);

  return { recommendations, basedOn, loading };
}

