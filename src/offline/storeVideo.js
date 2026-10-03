// Fetches one resolved stream into the device's video cache. Every request goes
// straight from this tab, like the player's, so anything that plays can be kept:
// the companion's header rules and the signed proxy links apply here too.
//
// A HLS copy can resume: segments already kept are skipped, as long as a fresh
// link comes from the same source and still cuts the video the same way.
import { isHlsUrl } from '../watch/streamDownload';
import {
  byteRangeHeader, createDecryptor, isMasterPlaylist, parseMaster, parseMedia, pickAudio,
  pickBestVariant, segmentRanges,
} from '../watch/hlsPlaylist';
import { layoutOf, masterPlaylist, mediaPlaylist } from './localPlaylist';
import {
  fileKey, forgetEntry, initKey, playlistKey, posterKey, putBytes, putResponse, segmentKey,
  storedKeys, subtitleKey,
} from './videoStore';

// Hosters throttle a burst of parallel requests from one viewer; four keeps a
// download well ahead of real time without tripping that.
const CONCURRENCY = 4;
const ATTEMPTS = 3;

// The same every time it is tried again, so the queue gives up at once instead
// of fetching a fresh link.
export class FatalDownloadError extends Error {}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Download cancelled', 'AbortError'));
    }, { once: true });
  });
}

async function fetchOk(url, { signal, range } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal, headers: range ? { Range: range } : {} });
      if (res.ok) return res;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (err.name === 'AbortError' || attempt >= ATTEMPTS) throw err;
      await sleep(attempt * 1500, signal);
    }
  }
}

async function store(put) {
  try {
    await put();
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      throw new FatalDownloadError('Not enough storage left on this device.');
    }
    throw err;
  }
}

function parse(text, url) {
  try {
    return parseMedia(text, url);
  } catch (err) {
    throw new FatalDownloadError(err.message);
  }
}

async function fetchText(url, signal) {
  return (await fetchOk(url, { signal })).text();
}

// Stops every worker once one fails, so a dead link is not hammered by the rest.
async function inPool(jobs, work) {
  let next = 0;
  let failed = null;
  const worker = async () => {
    while (!failed && next < jobs.length) {
      const job = jobs[next++];
      try {
        await work(job);
      } catch (err) {
        failed ||= err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  if (failed) throw failed;
}

async function readTracks(url, signal) {
  const text = await fetchText(url, signal);
  if (!isMasterPlaylist(text)) return { variant: null, tracks: [{ name: 'v', media: parse(text, url) }] };

  const master = parseMaster(text, url);
  const variant = pickBestVariant(master.variants);
  if (!variant) throw new FatalDownloadError('This source lists no playable quality.');
  const tracks = [{ name: 'v', media: parse(await fetchText(variant.url, signal), variant.url) }];
  const audio = pickAudio(master.audio, variant.audio);
  if (audio) tracks.push({ name: 'a', media: parse(await fetchText(audio.url, signal), audio.url) });
  return { variant, tracks };
}

function jobsFor(id, { name, media }) {
  const ranges = segmentRanges(media.segments);
  return [
    ...media.maps.map((map, n) => ({
      key: initKey(id, name, n),
      url: map.url,
      range: map.byteRange ? byteRangeHeader(map.byteRange, { next: 0 }) : null,
    })),
    ...media.segments.map((seg, n) => ({ key: segmentKey(id, name, n), url: seg.url, range: ranges[n], seg })),
  ];
}

// onProgress({ done, total, bytes, layout }): done and total count segments.
async function storeHls(id, stream, { signal, onProgress, layout, bytes = 0 }) {
  const { variant, tracks } = await readTracks(stream.url, signal);
  if (!tracks[0].media.segments.length) throw new FatalDownloadError('This source has no video in it.');

  const newLayout = `${stream.source}|${layoutOf(tracks)}`;
  if (layout && layout !== newLayout) {
    await forgetEntry(id);
    bytes = 0;
  }
  const have = await storedKeys(id);
  const jobs = tracks.flatMap((track) => jobsFor(id, track));
  const todo = jobs.filter((job) => !have.has(job.key));
  let done = jobs.length - todo.length;
  onProgress({ done, total: jobs.length, bytes, layout: newLayout });

  const decrypt = createDecryptor(async (uri) =>
    new Uint8Array(await (await fetchOk(uri, { signal })).arrayBuffer()));
  await inPool(todo, async (job) => {
    let data = new Uint8Array(await (await fetchOk(job.url, { signal, range: job.range })).arrayBuffer());
    if (job.seg) data = await decrypt(job.seg, data);
    await store(() => putBytes(job.key, data));
    done += 1;
    bytes += data.byteLength;
    onProgress({ done, total: jobs.length, bytes, layout: newLayout });
  });

  const type = 'application/vnd.apple.mpegurl';
  for (const { name, media } of tracks) {
    await store(() => putBytes(playlistKey(id, name), mediaPlaylist(name, media), type));
  }
  const index = tracks.length > 1 ? masterPlaylist(variant) : mediaPlaylist('v', tracks[0].media);
  await store(() => putBytes(playlistKey(id, 'index'), index, type));
  return { format: 'hls', bytes };
}

async function storeFile(id, stream, { signal, onProgress }) {
  const res = await fetchOk(stream.url, { signal });
  const total = Number(res.headers.get('content-length')) || 0;
  let bytes = 0;
  const counted = res.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      onProgress({ done: bytes, total, bytes });
      controller.enqueue(chunk);
    },
  }));
  const type = res.headers.get('content-type') || 'video/mp4';
  // Streams straight to disk; a whole film never sits in memory.
  await store(() => putResponse(fileKey(id), new Response(counted, { headers: { 'Content-Type': type } })));
  return { format: 'mp4', bytes };
}

export function storeVideo(id, stream, opts) {
  return isHlsUrl(stream.url, stream.type) ? storeHls(id, stream, opts) : storeFile(id, stream, opts);
}

// Best effort: a copy without its subtitles still plays. Returns the tracks kept.
export async function storeSubtitles(id, subtitles, signal) {
  const kept = [];
  for (const [n, sub] of subtitles.entries()) {
    try {
      const res = await fetchOk(sub.url, { signal });
      await store(() => putResponse(subtitleKey(id, n), res));
      kept.push({ n, lang: sub.lang || null, label: sub.label || sub.lang || `Track ${n + 1}` });
    } catch (err) {
      if (err.name === 'AbortError' || err instanceof FatalDownloadError) throw err;
    }
  }
  return kept;
}

export async function storePoster(titleKey, url) {
  if (!url) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    await putResponse(posterKey(titleKey), res);
    return true;
  } catch {
    return false;
  }
}
