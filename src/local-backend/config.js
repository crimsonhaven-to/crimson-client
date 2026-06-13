// Extension configuration — the user's own TMDB API token (the extension ships
// none) plus a tiny promisified wrapper over chrome.storage.local that the rest
// of the local backend uses. The token is read by src/local-backend/tmdb.js.

const TMDB_KEY = 'crimson_tmdb_key';

// chrome.storage.local is promise-based in MV3. These thin helpers also no-op
// gracefully if somehow loaded outside an extension context.
export async function storageGet(key, fallback = null) {
  if (typeof chrome === 'undefined' || !chrome.storage) return fallback;
  const out = await chrome.storage.local.get(key);
  return key in out ? out[key] : fallback;
}

export async function storageSet(key, value) {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  await chrome.storage.local.set({ [key]: value });
}

export async function storageRemove(key) {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  await chrome.storage.local.remove(key);
}

export async function getTmdbKey() {
  return storageGet(TMDB_KEY, '');
}

export async function setTmdbKey(key) {
  await storageSet(TMDB_KEY, (key || '').trim());
}

export async function clearTmdbKey() {
  await storageRemove(TMDB_KEY);
}

// First-run gate: the app shows the setup screen until a key is stored.
export async function needsSetup() {
  const key = await getTmdbKey();
  return !key;
}
