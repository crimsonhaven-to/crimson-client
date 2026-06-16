// streamDownload.js — pull the currently-playing source down to a local file.
//
// The backend hands the player a "raw" URL, but "raw" means two different
// things:
//   * type === 'mp4'  -> a single progressive file. We just stream it to a Blob.
//   * type === 'hls'  -> an .m3u8 *playlist*, NOT one file. A browser can't
//     "save as" a playlist into a video, so we fetch every segment ourselves,
//     decrypt them when the playlist is AES-128 encrypted, concatenate, and hand
//     back one Blob (a .ts for MPEG-TS segments, an .mp4 when the playlist uses
//     fMP4 segments + an EXT-X-MAP init segment).
//
// Everything is fetched the same way the player fetches it (plain same-origin /
// CORS GETs through the backend proxies), so anything that plays in
// CrimsonPlayer is downloadable here. iframe sources have no raw URL and are
// never routed through this module.
//
// onProgress(fraction, { received, total, label }) is called as work proceeds.
// `fraction` is 0..1, or null when the total size is unknown (mp4 without a
// Content-Length); callers should fall back to an indeterminate spinner then.

const sanitize = (name) =>
  (name || 'video')
    .replace(/[\\/:*?"<>|]+/g, ' ') // characters illegal in filenames
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) || 'video';

const isHlsUrl = (url, type) =>
  type === 'hls' || (typeof url === 'string' && url.toLowerCase().split('?')[0].endsWith('.m3u8'));

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Playlist fetch failed (HTTP ${res.status})`);
  return res.text();
}

async function fetchBytes(url, rangeHeader) {
  const res = await fetch(url, rangeHeader ? { headers: { Range: rangeHeader } } : undefined);
  if (!res.ok && res.status !== 206) throw new Error(`Segment fetch failed (HTTP ${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

// Build the 128-bit IV HLS uses when a key line omits an explicit IV: the
// segment's media-sequence number, big-endian, right-aligned in 16 bytes.
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

// Pull a quoted/bare attribute out of an EXT-X tag line, e.g.
// attr('#EXT-X-KEY:METHOD=AES-128,URI="k.key"', 'URI') -> 'k.key'.
function attr(line, name) {
  const m = line.match(new RegExp(`${name}=("[^"]*"|[^,]*)`));
  if (!m) return null;
  return m[1].replace(/^"|"$/g, '');
}

// From a master playlist, pick the highest-bandwidth variant (best quality).
function pickBestVariant(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const bandwidth = parseInt(attr(lines[i], 'BANDWIDTH') || '0', 10);
      const uri = (lines[i + 1] || '').trim();
      if (uri && !uri.startsWith('#') && (!best || bandwidth > best.bandwidth)) {
        best = { bandwidth, url: new URL(uri, baseUrl).href };
      }
    }
  }
  return best?.url || null;
}

// Parse a media playlist into the ordered work list we need to reconstruct it.
function parseMedia(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  let seq = 0;          // current media-sequence counter
  let key = null;       // { uri, ivHex|null } currently in force, or null
  let pendingRange = null; // EXT-X-BYTERANGE for the next segment
  let initUri = null;   // EXT-X-MAP init segment (fMP4)
  const segments = [];
  let isFmp4 = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
      seq = parseInt(line.split(':')[1] || '0', 10) || 0;
    } else if (line.startsWith('#EXT-X-MAP')) {
      const uri = attr(line, 'URI');
      if (uri) { initUri = new URL(uri, baseUrl).href; isFmp4 = true; }
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
      const url = new URL(line, baseUrl).href;
      if (/\.(m4s|mp4)(\?|$)/i.test(line)) isFmp4 = true;
      segments.push({ url, key, seq, byteRange: pendingRange });
      pendingRange = null;
      seq++;
    }
  }
  return { initUri, segments, isFmp4 };
}

