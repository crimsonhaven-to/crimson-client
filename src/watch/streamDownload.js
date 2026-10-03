// A browser can't "save as" an HLS playlist into a video, so for HLS we fetch every
// segment, decrypt AES-128 if needed, and concatenate (.ts, or .mp4 for fMP4).
// Fetches go through the same backend proxies as the player, so anything that plays
// is downloadable.
import {
  createDecryptor, isMasterPlaylist, parseMaster, parseMedia, pickBestVariant, segmentRanges,
} from './hlsPlaylist';

const sanitize = (name) =>
  (name || 'video')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) || 'video';

export const isHlsUrl = (url, type) =>
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

async function downloadHls(masterUrl, onProgress, signal) {
  let playlistUrl = masterUrl;
  let text = await fetchText(masterUrl);

  if (isMasterPlaylist(text)) {
    const variant = pickBestVariant(parseMaster(text, masterUrl).variants);
    if (!variant) throw new Error('No playable variant found in this playlist.');
    playlistUrl = variant.url;
    text = await fetchText(playlistUrl);
  }

  const { maps, segments, isFmp4 } = parseMedia(text, playlistUrl);
  if (!segments.length) throw new Error('Playlist contained no segments.');
  const init = maps[0];

  const parts = [];
  const total = segments.length + (init ? 1 : 0);
  let done = 0;
  const tick = (label) => onProgress?.(done / total, { received: done, total, label });

  if (init) {
    parts.push(await fetchBytes(init.url));
    done++; tick('init');
  }

  const decrypt = createDecryptor(fetchBytes);
  const ranges = segmentRanges(segments);
  for (const [i, seg] of segments.entries()) {
    if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');
    parts.push(await decrypt(seg, await fetchBytes(seg.url, ranges[i])));
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
  // mp4 is the only non-HLS type the backend emits.
  const ext = 'mp4';

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
  // Revoking immediately can cancel the download before the browser grabs the URL.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// onProgress(fraction, { received, total, label }): fraction is null when the size is unknown.
export async function downloadStream({ url, type, name }, onProgress, signal) {
  if (!url) throw new Error('This source has no downloadable file.');
  const { blob, ext } = isHlsUrl(url, type)
    ? await downloadHls(url, onProgress, signal)
    : await downloadDirect(url, onProgress, signal);
  saveBlob(blob, `${sanitize(name)}.${ext}`);
}

export const isDownloadable = (stream) =>
  !!stream && stream.type !== 'iframe' && typeof stream.url === 'string';
