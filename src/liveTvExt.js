// Feeds that are plain http (mixed content), serve no CORS, or need a Referer or
// User-Agent the browser refuses to send are relayed by the companion extension so
// the bytes never touch the backend. LiveTvWatch.jsx escalates on fatal error:
//
//   1. Media rules (zero-copy): DNR rules inject the headers and open CORS, and
//      hls.js fetches the CDN directly. DNR cannot lift the mixed-content block.
//   2. Fetch loader: every request goes through CrimsonExtension.fetch(), which
//      has no mixed-content or CORS wall and can set forbidden headers.
//   3. The backend's signed /iptv_proxy.
import { API_BASE_URL } from './hooks/config';
import { apiFetch } from './hooks/apiClient';

export function hasExtension() {
  try {
    return Boolean(window.CrimsonExtension?.available);
  } catch {
    return false;
  }
}

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

// Scoped to the manifest host because a page-wide Referer injection would leak
// the spoofed header onto the app's own backend calls. Segments sharded onto
// another host fail fatally and the watch page escalates to the fetch loader.
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

export async function clearLiveRules() {
  if (!hasExtension()) return;
  try {
    await window.CrimsonExtension.clearMediaRules();
  } catch {
    /* the extension also tears rules down on navigation */
  }
}

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

// The post-redirect URL the extension reports is handed back to hls.js so
// relative segment URIs resolve correctly.
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
          // Fatal on purpose, so the page escalates to the backend proxy.
          callbacks.onError({ code: 0, text: String((err && err.message) || err) }, context, null, stats);
        });
    }
  };
}

// Only the backend holds the HMAC secret, so the pre-signed proxy_path comes from
// /iptv/channel/{id}, matched by upstream URL and cached per channel.
const _proxyCache = new Map();

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

// Null means a dead feed.
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
