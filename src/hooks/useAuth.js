// Authentication: mnemonic (Ed25519 signed-challenge) + email/password flows.
// Lifted verbatim from hooks.js. The lazy crypto loader (ed25519 + bip39) lives
// here because useAuth is its only consumer — importing them on demand keeps ~tens
// of KB of key-derivation code out of the eager main bundle.
import { useEffect, useState } from 'react';

import { API_BASE_URL } from './config';
import { PUBKEY_KEY, extractError, setAuthStorage, useSessionToken } from './apiClient';
import { toHex, deriveIdentity } from './identity';

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
    // Pure derivation lives in ./identity (pinned by identity.test.js); the heavy
    // libs stay lazy-loaded here and are injected in.
    return deriveIdentity(mnemonic, {
      mnemonicToSeedSync,
      getPublicKeyAsync: (seed) => ed.getPublicKeyAsync(seed),
    });
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
