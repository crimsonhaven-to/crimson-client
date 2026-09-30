# Crimson Client

The web client of Crimson Haven: anime, shows, movies, manga, Live TV, your own
local library and music, with accounts, watchlists, the airing calendar, Wrapped
and the admin dashboard. It talks to [`crimson-backend`](../crimson-backend) and,
when the private [`crimson-sources`](../crimson-sources) engine is bundled,
resolves third-party sources in the viewer's own browser. This repository hosts,
embeds and ships no sources of its own.

## Stack

React 19, Vite 8, React Router 7, Tailwind CSS 4, hls.js, lucide-react.
`@noble/ed25519` and `@scure/bip39` for mnemonic accounts. Vitest with jsdom.
Served by nginx; Docker Compose for one host, Docker Swarm in production.

## Quick start

```bash
git submodule update --init   # optional, needs access to crimson-sources
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Without `VITE_API_BASE_URL` the dev server talks to the production backend.
Without the submodule, Vite bundles `src/sourcesStub.js` instead and everything
plays through the backend's `/watch` stream.

```bash
npm run lint
NODE_OPTIONS=--no-experimental-webstorage npm test   # see below
npm run build
```

Node 25 and newer ship their own `localStorage` global, which hides jsdom's and
fails every test that stores something. The flag turns it off. CI runs Node 24 and
needs nothing.

## Configuration

Vite bakes these in at build time, so they are Docker build args, not container
environment. Changing one means a rebuild.

| Variable | Controls | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | The backend | `https://backend.crimsonhaven.to` |
| `VITE_SITE_URL` | Origin in the Open Graph tags; scrapers do not run JS, so it has to be in the HTML | `https://crimsonhaven.to` |
| `VITE_HOSTED_IN` | Where user data lives (About, footer, tour); a flag emoji works | `Secret:3` |
| `VITE_DMCA_MAIL` | Takedown contact on the Disclaimer page | `NoEmailProvided` |
| `VITE_CLIENT_SOURCES` | `true` forces the browser source engine on | auto |
| `VITE_CLIENT_LIVETV` | `false` pins Live TV to the backend catalogue | client |

CI sets `VITE_HOSTED_IN` and `VITE_DMCA_MAIL` from the `HOSTED_IN` and
`DMCA_MAIL` CI/CD variables. Per viewer, `localStorage` overrides the engine:
`crimson:clientSources` (`1` on, `0` off), `crimson:clientSources:debug` (`1` for
per-source logs) and `crimson:clientLiveTv` (`0` for the backend).

## Layout

| Path | Owns |
| --- | --- |
| `src/App.jsx`, `src/main.jsx` | Routing, the login wall, the shell and the landing pages |
| `src/hooks.js`, `src/hooks/` | The data layer: config, the API client, auth, account, watchlists, one module per media type |
| `src/clientSources.js`, `src/clientManga.js`, `src/liveTvExt.js` | The bridge to `crimson-sources` and the backend grants it needs |
| `src/WatchView.jsx`, `src/CrimsonPlayer.jsx`, `src/streamUtils.js` | The watch page, the hls.js player, stream ranking and grouping |
| `src/*Hub.jsx`, `src/*Overview.jsx`, `src/*Watch.jsx`, `src/hubKit.jsx` | Browse, title and watch pages per media type |
| `src/music/`, `src/Music*.jsx` | Music: the two-deck player with crossfade, queue, offline downloads, listens |
| `src/admin/`, `src/Admin.jsx`, `src/adminApi.js` | The admin dashboard, one module per tab |
| `src/wrapped/`, `src/CrimsonWrapped.jsx` | Crimson Wrapped |
| `src/discordPresence.js`, `rpc-helper/` | Discord Rich Presence and its desktop helper (see [`rpc-helper/README.md`](rpc-helper/README.md)) |
| `public/sw.js` | The service worker: installable app, offline shell and offline music |
| `vendor/crimson-sources` | The private source engine, a git submodule |

## Browser sources

When it is bundled, `crimson-sources` resolves sources in the viewer's browser and
emits the same NDJSON lines as the backend's `/watch`. Both feed one consumer,
deduped by `(source, language)` with the local result winning, so video goes from
the CDN to the viewer without passing the backend. Metadata comes from the
backend's `/scrape-meta` grant; `/sign` and `/resolve` cover sources that need the
edge proxy or a server-held secret.

The engine engages by itself when the companion extension
([Chrome Web Store and Firefox Add-ons](src/DownloadExtension.jsx), announced by
the `crimson-extension-ready` handshake) is present, and otherwise uses the proxy
path unless the backend reports it unconfigured. With neither, playback stays on
the backend alone.

`connect-src https:` in [`security-headers.conf`](security-headers.conf) lets the
player load from hoster CDNs that rotate and cannot be listed; `script-src` stays
`'self'` plus one pinned hash for the theme guard in `index.html`. Editing that
inline script means recomputing the hash (the command is in the file).

## Deployment

```bash
docker compose up --build                  # one host, http://localhost:8080
CRIMSON_IMAGE=<registry>/crimson-client:<tag> \
  docker stack deploy --with-registry-auth -c docker-stack.yml crimson-client
```

The image builds the app, cross-compiles the presence helper for every platform
(served at `/helper/`), and serves both from nginx with a `/healthz` probe.

| Trigger | Result |
| --- | --- |
| Push to `main` | `:dev-<sha>`, rolled onto the dev stack |
| `v*` tag | `:<tag>` and `:latest`, rolled onto production; publishes the sourceless demo to Pages |
| Run with `CHANNEL=prod` (manual, or from `crimson-sources`) | `:main-<sha>`, rolled onto production |

Every pipeline runs lint and tests first, and a Trivy scan on `main` and tags
blocks on HIGH and CRITICAL. CI fetches `crimson-sources` from `main` at build
time; without access the build still succeeds with the stub. A release bumps
`CLIENT_VERSION` in `src/hooks/config.js`.

## Disclaimer

The client is an interface. It does not host, store, embed or ship any sources,
and does not condone piracy. Sources a self-hoster wires in live in their own
private repository and run in the viewer's browser; whoever runs them is
responsible for their legality.

## License

MIT, see [`LICENSE`](LICENSE). A link back to
[crimsonhaven-to](https://gitlab.ramon.moe/crimsonhaven-to) in anything built on
this is appreciated, not required.
