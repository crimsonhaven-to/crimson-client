// --- Live TV playback through the crimson-extension companion ----------------
// The backend used to relay every non-direct live feed through its signed
// /iptv_proxy: plain-http streams (mixed content on an https page), streams that
// serve no CORS, and streams gated on a Referer/User-Agent the browser refuses to
// send. This module moves that relay into the viewer's own browser via the
// companion extension, so the segment bytes never touch the backend.
//
// Two mechanisms, cheapest first:
//
//   1. Media rules (zero-copy). For https feeds, the companion installs
//      declarative-net-request rules that inject the Referer/User-Agent the CDN
//      wants and stamp `Access-Control-Allow-Origin: *` on the response. hls.js
//      then fetches the CDN *directly* — native fetch, no bytes bridged.
//
//   2. Privileged fetch loader. When rules can't help — a plain-http feed (DNR
//      can't lift the mixed-content block) or segments sharded onto a CORS-less
//      host the rule didn't cover — a custom hls.js loader routes every request
//      through CrimsonExtension.fetch(), which runs in the extension's own
//      context (no mixed-content wall, no CORS wall, sets forbidden headers).
//      Bytes cross the page↔extension bridge but still never hit the backend.
//
// The watch page escalates 1 → 2 → backend proxy on fatal error; see
// LiveTvWatch.jsx. Everything here no-ops cleanly when the companion is absent.
import { API_BASE_URL, apiFetch } from './hooks';

/** Is the companion's in-page API present right now? (Sync best-effort.) */
export function hasExtension() {
  try {
    return Boolean(window.CrimsonExtension?.available);
  } catch {
    return false;
  }
}

