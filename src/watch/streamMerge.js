// With the client engine on, a source can resolve both locally and on the backend.
// The local line must win, even when the backend's arrived first, because it
// streams straight from the CDN with a token minted from the viewer's own ASN.
// Distinct dub/sub variants of one provider stay separate.
import { streamRank } from './streamUtils';

export function streamFromMsg(msg) {
  return {
    source: msg.source,
    type: msg.streamType,
    url: msg.url,
    language: msg.language,
    subtitles: msg.subtitles,
    cacheTicket: msg.cacheTicket,
  };
}

// `state.dedup` (key "source|language" to { idx, origin }) is the caller's Map,
// carried across one resolution pass and mutated in place. With `enabled` false
// every line simply appends. `appended` is the signal to drop the loading veil;
// a local-over-backend swap reports changed but not appended.
export function mergeStreamLine(state, msg, origin, { enabled }) {
  const incoming = streamFromMsg(msg);
  const { streams, dedup } = state;

  if (enabled) {
    const key = `${msg.source}|${msg.language || ''}`;
    const prior = dedup.get(key);
    if (prior) {
      // A local line replaces an earlier backend one (in place, keeping its slot);
      // a backend line never displaces a local one, and same-origin dupes are dropped.
      if (origin === 'local' && prior.origin !== 'local') {
        const swapped = streams.slice();
        swapped[prior.idx] = incoming;
        dedup.set(key, { idx: prior.idx, origin });
        return { streams: swapped, changed: true, appended: false };
      }
      return { streams, changed: false, appended: false };
    }
    dedup.set(key, { idx: streams.length, origin });
  }

  return { streams: [...streams, incoming], changed: true, appended: true };
}

// Ties fall back to arrival order. The user-picked guard stays in the hooks.
export function pickBestIdx(streams, prefs) {
  let bestIdx = 0;
  let bestRank = Infinity;
  streams.forEach((s, i) => {
    const r = streamRank(s, prefs);
    if (r < bestRank) {
      bestRank = r;
      bestIdx = i;
    }
  });
  return bestIdx;
}
