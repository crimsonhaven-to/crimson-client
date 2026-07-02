// Pure prefer-local dedup/append + auto-select reducer for the /watch NDJSON
// `stream` lines. Extracted verbatim (behaviour-identical) from the three streamer
// hooks (useAnimeStreamer, useShowStreamer, useMovieStreamer), which had three
// byte-for-byte copies of this logic inlined in their effect closures.
//
// This is the code that decides WHICH stream a viewer actually gets when the
// client-side engine is on: a source can resolve both locally (bytes straight from
// the CDN, token minted from the viewer's own ASN) and on the backend, and the
// local line must win — even if the backend's arrived first — while distinct
// dub/sub variants of the same provider stay separate. A regression here silently
// serves the wrong (or a duplicated) source. Pinned by streamMerge.test.js.
import { streamRank } from '../streamUtils';

// Build the normalized player tile from a backend/local `stream` NDJSON message.
// `streamType` is renamed to `type` for the player/sidebar; language/subtitles/
// cacheTicket are optional (only some scrapers supply them) and stay undefined.
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

/**
 * Fold one resolved `stream` message into the current stream list.
 *
 * @param {{ streams: object[], dedup: Map<string, {idx: number, origin: string}> }} state
 *        The current tiles and the (source|language) dedup index. `dedup` is
 *        mutated in place — it's the caller's Map, carried across all lines of one
 *        resolution pass — so the reducer stays allocation-cheap per line.
 * @param {object} msg     the parsed `{ type:'stream', source, streamType, url, ... }`.
 * @param {'backend'|'local'} origin  where this line came from.
 * @param {{ enabled: boolean }} opts  `enabled` = clientSourcesEnabled(): when false
 *        the dedup is bypassed entirely and every line simply appends, so default
 *        (engine-off) behaviour is byte-identical to before the client engine existed.
 * @returns {{ streams: object[], changed: boolean, appended: boolean }}
 *        `changed` — the visible list changed (re-render + re-select).
 *        `appended` — a brand-new tile was added (the "first playable source is in"
 *        signal the hooks use to drop the loading veil). A local-over-backend swap
 *        reports changed=true, appended=false (loading was already cleared).
 */
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

// The auto-select index: lowest streamRank wins, ties fall back to arrival order
// (the first-resolved source). Mirrors the inline `reselect` the hooks ran; the
// user-picked guard stays in the hook (it reads a ref).
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
