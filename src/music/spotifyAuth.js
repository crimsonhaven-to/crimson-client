// Connecting a Spotify app: Authorization Code with PKCE, as in WAIFU.
//
// Each member brings their own Spotify app (a client ID and nothing else), so
// no secret exists anywhere. The browser makes the verifier, keeps it in
// sessionStorage across the round trip to Spotify, and hands the code plus
// verifier to the backend once, which trades them for tokens it keeps.

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const VERIFIER_KEY = 'crimson:spotify-verifier';
const STATE_KEY = 'crimson:spotify-state';
const CLIENT_ID_KEY = 'crimson:spotify-client';

// Must match what the member registered in their Spotify app, character for
// character, which is why the connect card shows it for copying.
export function redirectUri() {
  return `${window.location.origin}/music/connect`;
}

// RFC 7636 base64url: no padding, and the two URL hostile characters swapped.
export function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function isClientId(value) {
  return /^[0-9a-f]{32}$/i.test(value.trim());
}

export async function beginAuthorization(clientId, scopes) {
  // 64 bytes encode to 86 characters, inside the 43 to 128 the RFC allows.
  const verifier = randomString(64);
  const state = randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(CLIENT_ID_KEY, clientId);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state,
    scope: scopes,
  });
  window.location.assign(`${AUTHORIZE_URL}?${params}`);
}

// Consumes what beginAuthorization stored, and refuses a callback whose state
// does not match: a stray or replayed redirect must not connect anything.
export function takePendingAuthorization(returnedState) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  const clientId = sessionStorage.getItem(CLIENT_ID_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(CLIENT_ID_KEY);

  if (!verifier || !state || !clientId) {
    throw new Error('This sign in did not start in this tab. Connect again from the Music page.');
  }
  if (state !== returnedState) {
    throw new Error('The Spotify response did not match this request. Connect again.');
  }
  return { verifier, clientId };
}
