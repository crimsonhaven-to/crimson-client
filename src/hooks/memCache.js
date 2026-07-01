// --- Lightweight in-memory cache (per page session) -------------------------
// Trending and the catalogue are global, slow-changing payloads. Without this,
// navigating away and back re-downloads them on every mount (the catalogue can
// be large). A short TTL keeps them fresh enough while removing the repeat
// fetches. Lives in module scope so it persists across component remounts.
const _memCache = new Map();
const MEM_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function memGet(key) {
  const hit = _memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiry) {
    _memCache.delete(key);
    return null;
  }
  return hit.data;
}

export function memSet(key, data, ttlMs = MEM_TTL_MS) {
  _memCache.set(key, { data, expiry: Date.now() + ttlMs });
}
