// Trending and the catalogue are large, slow-changing payloads; module scope keeps
// them across remounts so navigating back does not re-download them.
const _memCache = new Map();
const MEM_TTL_MS = 5 * 60 * 1000;

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
