// HLS playlist parsing and segment decryption, shared by the one-shot file
// download and the offline copies, which both fetch every segment themselves.

// attr('#EXT-X-KEY:METHOD=AES-128,URI="k.key"', 'URI') -> 'k.key'
export function attr(line, name) {
  const m = line.match(new RegExp(`(?:^|[:,])${name}=("[^"]*"|[^,]*)`));
  if (!m) return null;
  return m[1].replace(/^"|"$/g, '');
}

export const isMasterPlaylist = (text) => text.includes('#EXT-X-STREAM-INF');

export function parseMaster(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  const variants = [];
  const audio = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const uri = (lines[i + 1] || '').trim();
      if (!uri || uri.startsWith('#')) continue;
      variants.push({
        url: new URL(uri, baseUrl).href,
        bandwidth: parseInt(attr(line, 'BANDWIDTH') || '0', 10),
        codecs: attr(line, 'CODECS'),
        resolution: attr(line, 'RESOLUTION'),
        audio: attr(line, 'AUDIO'),
      });
    } else if (line.startsWith('#EXT-X-MEDIA') && attr(line, 'TYPE') === 'AUDIO') {
      const uri = attr(line, 'URI');
      audio.push({
        groupId: attr(line, 'GROUP-ID'),
        name: attr(line, 'NAME'),
        language: attr(line, 'LANGUAGE'),
        isDefault: attr(line, 'DEFAULT') === 'YES',
        // Without a URI the audio is muxed into the variant's own segments.
        url: uri ? new URL(uri, baseUrl).href : null,
      });
    }
  }
  return { variants, audio };
}

export function pickBestVariant(variants) {
  let best = null;
  for (const v of variants) if (!best || v.bandwidth > best.bandwidth) best = v;
  return best;
}

// The variant's audio group, its DEFAULT rendition first. Null when the audio is
// muxed into the video segments.
export function pickAudio(audio, groupId) {
  if (!groupId) return null;
  const group = audio.filter((a) => a.groupId === groupId && a.url);
  return group.find((a) => a.isDefault) || group[0] || null;
}

export function parseMedia(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  let seq = 0;
  let key = null;
  let pendingRange = null;
  let pendingDuration = 0;
  let pendingDiscontinuity = false;
  let map = null;
  const maps = [];
  const segments = [];
  let isFmp4 = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
      seq = parseInt(line.split(':')[1] || '0', 10) || 0;
    } else if (line.startsWith('#EXTINF')) {
      pendingDuration = parseFloat(line.slice(line.indexOf(':') + 1)) || 0;
    } else if (line.startsWith('#EXT-X-DISCONTINUITY') && !line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE')) {
      pendingDiscontinuity = true;
    } else if (line.startsWith('#EXT-X-MAP')) {
      const uri = attr(line, 'URI');
      if (uri) {
        maps.push({ url: new URL(uri, baseUrl).href, byteRange: attr(line, 'BYTERANGE') });
        map = maps.length - 1;
        isFmp4 = true;
      }
    } else if (line.startsWith('#EXT-X-KEY')) {
      const method = attr(line, 'METHOD');
      if (!method || method === 'NONE') {
        key = null;
      } else if (method === 'AES-128') {
        key = { uri: new URL(attr(line, 'URI'), baseUrl).href, ivHex: attr(line, 'IV') };
      } else {
        throw new Error(`Unsupported HLS encryption (${method}); cannot download this source.`);
      }
    } else if (line.startsWith('#EXT-X-BYTERANGE')) {
      pendingRange = line.split(':')[1];
    } else if (line && !line.startsWith('#')) {
      if (/\.(m4s|mp4)(\?|$)/i.test(line)) isFmp4 = true;
      segments.push({
        url: new URL(line, baseUrl).href,
        key,
        seq,
        byteRange: pendingRange,
        duration: pendingDuration,
        discontinuity: pendingDiscontinuity,
        map,
      });
      pendingRange = null;
      pendingDuration = 0;
      pendingDiscontinuity = false;
      seq++;
    }
  }
  return { maps, segments, isFmp4 };
}

// EXT-X-BYTERANGE is "<len>[@<offset>]"; an omitted offset continues from the
// previous range of the same resource.
export function byteRangeHeader(value, state) {
  const [lenStr, offStr] = value.split('@');
  const len = parseInt(lenStr, 10);
  const offset = offStr != null ? parseInt(offStr, 10) : state.next;
  state.next = offset + len;
  return `bytes=${offset}-${offset + len - 1}`;
}

// The Range header of every segment, worked out up front so segments can be
// fetched out of order.
export function segmentRanges(segments) {
  const state = { next: 0 };
  return segments.map((seg) => (seg.byteRange ? byteRangeHeader(seg.byteRange, state) : null));
}

// HLS spec: without an explicit IV, the IV is the media-sequence number, big-endian
// in 16 bytes.
function sequenceIv(seq) {
  const iv = new Uint8Array(16);
  new DataView(iv.buffer).setUint32(12, seq >>> 0);
  return iv;
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/i, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

// fetchKey(uri) returns the raw key bytes. Most playlists reuse one key for every
// segment, so each is fetched once.
export function createDecryptor(fetchKey) {
  const keys = new Map();
  const cryptoKey = (uri) => {
    if (!keys.has(uri)) {
      keys.set(uri, fetchKey(uri).then((raw) =>
        crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, ['decrypt'])));
    }
    return keys.get(uri);
  };
  return async (seg, bytes) => {
    if (!seg.key) return bytes;
    const iv = seg.key.ivHex ? hexToBytes(seg.key.ivHex) : sequenceIv(seg.seq);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, await cryptoKey(seg.key.uri), bytes));
  };
}
