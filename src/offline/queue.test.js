import { beforeEach, describe, expect, it, vi } from 'vitest';

const sources = vi.hoisted(() => {
  const listeners = new Set();
  return {
    watching: false,
    listeners,
    setWatching(value) {
      this.watching = value;
      for (const listener of listeners) listener();
    },
  };
});

vi.mock('../sources/clientSources', () => ({
  isWatching: () => sources.watching,
  onWatchingChange: (listener) => {
    sources.listeners.add(listener);
    return () => sources.listeners.delete(listener);
  },
}));
vi.mock('./resolve', () => ({ NotFoundError: class NotFoundError extends Error {}, resolveStream: vi.fn() }));
vi.mock('./storeVideo', () => ({
  FatalDownloadError: class FatalDownloadError extends Error {},
  storeVideo: vi.fn(),
  storeSubtitles: vi.fn(async () => []),
  storePoster: vi.fn(async () => true),
}));
vi.mock('./videoStore', () => ({
  supported: () => true,
  read: vi.fn(async () => null),
  posterKey: (key) => key,
  forgetEntry: vi.fn(async () => {}),
  forgetPoster: vi.fn(async () => {}),
  forgetAll: vi.fn(async () => {}),
}));

import { resolveStream } from './resolve';
import { storeVideo } from './storeVideo';
import {
  failureReason, forgetVideoDownloads, removeDownload, removeIfWatched, retryFailed, saveOffline, setAutoDelete, setPaused,
} from './queue';
import { getState, patchEntry } from './store';

const item = (episode) => ({
  id: `tv-1-s1-e${episode}`, titleKey: 'tv-1', titleName: 'Show', kind: 'episode', season: 1, episode,
  target: { path: `/watch/1/1/${episode}`, ctx: {} },
});
const wanted = { source: 'PlayIMDb', language: null };

const settled = (id) => vi.waitFor(() => {
  const status = getState().entries[id]?.status;
  if (status !== 'done' && status !== 'failed') throw new Error(`still ${status}`);
  return status;
});

describe('queue', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sources.watching = false;
    await forgetVideoDownloads();
    await setPaused(false);
    await setAutoDelete(false);
    storeVideo.mockResolvedValue({ format: 'hls', bytes: 10 });
  });

  it('downloads the link the watch page handed over without resolving again', async () => {
    const stream = { source: 'PlayIMDb', url: 'https://cdn/1.m3u8' };
    await saveOffline([item(1)], { stream, wanted });
    expect(await settled('tv-1-s1-e1')).toBe('done');
    expect(resolveStream).not.toHaveBeenCalled();
    expect(storeVideo.mock.calls[0][1]).toBe(stream);
    expect(getState().entries['tv-1-s1-e1']).toMatchObject({ source: 'PlayIMDb', bytes: 10 });
  });

  it('does not resolve the next episode while a player is open', async () => {
    sources.watching = true;
    resolveStream.mockResolvedValue({ source: 'PlayIMDb', url: 'https://cdn/2.m3u8' });
    await saveOffline([item(2)], { stream: null, wanted });
    await vi.waitFor(() => expect(getState().waiting).toBe('player'));
    expect(resolveStream).not.toHaveBeenCalled();

    sources.setWatching(false);
    expect(await settled('tv-1-s1-e2')).toBe('done');
    expect(resolveStream).toHaveBeenCalledTimes(1);
    expect(getState().waiting).toBeNull();
  });

  it('fetches a fresh link when the first one dies, and gives up after three', async () => {
    resolveStream.mockResolvedValue({ source: 'PlayIMDb', url: 'https://cdn/fresh.m3u8' });
    storeVideo.mockRejectedValueOnce(new Error('HTTP 403'));
    await saveOffline([item(3)], { stream: { source: 'PlayIMDb', url: 'https://cdn/old.m3u8' }, wanted });
    expect(await settled('tv-1-s1-e3')).toBe('done');
    expect(storeVideo.mock.calls[1][1].url).toBe('https://cdn/fresh.m3u8');

    storeVideo.mockRejectedValue(new Error('HTTP 403'));
    await saveOffline([item(4)], { stream: null, wanted });
    expect(await settled('tv-1-s1-e4')).toBe('failed');
    expect(resolveStream).toHaveBeenCalledTimes(1 + 3);
    expect(getState().entries['tv-1-s1-e4'].error).toMatch(/blocked/);

    storeVideo.mockResolvedValue({ format: 'hls', bytes: 10 });
    retryFailed();
    expect(await settled('tv-1-s1-e4')).toBe('done');
  });

  it('holds the queue while paused and carries on when resumed', async () => {
    await setPaused(true);
    await saveOffline([item(6)], { stream: { source: 'PlayIMDb', url: 'u' }, wanted });
    expect(getState().entries['tv-1-s1-e6'].status).toBe('queued');
    expect(storeVideo).not.toHaveBeenCalled();

    await setPaused(false);
    expect(await settled('tv-1-s1-e6')).toBe('done');
  });

  it('removes a watched copy only when asked to', async () => {
    await saveOffline([item(7)], { stream: { source: 'PlayIMDb', url: 'u' }, wanted });
    await settled('tv-1-s1-e7');
    patchEntry('tv-1-s1-e7', { position: 1390, duration: 1400 });

    await removeIfWatched('tv-1-s1-e7');
    expect(getState().entries['tv-1-s1-e7']).toBeDefined();
    await setAutoDelete(true);
    expect(getState().entries['tv-1-s1-e7']).toBeUndefined();
  });

  it('cancels a running download when it is removed', async () => {
    storeVideo.mockImplementation((_id, _stream, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
    }));
    await saveOffline([item(5)], { stream: { source: 'PlayIMDb', url: 'u' }, wanted });
    await vi.waitFor(() => expect(storeVideo).toHaveBeenCalled());
    await removeDownload('tv-1-s1-e5');
    expect(getState().entries['tv-1-s1-e5']).toBeUndefined();
  });
});

describe('failureReason', () => {
  it('turns hoster status codes into what to do', () => {
    expect(failureReason(new Error('HTTP 403'))).toMatch(/blocked/);
    expect(failureReason(new Error('HTTP 404'))).toMatch(/no longer has/);
    expect(failureReason(new Error('HTTP 502'))).toMatch(/trouble/);
    expect(failureReason(new TypeError('Failed to fetch'))).toMatch(/connection/);
    expect(failureReason(new Error('something else'))).toBe('something else');
  });
});
