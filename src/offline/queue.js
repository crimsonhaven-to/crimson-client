// Runs the downloads, one at a time, in this tab. A tab that closes mid-download
// picks up where it stopped the next time the app starts.
//
// Links expire and the companion's header rules are per tab, so a queued
// download finds its own fresh link right before it starts (resolve.js). That
// resolve clears the rules the player depends on, and a watch page's resolve
// clears the download's, so the queue never resolves while a watch page is
// open. A download whose link dies meanwhile waits for the player to close,
// fetches a fresh link and carries on from the segment it stopped at.
import { isWatching, onWatchingChange } from '../sources/clientSources';
import { getPlaybackPrefs } from '../account/playbackPrefs';
import { fetchSubtitles } from '../watch/media';
import { resolveStream } from './resolve';
import {
  FatalDownloadError, storePoster, storeSubtitles, storeVideo,
} from './storeVideo';
import { forgetAll, forgetEntry, forgetPoster, posterKey, read, supported } from './videoStore';
import {
  dropEntry, getState, nextQueued, patchEntry, putEntries, resetAll, setProgress, setWaiting,
} from './store';

// A link a watch page just resolved is used as is for this long; older ones
// have likely expired.
const FRESH_FOR_MS = 10 * 60 * 1000;
// Fresh links fetched for one download before it is marked failed.
const RESOLVES = 3;
const PERSIST_EVERY_MS = 5000;

const fresh = new Map();
let current = null;

function takeFresh(id) {
  const handed = fresh.get(id);
  fresh.delete(id);
  return handed && Date.now() - handed.at < FRESH_FOR_MS ? handed.stream : null;
}

const cancelled = () => new DOMException('Download cancelled', 'AbortError');

function whenResolveAllowed(signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      offWatching();
      window.removeEventListener('online', check);
      signal.removeEventListener('abort', onAbort);
      setWaiting(null);
    };
    function check() {
      const reason = !navigator.onLine ? 'offline' : isWatching() ? 'player' : null;
      setWaiting(reason);
      if (reason) return;
      cleanup();
      resolve();
    }
    function onAbort() {
      cleanup();
      reject(cancelled());
    }
    const offWatching = onWatchingChange(check);
    window.addEventListener('online', check);
    signal.addEventListener('abort', onAbort, { once: true });
    check();
  });
}

// Null when a watch page opened during the resolve; the queue waits and tries again.
async function resolveUnlessWatched(entry, signal) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener('abort', stop, { once: true });
  const offWatching = onWatchingChange(() => { if (isWatching()) stop(); });
  try {
    return await resolveStream(entry.target, entry.wanted, controller.signal);
  } catch (err) {
    if (signal.aborted) throw err;
    if (controller.signal.aborted) return null;
    throw err;
  } finally {
    offWatching();
    signal.removeEventListener('abort', stop);
  }
}

async function keepSubtitles(entry, stream, signal) {
  const languages = getPlaybackPrefs().subtitleLanguages || [];
  const extra = entry.subtitleQuery && languages.length
    ? await fetchSubtitles({ ...entry.subtitleQuery, languages })
    : [];
  const own = Array.isArray(stream.subtitles) ? stream.subtitles : [];
  const seen = new Set(own.map((s) => s?.url));
  const all = [...own, ...extra.filter((s) => !seen.has(s.url))].filter((s) => s?.url);
  return storeSubtitles(entry.id, all, signal);
}

async function download(id, signal) {
  let stream = takeFresh(id);
  let failures = 0;
  for (;;) {
    if (!stream) {
      await whenResolveAllowed(signal);
      stream = await resolveUnlessWatched(getState().entries[id], signal);
      if (!stream) continue;
    }

    let persistedAt = Date.now();
    const onProgress = (progress) => {
      setProgress(id, progress);
      if (Date.now() - persistedAt > PERSIST_EVERY_MS || progress.layout !== getState().entries[id]?.layout) {
        persistedAt = Date.now();
        patchEntry(id, { bytes: progress.bytes, layout: progress.layout ?? null });
      }
    };
    const entry = getState().entries[id];
    try {
      const { format, bytes } = await storeVideo(id, stream, {
        signal, onProgress, layout: entry.layout, bytes: entry.bytes || 0,
      });
      const subtitles = await keepSubtitles(entry, stream, signal);
      return { format, bytes, subtitles, source: stream.source, language: stream.language || null };
    } catch (err) {
      if (signal.aborted || err instanceof FatalDownloadError) throw err;
      // Losing the connection or the player taking the rules is not the
      // source's fault, so only other failures count against it.
      if (navigator.onLine && !isWatching()) failures += 1;
      if (failures >= RESOLVES) throw err;
      stream = null;
    }
  }
}