/** The companion is present AND toggled on by the user. */
export async function extensionEnabled() {
  if (!hasExtension()) return false;
  try {
    return await window.CrimsonExtension.status();
  } catch {
    return false;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Install this tab's media rules for one https feed: inject the feed's Referer/
 * User-Agent (scoped to the manifest host) and open CORS on media responses.
 * Replaces any previously-installed live rules. Returns true on success.
 *
 * Scoped to the manifest host on purpose — a page-wide Referer injection would
 * leak the spoofed header onto the app's own backend calls. If a feed shards its
 * segments onto another host the rule doesn't reach, that surfaces as a fatal
 * error and the watch page escalates to the fetch loader (which needs no rules).
 */
export async function installLiveRules(stream) {
  if (!hasExtension()) return false;
  const host = hostOf(stream.url);
  if (!host) return false;
  const requestHeaders = {};
  if (stream.referrer) requestHeaders.Referer = stream.referrer;
  if (stream.user_agent) requestHeaders['User-Agent'] = stream.user_agent;
  const rule = {
    requestDomains: [host],
    cors: true,
    resourceTypes: ['media', 'xmlhttprequest'],
  };
  if (Object.keys(requestHeaders).length) rule.requestHeaders = requestHeaders;
  try {
    await window.CrimsonExtension.installMediaRules([rule], { replace: true });
    return true;
  } catch {
    return false;
  }
}

/** Drop this tab's live media rules (called when leaving a rules-based feed). */
export async function clearLiveRules() {
  if (!hasExtension()) return;
  try {
    await window.CrimsonExtension.clearMediaRules();
  } catch {
    /* best-effort teardown; rules are also torn down on navigation by the extension */
  }
}

// --- Custom hls.js loader over CrimsonExtension.fetch ------------------------
function base64ToArrayBuffer(b64) {
  const bin = atob(b64 || '');
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function newStats() {
  return {
    aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 1, bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };
}

/**
 * Build an hls.js Loader class that fetches every manifest/segment/key through
 * the companion instead of the page's network stack. `referrer`/`userAgent` are
 * injected on each request (the extension can set these forbidden headers); the
 * final (post-redirect) URL the extension reports is handed back to hls.js so
 * relative segment URIs resolve correctly. Reusable across the whole stream.
 */
export function makeExtensionLoader({ referrer = '', userAgent = '' } = {}) {
  return class ExtensionLoader {
    constructor(config) {
      this.config = config;
      this.stats = newStats();
      this.context = null;
      this._aborted = false;
    }

    destroy() {
      this._aborted = true;
    }

    abort() {
      this._aborted = true;
      this.stats.aborted = true;
    }

    getCacheAge() {
      return null;
    }

    getResponseHeader() {
      return null;
    }

    load(context, config, callbacks) {
      this.context = context;
      const { stats } = this;
      stats.loading.start = performance.now();
      const wantBuffer = context.responseType === 'arraybuffer';

      const headers = {};
      if (referrer) headers.Referer = referrer;
      if (userAgent) headers['User-Agent'] = userAgent;
      // hls.js byte-range requests (EXT-X-BYTERANGE / init segments).
      if (context.rangeStart != null || context.rangeEnd != null) {
        const start = context.rangeStart || 0;
        const end = context.rangeEnd ? context.rangeEnd - 1 : '';
        headers.Range = `bytes=${start}-${end}`;
      }

      window.CrimsonExtension
        .fetch(context.url, { method: 'GET', headers, responseType: wantBuffer ? 'arraybuffer' : 'text' })
        .then((r) => {
          if (this._aborted) return;
          const now = performance.now();
          stats.loading.first = Math.max(stats.loading.start, now);
          // The extension resolves for any completed HTTP response; a real HTTP
          // error still lands here with r.ok=true and the status set.
          if (r.status < 200 || r.status >= 400) {
            callbacks.onError({ code: r.status, text: r.statusText || `HTTP ${r.status}` }, context, r, stats);
            return;
          }
          let data;
          if (wantBuffer) {
            data = base64ToArrayBuffer(r.body);
            stats.loaded = data.byteLength;
            stats.total = data.byteLength;
          } else {
            data = r.body || '';
            stats.loaded = data.length;
            stats.total = data.length;
          }
          stats.loading.end = Math.max(stats.loading.first, performance.now());
          callbacks.onSuccess({ url: r.url || context.url, data, code: r.status }, stats, context, r);
        })
        .catch((err) => {
          if (this._aborted) return;
          // Companion disabled or bridge error → fatal, so the page escalates to
          // the backend proxy.
          callbacks.onError({ code: 0, text: String((err && err.message) || err) }, context, null, stats);
        });
    }
  };
}

// --- Backend proxy fallback (last resort) ------------------------------------
// When the companion can't serve a feed (absent, toggled off, or every extension
// tier failed), fall back to exactly today's behaviour: the backend's signed
// /iptv_proxy. Only the backend holds the HMAC secret, so we fetch the pre-signed
// proxy_path from the untouched /iptv/channel/{id} endpoint and match our stream
// by its upstream URL. Cached per channel — one tiny metadata call, not per feed.
const _proxyCache = new Map(); // channelId -> Promise<Map<url, absoluteProxyUrl>>

async function loadProxyMap(channelId) {
  const res = await apiFetch(`/iptv/channel/${encodeURIComponent(channelId)}`);
  if (!res.ok) throw new Error(`/iptv/channel: HTTP ${res.status}`);
  const data = await res.json();
  const map = new Map();
  for (const s of data?.channel?.streams || []) {
    if (s.direct_url && s.proxy_path) map.set(s.direct_url, `${API_BASE_URL}${s.proxy_path}`);
  }
  return map;
}

/**
 * Resolve the backend's signed proxy URL for one upstream stream URL. Returns
 * null if the backend can't provide one (surface as a dead feed).
 */
export async function resolveProxyUrl(channelId, streamUrl) {
  let p = _proxyCache.get(channelId);
  if (!p) {
    p = loadProxyMap(channelId).catch((err) => {
      _proxyCache.delete(channelId);
      throw err;
    });
    _proxyCache.set(channelId, p);
  }
  try {
    const map = await p;
    return map.get(streamUrl) || null;
  } catch {
    return null;
  }
}
