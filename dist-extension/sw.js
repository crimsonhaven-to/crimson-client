// Crimsonhaven extension background service worker (classic script, no imports).
//
// Intentionally tiny: all the real work (metadata, scraping, resolving, playback)
// runs in the app page, which — like the worker — gets CORS-free cross-origin
// fetch from the extension's host_permissions. The Referer/Origin header rewrites
// that used to be the backend's signed proxies are handled declaratively by the
// static declarativeNetRequest rules (rules/referer_rules.json), so they need no
// code here. This worker only opens the full-tab app when the toolbar icon is
// clicked (and once on install).

const APP_PAGE = 'index.extension.html';

async function openApp() {
  const url = chrome.runtime.getURL(APP_PAGE);
  // Focus an already-open app tab instead of stacking duplicates.
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => t.url && t.url.startsWith(url));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

chrome.action.onClicked.addListener(() => { openApp(); });

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') openApp();
});
