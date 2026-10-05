import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteCache, estimate, openCache, servesFiles } from './deviceCache';

// CrimsonNative.media reduced to an in-memory file table, the way the desktop
// app's main process keeps one per backend on disk.
function fakeMedia() {
  const files = new Map();
  const open = new Map();
  let next = 0;
  return {
    files,
    begin: vi.fn(async (cache, key) => {
      const id = String(next++);
      open.set(id, { path: `${cache}${key}`, chunks: [] });
      return id;
    }),
    append: vi.fn(async (id, chunk) => { open.get(id).chunks.push(chunk); }),
    finish: vi.fn(async (id) => {
      const { path, chunks } = open.get(id);
      files.set(path, new Uint8Array(await new Blob(chunks).arrayBuffer()));
      open.delete(id);
    }),
    abort: vi.fn(async (id) => { open.delete(id); }),
    keys: vi.fn(async (cache) => [...files.keys()].filter((p) => p.startsWith(cache)).map((p) => p.slice(cache.length))),
    remove: vi.fn(async (cache, key) => { files.delete(`${cache}${key}`); }),
    clear: vi.fn(async (cache) => { for (const p of [...files.keys()]) if (p.startsWith(cache)) files.delete(p); }),
    usage: vi.fn(async () => ({ used: 10, free: 90, root: '/downloads' })),
  };
}

describe('deviceCache in the desktop app', () => {
  let media;

  beforeEach(() => {
    media = fakeMedia();
    globalThis.CrimsonNative = { media };
    vi.stubGlobal('window', { location: { href: 'http://localhost/' } });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const [path, query] = url.split('?cache=');
      const bytes = media.files.get(`${decodeURIComponent(query)}${path}`);
      return bytes ? new Response(bytes) : new Response('Not found', { status: 404 });
    }));
  });

  afterEach(() => {
    delete globalThis.CrimsonNative;
    vi.unstubAllGlobals();
  });

  it('writes a response as one file and reads it back from that cache only', async () => {
    const cache = await openCache('crimson-video-downloads');
    await cache.put('/video-offline/e1/v/0', new Response(new Uint8Array([1, 2, 3])));
    expect(media.finish).toHaveBeenCalledOnce();
    expect(new Uint8Array(await (await cache.match('/video-offline/e1/v/0')).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(await (await openCache('crimson-music-preloads')).match('/video-offline/e1/v/0')).toBeUndefined();
  });

  it('batches a streamed body into large writes', async () => {
    const chunk = new Uint8Array(256 * 1024);
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 10; i++) controller.enqueue(chunk);
        controller.close();
      },
    });
    await (await openCache('crimson-video-downloads')).put('/video-offline/e1/file', new Response(body));
    expect(media.append).toHaveBeenCalledTimes(3);
    expect(media.files.get('crimson-video-downloads/video-offline/e1/file').byteLength).toBe(10 * chunk.byteLength);
  });

  it('aborts the write and reports a full drive as a quota error', async () => {
    media.append.mockRejectedValueOnce(new Error("Error invoking remote method 'media:append': Error: ENOSPC: no space left"));
    const put = (await openCache('crimson-video-downloads')).put('/video-offline/e1/v/0', new Response(new Uint8Array([1])));
    await expect(put).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(media.abort).toHaveBeenCalledOnce();
    expect(media.files.size).toBe(0);
  });

  it('lists keys as requests on this origin and deletes them', async () => {
    const cache = await openCache('crimson-music-downloads');
    await cache.put('/music-offline/audio/7', new Response('song'));
    const [request] = await cache.keys();
    expect(new URL(request.url).pathname).toBe('/music-offline/audio/7');
    await cache.delete('/music-offline/audio/7');
    expect(await cache.keys()).toEqual([]);
  });

  it('clears a whole cache and reports the folder usage as an estimate', async () => {
    await (await openCache('crimson-music-preloads')).put('/music-offline/audio/1', new Response('a'));
    await deleteCache('crimson-music-preloads');
    expect(media.files.size).toBe(0);
    expect(await estimate()).toEqual({ usage: 10, quota: 100 });
    expect(servesFiles()).toBe(true);
  });
});
