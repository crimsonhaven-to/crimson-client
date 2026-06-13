// Tiny in-memory TTL cache, mirroring the backend's api_cache role for hot keys
// (TMDB show/season/search, AniList metadata, trending). Per-session only — a
// reload re-warms it, which is fine: the upstream data is slow-moving and each
// lookup is cheap. Keeps the local backend from re-hitting TMDB/AniList on every
// navigation.

const _store = new Map(); // key -> { value, expiry }

const DAY = 24 * 60 * 60 * 1000;

export function cacheGet(key) {
  const hit = _store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiry) {
    _store.delete(key);
    return undefined;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs = DAY) {
  _store.set(key, { value, expiry: Date.now() + ttlMs });
}

// Memoise an async producer under a key (the common get-or-fetch pattern).
export async function cached(key, ttlMs, producer) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  if (value !== undefined && value !== null) cacheSet(key, value, ttlMs);
  return value;
}
