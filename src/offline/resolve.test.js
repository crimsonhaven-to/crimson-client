import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../sources/clientSources', () => ({
  clientSourcesEnabled: () => true,
  streamLocalSources: vi.fn(),
}));
vi.mock('../api/ndjson', () => ({ streamWatchNdjson: vi.fn() }));

import { streamLocalSources } from '../sources/clientSources';
import { streamWatchNdjson } from '../api/ndjson';
import { NotFoundError, matchStream, resolveStream } from './resolve';

const line = (source, url, extra = {}) => JSON.stringify({ type: 'stream', source, streamType: 'hls', url, language: null, ...extra });

describe('matchStream', () => {
  const streams = [
    { source: 'Embed', type: 'iframe', url: 'https://e/1' },
    { source: 'ScreenScape · MovieBox (720p)', type: 'hls', url: 'https://s/720', language: null },
    { source: 'HDRezka', type: 'mp4', url: 'https://h/de', language: 'German' },
  ];

  it('prefers the exact source the member picked', () => {
    expect(matchStream(streams, { source: 'HDRezka', language: 'German' }).url).toBe('https://h/de');
  });

  it('falls back to another server of the same provider', () => {
    expect(matchStream(streams, { source: 'ScreenScape · MovieBox (1080p)', language: null }).url).toBe('https://s/720');
  });

  it('never swaps the language or picks an embed', () => {
    expect(matchStream(streams, { source: 'HDRezka', language: 'English' })).toBeNull();
    expect(matchStream(streams, { source: 'Embed', language: null })).toBeNull();
  });
});

describe('resolveStream', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves in the background and takes the local copy over the backend one', async () => {
    streamWatchNdjson.mockImplementation(async (_path, { onLine }) => onLine(line('PlayIMDb', 'https://backend/proxy')));
    streamLocalSources.mockImplementation(async (_ctx, { onLine }) => {
      await Promise.resolve();
      onLine(line('PlayIMDb', 'https://cdn/direct'));
    });
    const stream = await resolveStream({ path: '/watch/movie/1', ctx: { tmdbId: '1' } }, { source: 'PlayIMDb', language: null });
    expect(stream.url).toBe('https://cdn/direct');
    expect(streamLocalSources.mock.calls[0][1].background).toBe(true);
  });

  it('says why when the source has nothing', async () => {
    streamWatchNdjson.mockImplementation(async (_path, { onLine }) => onLine(JSON.stringify({ type: 'unaired', air_date: '2099-01-01' })));
    streamLocalSources.mockResolvedValue(new Set());
    await expect(resolveStream({ path: '/p', ctx: {} }, { source: 'X', language: null }))
      .rejects.toThrow(new NotFoundError('Not aired yet.'));
  });
});
