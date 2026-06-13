// declarativeNetRequest header injection — the extension's replacement for the
// backend's signed *_proxy endpoints.
//
// The proxies existed only to (a) add CORS and (b) inject a gated Referer/Origin
// the browser can't set itself. In an extension (a) is free — host_permissions
// make the page's cross-origin fetch + hls.js segment requests bypass CORS — so
// all that's left is (b): rewrite request headers at the network layer.
//
// Beyond Referer, some hosters (VOE, Vidmoly) 500/403 a plain `fetch()` because
// it carries `Origin: chrome-extension://…` and `Sec-Fetch-Mode: cors` — they
// expect a real navigation. So a rule can also strip Origin and set the
// Sec-Fetch-* headers to look like the browser loading the player page.

// FNV-1a hash of the host -> a stable positive rule id (DNR ids are positive
// ints; the same host always maps to the same id so we replace, never pile up).
function hostRuleId(host) {
  let h = 2166136261;
  for (let i = 0; i < host.length; i++) {
    h ^= host.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 1000 + (Math.abs(h | 0) % 2000000000);
}

const RESOURCE_TYPES = ['xmlhttprequest', 'media', 'sub_frame', 'image', 'other'];

// Inject headers on every request to the host of `url`. hls.js fetches each
// segment from the same host as its playlist, so a host-scoped rule covers the
// whole stream. Idempotent per host.
//
// opts:
//   referer      set Referer
//   origin       set Origin to this value
//   stripOrigin  remove the Origin header entirely (default true unless `origin`)
//   navigation   make it look like a top-level navigation (Sec-Fetch-* = document)
export async function addStreamRule(url, opts = {}) {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) return;
  let host;
  try { host = new URL(url).host; } catch { return; }

  const { referer, origin, navigation = false } = opts;
  const stripOrigin = opts.stripOrigin ?? !origin;

  const requestHeaders = [];
  if (referer) requestHeaders.push({ header: 'referer', operation: 'set', value: referer });
  if (origin) requestHeaders.push({ header: 'origin', operation: 'set', value: origin });
  else if (stripOrigin) requestHeaders.push({ header: 'origin', operation: 'remove' });
  if (navigation) {
    requestHeaders.push(
      { header: 'sec-fetch-site', operation: 'set', value: 'cross-site' },
      { header: 'sec-fetch-mode', operation: 'set', value: 'navigate' },
      { header: 'sec-fetch-dest', operation: 'set', value: 'document' },
      { header: 'sec-fetch-user', operation: 'set', value: '?1' },
    );
  }
  if (!requestHeaders.length) return;

  const id = hostRuleId(host);
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [id],
      addRules: [{
        id,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders },
        condition: { urlFilter: `||${host}/`, resourceTypes: RESOURCE_TYPES },
      }],
    });
  } catch (e) {
    console.warn('[dnr] failed to add stream rule for', host, e);
  }
}
