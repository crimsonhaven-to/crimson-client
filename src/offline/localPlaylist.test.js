import { describe, expect, it } from 'vitest';

import { layoutOf, masterPlaylist, mediaPlaylist } from './localPlaylist';

describe('mediaPlaylist', () => {
  it('points every segment at its cache key, without keys or byte ranges', () => {
    const text = mediaPlaylist('v', {
      isFmp4: false,
      maps: [],
      segments: [
        { duration: 6.006, discontinuity: false, map: null, key: { uri: 'k' }, byteRange: '10@0' },
        { duration: 4, discontinuity: true, map: null, key: null, byteRange: null },
      ],
    });
    expect(text).toBe([
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:7',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXTINF:6.006,',
      'v/0',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:4.000,',
      'v/1',
      '#EXT-X-ENDLIST',
      '',
    ].join('\n'));
    expect(text).not.toMatch(/EXT-X-KEY|BYTERANGE/);
  });

  it('repeats the init segment only where it changes', () => {
    const text = mediaPlaylist('a', {
      isFmp4: true,
      maps: [{ url: 'i0' }, { url: 'i1' }],
      segments: [{ duration: 2, map: 0 }, { duration: 2, map: 0 }, { duration: 2, map: 1, discontinuity: true }],
    });
    expect(text.match(/EXT-X-MAP/g)).toHaveLength(2);
    expect(text).toContain('#EXT-X-VERSION:7');
    expect(text).toContain('#EXT-X-DISCONTINUITY\n#EXT-X-MAP:URI="a/init1"');
  });
});

describe('masterPlaylist', () => {
  it('ties the kept video to the kept audio rendition', () => {
    const text = masterPlaylist({ bandwidth: 2400000, codecs: 'avc1,mp4a', resolution: '1280x720' });
    expect(text).toContain('URI="a.m3u8"');
    expect(text).toContain('#EXT-X-STREAM-INF:BANDWIDTH=2400000,CODECS="avc1,mp4a",RESOLUTION=1280x720,AUDIO="audio"\nv.m3u8');
  });
});

describe('layoutOf', () => {
  it('changes when a fresh link cuts the video differently', () => {
    const media = (n) => ({ segments: Array(n).fill({}), maps: [] });
    expect(layoutOf([{ name: 'v', media: media(3) }])).toBe('v:3:0');
    expect(layoutOf([{ name: 'v', media: media(3) }])).not.toBe(layoutOf([{ name: 'v', media: media(4) }]));
  });
});
