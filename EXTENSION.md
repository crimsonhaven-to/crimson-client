# Crimsonhaven — Browser Extension

A fully-local Chromium extension version of Crimsonhaven. Everything — metadata,
search, scraping, stream resolving and playback — runs **inside your own browser**.
There is **no server, no account, and no data leaves your machine** (except the
requests your browser makes directly to TMDB, AniList and the streaming sources,
exactly as a normal viewer would).

It's the same app as the website, with the backend reimplemented as in-page
modules and the old server-side stream proxies replaced by the browser's own
networking (extension `host_permissions` + `declarativeNetRequest`).

---

## 1. Install

### Option A — Install a packaged build (recommended for users)

1. Download / unzip the `dist-extension` folder (the built extension).
2. Open your browser's extensions page:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`
3. Turn on **Developer mode** (toggle in the top-right).
4. Click **Load unpacked** and select the `dist-extension` folder.
5. The Crimsonhaven icon appears in your toolbar. Click it — the app opens in its
   own tab. (Pin the icon for easy access.)

> Chromium requires "unpacked" extensions to be loaded in Developer mode; that's
> normal and expected for a self-distributed extension like this one.

### Option B — Build it yourself

Requires Node.js 18+.

```bash
cd crimson-client
npm install
npm run build:ext      # produces ./dist-extension
```

Then load `dist-extension` unpacked as in Option A. After any code change, re-run
`npm run build:ext` and click the **reload** (↻) button on the extension's card.

---

## 2. First run — add your TMDB key

The extension ships **no API keys**. On first launch it asks for your own free
**TMDB API token**, used only to fetch posters, titles and episode lists.

1. Create a free account at <https://www.themoviedb.org/signup>.
2. Go to **Settings → API** (<https://www.themoviedb.org/settings/api>) and request
   an API key (choose "Developer"; any purpose description is fine).
3. Copy the **API Read Access Token** (the long `eyJ…` token).
4. Paste it into the extension's setup screen and click **Enter**.

Your token is stored locally in the browser and is only ever sent to TMDB. You can
clear it any time from the browser's extension storage.

---

## 3. Using it

- **Browse / search / trending / catalogue** work just like the website.
- Open a show → pick a season/episode → **Watch**. Sources appear one-by-one as
  they resolve; the player auto-selects a good one, and you can switch sources from
  the sidebar.
- **Favorites** and **watch progress / continue-watching** are saved locally in
  your browser (no account needed).

### Streaming sources

Working sources (all played in the built-in player, ad-free where possible):

| Source | Type |
| --- | --- |
| **Cinema.bz** (tcloud / ipcloud / ngcloud) | TMDB-keyed HLS |
| **PlayIMDb** | TMDB-keyed HLS (ad-free extracted stream) |
| **VOE** | via Aniworld — HLS, decoded client-side |
| **Vidmoly** | via Aniworld — HLS/MP4 |
| **VidSrc** (megaplay) | via Aniwatch — HLS |

Not all sources carry every title, so the list you see per episode varies — that's
normal. Sources that can't be resolved are simply hidden rather than shown broken.

Intentionally **not** included: hosts behind Cloudflare/anti-bot challenges
(Doodstream, Filemoon — they need a real headless browser), Jellyfin (needs your
own server), and a few legacy sources that were unreliable upstream.

---

## 4. Privacy & how it works

- No backend, no telemetry, no account. The extension talks **directly** to TMDB,
  AniList and the streaming sources from your browser.
- The old website used signed server-side proxies to (a) get around CORS and (b)
  add the `Referer` headers some CDNs require. The extension does both locally:
  `host_permissions` make cross-origin requests CORS-free, and
  `declarativeNetRequest` rules set the needed `Referer` (and strip the
  `Origin`/`Sec-Fetch` headers that some hosts reject) at the network layer.
- A nice side effect: sources like VOE that bind their stream token to the
  *viewer's* IP now play directly, because the resolving happens in your browser
  instead of on a datacenter server.

---

## 5. Troubleshooting

- **"Enter your TMDB token" keeps reappearing / metadata is empty** — the token was
  rejected. Re-copy the full **API Read Access Token** (v4), not the short API key.
- **A show has no playable sources** — not every source has every title; try another
  episode/season, or it may simply not be available.
- **A source spins and never plays** — that upstream host may be down or have rotated
  domains (the same thing that breaks it on any site). Try a different source in the
  sidebar.
- **After updating the code** — rebuild (`npm run build:ext`) and hit reload (↻) on
  the extension card; a stale build won't pick up changes.

---

## 6. For developers

- Build flag `__EXTENSION__` (set in `vite.config.extension.js`) switches the shared
  React app into local mode; the website build (`npm run build`) is unaffected.
- Local backend lives in `src/local-backend/` — `router.js` answers the same API
  paths the app calls; `tmdb.js`/`anilist.js`/`mapping.js` cover metadata (the
  AniList↔TMDB↔season mapping is rebuilt from Fribb's anime-lists and cached in
  `chrome.storage`); `sources/` holds the scraper/resolver ports; `proxy/dnr.js` +
  `extension-static/rules/referer_rules.json` handle header injection.
- Extension shell is in `extension-static/` (`manifest.json`, `sw.js`, rules).
