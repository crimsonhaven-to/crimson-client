import { describe, expect, it } from 'vitest';

import {
  attr, createDecryptor, isMasterPlaylist, parseMaster, parseMedia, pickAudio, pickBestVariant,
  segmentRanges,
} from './hlsPlaylist';

const MASTER = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="audio/en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="German",LANGUAGE="de",URI="audio/de.m3u8"
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9000000,BANDWIDTH=800000,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=640x360,AUDIO="aud"
low/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720,AUDIO="aud"
high/index.m3u8
`;

describe('attr', () => {
  it('reads quoted and bare values', () => {
    expect(attr('#EXT-X-KEY:METHOD=AES-128,URI="k.key"', 'URI')).toBe('k.key');
    expect(attr('#EXT-X-KEY:METHOD=AES-128,URI="k.key"', 'METHOD')).toBe('AES-128');
  });

  it('does not mistake AVERAGE-BANDWIDTH for BANDWIDTH', () => {
    expect(attr('#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9,BANDWIDTH=8', 'BANDWIDTH')).toBe('8');
  });
});

describe('parseMaster', () => {
  it('lists variants and audio renditions, absolute against the playlist', () => {
    expect(isMasterPlaylist(MASTER)).toBe(true);
    const { variants, audio } = parseMaster(MASTER, 'https://cdn.example/v/master.m3u8');
    expect(variants.map((v) => v.url)).toEqual([
      'https://cdn.example/v/low/index.m3u8',
      'https://cdn.example/v/high/index.m3u8',
    ]);
    expect(variants[0]).toMatchObject({ bandwidth: 800000, codecs: 'avc1.4d401f,mp4a.40.2', audio: 'aud' });
    expect(audio.map((a) => a.url)).toEqual([
      'https://cdn.example/v/audio/en.m3u8',
      'https://cdn.example/v/audio/de.m3u8',
    ]);
  });

  it('picks the highest bandwidth and the default audio of its group', () => {
    const { variants, audio } = parseMaster(MASTER, 'https://cdn.example/v/master.m3u8');
    const best = pickBestVariant(variants);
    expect(best.resolution).toBe('1280x720');
    expect(pickAudio(audio, best.audio).language).toBe('en');
    expect(pickAudio(audio, null)).toBeNull();
  });
});

describe('parseMedia', () => {
  const MEDIA = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:7
#EXT-X-MAP:URI="init.mp4"
#EXT-X-KEY:METHOD=AES-128,URI="key.bin"
#EXTINF:6.006,
seg0.m4s
#EXT-X-DISCONTINUITY
#EXT-X-KEY:METHOD=NONE
#EXT-X-MAP:URI="init2.mp4",BYTERANGE="100@0"
#EXTINF:4.5,
seg1.m4s
#EXT-X-ENDLIST
`;

  it('keeps durations, keys, maps and discontinuities per segment', () => {
    const { maps, segments, isFmp4 } = parseMedia(MEDIA, 'https://cdn.example/v/index.m3u8');
    expect(isFmp4).toBe(true);
    expect(maps).toEqual([
      { url: 'https://cdn.example/v/init.mp4', byteRange: null },
      { url: 'https://cdn.example/v/init2.mp4', byteRange: '100@0' },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      url: 'https://cdn.example/v/seg0.m4s', seq: 7, duration: 6.006, discontinuity: false, map: 0,
      key: { uri: 'https://cdn.example/v/key.bin', ivHex: null },
    });
    expect(segments[1]).toMatchObject({ seq: 8, duration: 4.5, discontinuity: true, map: 1, key: null });
  });

  it('refuses encryption it cannot undo', () => {
    expect(() => parseMedia('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="k"\nseg.ts', 'https://x/')).toThrow(/SAMPLE-AES/);
  });
});

describe('segmentRanges', () => {
  it('continues an omitted offset from the previous range', () => {
    const ranges = segmentRanges([{ byteRange: '100@0' }, { byteRange: '50' }, { byteRange: null }]);
    expect(ranges).toEqual(['bytes=0-99', 'bytes=100-149', null]);
  });
});

describe('createDecryptor', () => {
  it('decrypts with the media sequence as IV when none is given, fetching the key once', async () => {
    const raw = new Uint8Array(16).fill(7);
    const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, ['encrypt']);
    const iv = new Uint8Array(16);
    new DataView(iv.buffer).setUint32(12, 3);
    const plain = new TextEncoder().encode('segment payload');
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plain));

    let fetched = 0;
    const decrypt = createDecryptor(async () => { fetched += 1; return raw; });
    const seg = { seq: 3, key: { uri: 'k', ivHex: null } };
    expect(new TextDecoder().decode(await decrypt(seg, cipher))).toBe('segment payload');
    await decrypt(seg, cipher);
    expect(fetched).toBe(1);
  });

  it('passes clear segments through', async () => {
    const decrypt = createDecryptor(async () => { throw new Error('no key needed'); });
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await decrypt({ key: null }, bytes)).toBe(bytes);
  });
});
