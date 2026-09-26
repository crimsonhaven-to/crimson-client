// Songs kept on this device, in Cache Storage, which the page and the service
// worker can both read. Keys are by track id under /music-offline/, because a
// track's signed link changes every day and would never match a cached one.
//
// Two caches, since they are emptied by different rules: downloads stay until
// the member removes them (downloads.js), preloads are a small rolling window
// ahead of the queue (preload.js).
export const DOWNLOADS = 'crimson-music-downloads';
export const PRELOADS = 'crimson-music-preloads';

const AUDIO_PREFIX = '/music-offline/audio/';
const COVER_PREFIX = '/music-offline/cover/';

const audioKey = (id) => `${AUDIO_PREFIX}${id}`;
// Served by the service worker, so an <img> or the lock screen can load it.
export const coverKey = (id) => `${COVER_PREFIX}${id}`;

export const supported = () => typeof caches !== 'undefined';

async function put(cacheName, key, url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const cache = await caches.open(cacheName);
  // Streams straight to disk; a whole song never sits in memory.
  await cache.put(key, res);
}

export function storeAudio(cacheName, track, signal) {
  return put(cacheName, audioKey(track.id), track.stream_url, signal);
}

export function storeCover(cacheName, track, signal) {
  return put(cacheName, coverKey(track.id), track.cover_url, signal);
}

export async function storedAudioIds(cacheName) {
  if (!supported()) return new Set();
  const keys = await (await caches.open(cacheName)).keys();
  return new Set(keys
    .map((request) => new URL(request.url).pathname)
    .filter((path) => path.startsWith(AUDIO_PREFIX))
    .map((path) => Number(path.slice(AUDIO_PREFIX.length))));
}

// The song's bytes if either cache has them, downloads first.
export async function localAudio(id) {
  if (!supported()) return null;
  for (const name of [DOWNLOADS, PRELOADS]) {
    const res = await (await caches.open(name)).match(audioKey(id));
    if (res) return res.blob();
  }
  return null;
}

export async function forget(cacheName, ids) {
  if (!supported() || !ids.length) return;
  const cache = await caches.open(cacheName);
  await Promise.all(ids.flatMap((id) => [cache.delete(audioKey(id)), cache.delete(coverKey(id))]));
}

export async function forgetAll() {
  if (!supported()) return;
  await Promise.all([caches.delete(DOWNLOADS), caches.delete(PRELOADS)]);
}
