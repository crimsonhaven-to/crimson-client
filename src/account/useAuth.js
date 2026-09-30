import { useEffect, useState } from 'react';

import { API_BASE_URL } from '../api/config';
import { PUBKEY_KEY, extractError, setAuthStorage, useSessionToken } from '../api/client';
import { toHex, deriveIdentity } from './identity';

// Only needed to sign in or mint an identity, so loading on demand keeps tens of
// KB of key-derivation code out of the main bundle.
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
  const sessionToken = useSessionToken();
  const [publicKey, setPublicKey] = useState(() => localStorage.getItem(PUBKEY_KEY));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    return deriveIdentity(mnemonic, {
      mnemonicToSeedSync,
      getPublicKeyAsync: (seed) => ed.getPublicKeyAsync(seed),
    });
  };

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

  // Existing accounts only: creation is the invite-gated registerMnemonic, so a
  // freshly generated mnemonic cannot bypass the invite system.
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
          res.status === 404 ? 'No account for this mnemonic. Create a new identity instead.' : 'Authentication failed',
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

  // Account deletion must not be reachable with a stolen session token alone, and a
  // mnemonic identity has no password to re-enter, so it re-proves ownership.
  const signChallenge = async (mnemonic) => {
    const { seed, publicKey: pubKey } = await deriveKeypair(mnemonic);
    return challengeAndSign(pubKey, seed);
  };

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
          res.status === 409 ? 'This mnemonic is already registered. Sign in instead.' : 'Registration failed',
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
        // 403 means the account exists but the email is not verified yet.
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
      // Demo instances auto-verify and return a session straight away.
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
    signChallenge,
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
