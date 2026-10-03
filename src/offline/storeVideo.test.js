import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { storeSubtitles, storeVideo } from './storeVideo';
import { VIDEO_CACHE, read, segmentKey, storedKeys, putBytes } from './videoStore';

// Cache Storage reduced to what videoStore uses, keyed by path like the real one
// is keyed by URL.
function fakeCaches() {
  const stores = new Map();
  const path = (key) => new URL(typeof key === 'string' ? key : key.url, 'http://localhost').pathname;
  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(key, res) {
          entries.set(path(key), { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') });
        },
        async match(key) {
          const hit = entries.get(path(key));
          return hit ? new Response(hit.bytes, { headers: { 'Content-Type': hit.type || '' } }) : undefined;
        },
        async keys() {
          return [...entries.keys()].map((p) => ({ url: `http://localhost${p}` }));
        },
        async delete(key) {
          return entries.delete(path(key));
        },
      };
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
}

function fakeCdn(files) {
  const requested = [];
  const fetchMock = vi.fn(async (url) => {
    requested.push(url);
    const body = files[url];
    if (body === undefined) return new Response('nope', { status: 404 });
    return new Response(body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(body.length ?? body.byteLength) } });
  });
  return { fetchMock, requested };
}

const CDN = 'https://cdn.example/show/';

async function encrypt(plain, raw, seq) {
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, ['encrypt']);
  const iv = new Uint8Array(16);
  new DataView(iv.buffer).setUint32(12, seq);
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, new TextEncoder().encode(plain)));
}

const text = async (key) => (await read(key))?.text();

describe('storeVideo', () => {
  let cdn;

  beforeEach(async () => {
    vi.stubGlobal('caches', fakeCaches());
    const raw = new Uint8Array(16).fill(9);
    cdn = fakeCdn({
      [`${CDN}master.m3u8`]: '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="en",DEFAULT=YES,URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=100,AUDIO="a"\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=900,AUDIO="a"\nhigh.m3u8\n',
      [`${CDN}high.m3u8`]: '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:5,\nv0.ts\n#EXTINF:5,\nv1.ts\n#EXT-X-ENDLIST\n',
      [`${CDN}audio.m3u8`]: '#EXTM3U\n#EXTINF:10,\na0.aac\n#EXT-X-ENDLIST\n',
      [`${CDN}key.bin`]: raw,
      [`${CDN}v0.ts`]: await encrypt('video zero', raw, 0),
      [`${CDN}v1.ts`]: await encrypt('video one', raw, 1),
      [`${CDN}a0.aac`]: 'audio zero',
      [`${CDN}film.mp4`]: 'the whole film',
      [`${CDN}en.vtt`]: 'WEBVTT\n',
    });
    vi.stubGlobal('fetch', cdn.fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const stream = { source: 'PlayIMDb', type: 'hls', url: `${CDN}master.m3u8` };

  it('keeps the best variant and its audio, decrypted, behind local playlists', async () => {
    const progress = [];
    const result = await storeVideo('tv-1-s1-e1', stream, { onProgress: (p) => progress.push(p) });

    expect(result.format).toBe('hls');
    expect(cdn.requested).not.toContain(`${CDN}low.m3u8`);
    expect(await text(segmentKey('tv-1-s1-e1', 'v', 0))).toBe('video zero');
    expect(await text(segmentKey('tv-1-s1-e1', 'v', 1))).toBe('video one');
    expect(await text(segmentKey('tv-1-s1-e1', 'a', 0))).toBe('audio zero');
    expect(await text('/video-offline/tv-1-s1-e1/index.m3u8')).toContain('URI="a.m3u8"');
    expect(await text('/video-offline/tv-1-s1-e1/v.m3u8')).toContain('v/1');
    expect(progress.at(-1)).toMatchObject({ done: 3, total: 3, layout: 'PlayIMDb|v:2:0,a:1:0' });
    expect(result.bytes).toBe('video zero'.length + 'video one'.length + 'audio zero'.length);
  });

  it('skips segments already kept when the link cuts the video the same way', async () => {
    await putBytes(segmentKey('e', 'v', 0), new TextEncoder().encode('video zero'));
    await storeVideo('e', stream, { layout: 'PlayIMDb|v:2:0,a:1:0', onProgress: () => {} });
    expect(cdn.requested).not.toContain(`${CDN}v0.ts`);
    expect(cdn.requested).toContain(`${CDN}v1.ts`);
  });

  it('starts over when a fresh link is cut differently', async () => {
    await putBytes(segmentKey('e', 'v', 5), new TextEncoder().encode('stale'));
    await storeVideo('e', stream, { layout: 'PlayIMDb|v:9:0', onProgress: () => {} });
    expect([...await storedKeys('e')]).not.toContain(segmentKey('e', 'v', 5));
    expect(cdn.requested).toContain(`${CDN}v0.ts`);
  });

  it('streams an mp4 into one entry', async () => {
    const result = await storeVideo('movie-1', { source: 'HDRezka', type: 'mp4', url: `${CDN}film.mp4` }, { onProgress: () => {} });
    expect(result).toEqual({ format: 'mp4', bytes: 'the whole film'.length });
    expect(await text('/video-offline/movie-1/file')).toBe('the whole film');
  });

  it('keeps the subtitles it can reach and skips the rest', async () => {
    const kept = await storeSubtitles('movie-1', [
      { url: `${CDN}en.vtt`, lang: 'en', label: 'English' },
      { url: `${CDN}gone.vtt`, lang: 'de' },
    ]);
    expect(kept).toEqual([{ n: 0, lang: 'en', label: 'English' }]);
    expect(caches.stores.get(VIDEO_CACHE).has('/video-offline/movie-1/sub/0')).toBe(true);
  }, 10000);
});
