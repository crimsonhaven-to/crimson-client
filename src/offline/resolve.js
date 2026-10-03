// Finds a fresh link for a queued download the way a watch page does: the
// browser engine and the backend's /watch side by side, merged so a local line
// wins over the backend's copy of the same source.
import { clientSourcesEnabled, streamLocalSources } from '../sources/clientSources';
import { streamWatchNdjson } from '../api/ndjson';
import { isDownloadable } from '../watch/streamDownload';
import { mergeStreamLine } from '../watch/streamMerge';
import { streamProviderLabel } from '../watch/streamUtils';

// The member picked a source by its label. Another episode may only carry the
// same provider on a different server ("ScreenScape · MovieBox (720p)" instead of
// 1080p), which is still the member's choice; a different language is not.
export function matchStream(streams, wanted) {
  const candidates = streams.filter((s) => isDownloadable(s) && (s.language || '') === (wanted.language || ''));
  return candidates.find((s) => s.source === wanted.source)
    || candidates.find((s) => streamProviderLabel(s) === streamProviderLabel(wanted))
    || null;
}

export class NotFoundError extends Error {}

export async function resolveStream({ path, ctx }, wanted, signal) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });

  const dedup = new Map();
  let streams = [];
  let unaired = false;
  const onLine = (origin) => (line) => {
    let msg;
    try { msg = JSON.parse(line.trim()); } catch { return; }
    if (msg.type === 'unaired') unaired = true;
    if (msg.type !== 'stream') return;
    ({ streams } = mergeStreamLine({ streams, dedup }, msg, origin, { enabled: clientSourcesEnabled() }));
    // A backend line could still be replaced by a local one, which spares the
    // backend the bytes, so only a local match ends the search early.
    const match = matchStream(streams, wanted);
    if (match && dedup.get(`${match.source}|${match.language || ''}`)?.origin === 'local') stop();
  };

  try {
    await Promise.allSettled([
      streamLocalSources(ctx, { signal: controller.signal, onLine: onLine('local'), background: true }),
      streamWatchNdjson(path, { signal: controller.signal, onLine: onLine('backend') }),
    ]);
  } finally {
    signal?.removeEventListener('abort', stop);
  }
  if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');

  const match = matchStream(streams, wanted);
  if (match) return match;
  if (unaired) throw new NotFoundError('Not aired yet.');
  throw new NotFoundError(`${wanted.source} has no copy of this right now.`);
}
