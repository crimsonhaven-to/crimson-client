// Movies and episodes kept on this device, in the same device cache as the
// music (deviceCache.js), so the page and the service worker can both read
// them. Keys live under /video-offline/<entry id>/, never the source's URL,
// because those are signed and expire long before the copy does.
//
// A HLS copy is stored as its playlists plus one cache entry per segment,
// already decrypted, so it plays from here with hls.js and never needs the
// whole video in memory. An mp4 copy is one entry.
import { deleteCache, openCache, supported } from '../deviceCache';

export { supported };

export const VIDEO_CACHE = 'crimson-video-downloads';

const PREFIX = '/video-offline/';

export const entryPrefix = (id) => `${PREFIX}${id}/`;
export const playlistKey = (id, name) => `${entryPrefix(id)}${name}.m3u8`;
export const segmentKey = (id, track, n) => `${entryPrefix(id)}${track}/${n}`;
export const initKey = (id, track, n) => `${entryPrefix(id)}${track}/init${n}`;
export const fileKey = (id) => `${entryPrefix(id)}file`;
export const subtitleKey = (id, n) => `${entryPrefix(id)}sub/${n}`;
// One poster per title, however many of its episodes are kept.
export const posterKey = (titleKey) => `${PREFIX}poster/${titleKey}`;

export const isOfflineUrl = (url) => {
  try {
    return new URL(url, window.location.href).pathname.startsWith(PREFIX);
  } catch {
    return false;
  }
};

const open = () => openCache(VIDEO_CACHE);

export async function putBytes(key, bytes, type = 'application/octet-stream') {
  await (await open()).put(key, new Response(bytes, { headers: { 'Content-Type': type } }));
}

export async function putResponse(key, response) {
  await (await open()).put(key, response);
}

export async function read(key) {
  if (!supported()) return null;
  return (await (await open()).match(key)) || null;
}

export async function storedKeys(id) {
  if (!supported()) return new Set();
  const prefix = entryPrefix(id);
  const keys = await (await open()).keys();
  return new Set(keys
    .map((request) => new URL(request.url).pathname)
    .filter((path) => path.startsWith(prefix)));
}

export async function forgetEntry(id) {
  if (!supported()) return;
  const cache = await open();
  await Promise.all([...await storedKeys(id)].map((key) => cache.delete(key)));
}

export async function forgetPoster(titleKey) {
  if (!supported()) return;
  await (await open()).delete(posterKey(titleKey));
}

export async function forgetAll() {
  if (!supported()) return;
  await deleteCache(VIDEO_CACHE);
}
