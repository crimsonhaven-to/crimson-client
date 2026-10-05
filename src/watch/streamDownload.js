// A browser can't "save as" an HLS playlist into a video, so for HLS we fetch every
// segment, decrypt AES-128 if needed, and concatenate (.ts, or .mp4 for fMP4).
// Fetches go through the same backend proxies as the player, so anything that plays
// is downloadable.
import { fileWriter } from '../deviceCache';
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

// Where the bytes go. A browser can only offer a finished blob to save; the
// desktop app asks for the file first and writes each part as it arrives, so a
// film never sits in memory. null means the member cancelled the save dialog.
async function openSink(filename, type) {
  const media = window.CrimsonNative?.media;
  if (!media) {
    const parts = [];
    return {
      write: async (bytes) => { parts.push(bytes); },
      close: async () => saveBlob(new Blob(parts, { type }), filename),
      abort: async () => {},
    };
  }
  const id = await media.saveAs(filename);
  return id ? fileWriter(media, id) : null;
}

async function into(sink, work) {
  if (!sink) return;
  try {
    await work(sink);
    await sink.close();
  } catch (err) {
    await sink.abort().catch(() => {});
    throw err;
  }
}

async function downloadHls(masterUrl, name, onProgress, signal) {
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

  const total = segments.length + (init ? 1 : 0);
  let done = 0;
  const tick = (label) => onProgress?.(done / total, { received: done, total, label });

  const ext = isFmp4 ? 'mp4' : 'ts';
  const sink = await openSink(`${name}.${ext}`, isFmp4 ? 'video/mp4' : 'video/mp2t');
  await into(sink, async ({ write }) => {
    if (init) {
      await write(await fetchBytes(init.url));
      done++; tick('init');
    }
    const decrypt = createDecryptor(fetchBytes);
    const ranges = segmentRanges(segments);
    for (const [i, seg] of segments.entries()) {
      if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');
      await write(await decrypt(seg, await fetchBytes(seg.url, ranges[i])));
      done++; tick(`segment ${done}/${total}`);
    }
  });
}

async function downloadDirect(url, name, onProgress, signal) {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  // mp4 is the only non-HLS type the backend emits.
  const sink = await openSink(`${name}.mp4`, res.headers.get('content-type') || 'video/mp4');
  if (!sink) {
    await res.body?.cancel();
    return;
  }
  await into(sink, async ({ write }) => {
    if (!res.body?.getReader) {
      onProgress?.(null, { received: 0, total, label: 'downloading' });
      await write(new Uint8Array(await res.arrayBuffer()));
      return;
    }
    const reader = res.body.getReader();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await write(value);
      received += value.length;
      onProgress?.(total ? received / total : null, { received, total, label: 'downloading' });
    }
  });
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
  await (isHlsUrl(url, type) ? downloadHls : downloadDirect)(url, sanitize(name), onProgress, signal);
}

export const isDownloadable = (stream) =>
  !!stream && stream.type !== 'iframe' && typeof stream.url === 'string';