// Turn an EXT-X-BYTERANGE value ("<len>[@<offset>]") into an HTTP Range header,
// tracking the running offset for entries that omit it.
function byteRangeHeader(value, state) {
  const [lenStr, offStr] = value.split('@');
  const len = parseInt(lenStr, 10);
  const offset = offStr != null ? parseInt(offStr, 10) : state.next;
  state.next = offset + len;
  return `bytes=${offset}-${offset + len - 1}`;
}

async function downloadHls(masterUrl, onProgress, signal) {
  let playlistUrl = masterUrl;
  let text = await fetchText(masterUrl);

  // Master playlist? Resolve to the best variant's media playlist first.
  if (text.includes('#EXT-X-STREAM-INF')) {
    const variant = pickBestVariant(text, masterUrl);
    if (!variant) throw new Error('No playable variant found in this playlist.');
    playlistUrl = variant;
    text = await fetchText(playlistUrl);
  }

  const { initUri, segments, isFmp4 } = parseMedia(text, playlistUrl);
  if (!segments.length) throw new Error('Playlist contained no segments.');

  const parts = [];
  const total = segments.length + (initUri ? 1 : 0);
  let done = 0;
  const tick = (label) => onProgress?.(done / total, { received: done, total, label });

  if (initUri) {
    parts.push(await fetchBytes(initUri));
    done++; tick('init');
  }

  // Decryption-key cache (most playlists reuse one key for every segment).
  const keyCache = new Map();
  const getCryptoKey = async (uri) => {
    if (!keyCache.has(uri)) {
      const raw = await fetchBytes(uri);
      keyCache.set(uri, crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, ['decrypt']));
    }
    return keyCache.get(uri);
  };

  const rangeState = { next: 0 };
  for (const seg of segments) {
    if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');
    const range = seg.byteRange ? byteRangeHeader(seg.byteRange, rangeState) : null;
    let bytes = await fetchBytes(seg.url, range);
    if (seg.key) {
      const cryptoKey = await getCryptoKey(seg.key.uri);
      const iv = seg.key.ivHex ? hexToBytes(seg.key.ivHex) : sequenceIv(seg.seq);
      bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, bytes));
    }
    parts.push(bytes);
    done++; tick(`segment ${done}/${total}`);
  }

  const ext = isFmp4 ? 'mp4' : 'ts';
  return { blob: new Blob(parts, { type: isFmp4 ? 'video/mp4' : 'video/mp2t' }), ext };
}

async function downloadDirect(url, onProgress, signal) {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const contentType = res.headers.get('content-type') || 'video/mp4';
  // Progressive sources are mp4 in practice (the only non-HLS type the backend
  // emits); keep the extension simple rather than guessing exotic containers.
  const ext = 'mp4';

  // Stream the body so we can report progress instead of blocking on one big
  // .blob() call; falls back to .blob() if the body isn't a readable stream.
  if (!res.body || !res.body.getReader) {
    onProgress?.(null, { received: 0, total, label: 'downloading' });
    return { blob: await res.blob(), ext };
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(total ? received / total : null, { received, total, label: 'downloading' });
  }
  return { blob: new Blob(chunks, { type: contentType }), ext };
}

function saveBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the navigation has grabbed the URL first.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Download the given stream to the user's disk.
 *
 * @param {{url: string, type?: string, name?: string}} stream
 * @param {(fraction: number|null, info: object) => void} [onProgress]
 * @param {AbortSignal} [signal]
 */
export async function downloadStream({ url, type, name }, onProgress, signal) {
  if (!url) throw new Error('This source has no downloadable file.');
  const { blob, ext } = isHlsUrl(url, type)
    ? await downloadHls(url, onProgress, signal)
    : await downloadDirect(url, onProgress, signal);
  saveBlob(blob, `${sanitize(name)}.${ext}`);
}

// True only for sources we can actually pull a file from (not iframes).
export const isDownloadable = (stream) =>
  !!stream && stream.type !== 'iframe' && typeof stream.url === 'string';