function kick() {
  if (current || !supported()) return;
  const entry = nextQueued(getState().entries);
  if (!entry) return;
  const controller = new AbortController();
  const { id } = entry;
  patchEntry(id, { status: 'downloading', error: null });
  const done = download(id, controller.signal)
    .then((result) => patchEntry(id, { status: 'done', ...result }))
    .catch((err) => {
      if (controller.signal.aborted) return;
      console.warn('[offline] download failed:', err);
      patchEntry(id, { status: 'failed', error: err.message || 'Download failed.' });
    })
    .finally(() => {
      setProgress(id, null);
      current = null;
      kick();
    });
  current = { id, controller, done };
}

// items: [{ id, titleKey, titleName, poster, href, kind, season, episode,
// episodeTitle, target, subtitleQuery }], the first one being the one on screen.
// stream: the link the watch page already resolved for it.
export async function saveOffline(items, { stream, wanted }) {
  // Asks the browser not to evict the copies when space runs low.
  navigator.storage?.persist?.().catch(() => {});
  const { entries } = getState();
  const now = Date.now();
  const added = {};
  for (const [i, item] of items.entries()) {
    const prior = entries[item.id];
    if (prior && prior.status !== 'failed') continue;
    // Segments of another source must never be stitched into this one.
    if (prior && (prior.wanted.source !== wanted.source || prior.wanted.language !== wanted.language)) {
      await forgetEntry(item.id);
    }
    added[item.id] = {
      ...item,
      wanted,
      status: 'queued',
      error: null,
      bytes: prior?.wanted.source === wanted.source ? prior.bytes || 0 : 0,
      layout: prior?.wanted.source === wanted.source ? prior.layout || null : null,
      position: prior?.position || 0,
      addedAt: now + i,
    };
  }
  const first = items[0];
  if (stream && first && added[first.id]) fresh.set(first.id, { stream, at: now });
  if (first?.poster && !(await read(posterKey(first.titleKey)))) storePoster(first.titleKey, first.poster);
  putEntries(added);
  kick();
  return Object.keys(added).length;
}

export function retryDownload(id) {
  patchEntry(id, { status: 'queued', error: null });
  kick();
}

export async function removeDownload(id) {
  if (current?.id === id) {
    current.controller.abort();
    await current.done;
  }
  const entry = getState().entries[id];
  fresh.delete(id);
  dropEntry(id);
  await forgetEntry(id);
  const titleLeft = entry && Object.values(getState().entries).some((e) => e.titleKey === entry.titleKey);
  if (entry && !titleLeft) await forgetPoster(entry.titleKey);
}

export async function removeTitle(titleKey) {
  const ids = Object.values(getState().entries).filter((e) => e.titleKey === titleKey).map((e) => e.id);
  for (const id of ids) await removeDownload(id);
}

export function savePosition(id, position, duration) {
  patchEntry(id, { position, duration });
}

// At app start: a download the last session left unfinished starts over from
// the segment it reached.
export function resumeVideoDownloads() {
  for (const entry of Object.values(getState().entries)) {
    if (entry.status === 'downloading') patchEntry(entry.id, { status: 'queued' });
  }
  kick();
}

// Signing out leaves nothing of the account's downloads on a shared device.
export async function forgetVideoDownloads() {
  // Emptied first, so the aborted download's cleanup finds nothing to start next.
  resetAll();
  fresh.clear();
  if (current) {
    current.controller.abort();
    await current.done;
  }
  await forgetAll();
}
