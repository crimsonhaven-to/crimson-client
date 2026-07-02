# 🏰 The Crimson Veil · Client Frame

> *"Welcome to my digital domain. Here, the dark network flows through blood-red links, and every manifestation is catalogued for your eternal amusement."*
> — **Luminas, the Vampire Queen**

---

## 🌹 Manifest Overview
**CrimsonHaven** is a high-fidelity, performance-optimized streaming interface designed to bridge the gap between the dark network and the mortal eye. Built on a foundation of architectural elegance and piercing aesthetics, this client frame provides a seamless gateway to the Royal Archives.

### ✨ Key Capabilities
- **Search Rituals:** A high-speed autocomplete search engine to summon any anime from the network.
- **The Royal Catalogue:** A comprehensive, categorized directory of thousands of manifestations (TV, Movies, OVAs, etc.).
- **Cryptographic Identity:** Secure, mnemonic-based account system (12-word seed phrases) for cross-device synchronization without centralized passwords.
- **The Vault:** Integrated tracking for bookmarked manifestations (Favorites) and recently watched chronologies (History).
- **Multi-Season Architecture:** Automatic AniList ID mapping for complex, multi-season clusters and metadata synchronization.
- **Responsive Corridors:** A fully optimized mobile experience, ensuring the castle is accessible from any device.
- **Persona-Driven 404s:** A custom "forgotten corridor" page featuring Luminas herself to guide lost souls back to the Haven.

---

## 🩸 Technical Specifications
The client layer is forged using modern mortal technologies, refined for speed and visual impact.

- **Interface:** [React 19](https://react.dev/) + [Vite 8](https://vite.dev/)
- **Styling:** [Tailwind CSS 4.0](https://tailwindcss.com/) (Neon Crimson Theme)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Routing:** [React Router 7](https://reactrouter.com/)
- **Cryptography:** [@noble/ed25519](https://github.com/paulmillr/noble-ed25519) + [@scure/bip39](https://github.com/paulmillr/scure-bip39)
- **State Logic:** Custom hooks for asynchronous stream resolution, in-memory caching, and reactive session management.

---

## 🕸️ System Deployment

### 1. Summoning the Source
```bash
git clone https://github.com/crimsonhaven-to/crimson-client.git
cd crimson-client
```

### 2. Preparing the Altar
```bash
npm install
```

### 3. Igniting the Dev-Engine
```bash
npm run dev
```

---

## 🐳 Production Deployment (Infrastructure as Code)

Everything needed to ship the Haven lives in the repo — no manual server tinkering.

The API base URL is baked in at **build time** via the `VITE_API_BASE_URL` build
arg (defaults to the dev backend). The image is a multi-stage build: Vite compiles
the static bundle, then it's served by hardened Nginx (gzip, security headers,
immutable hashing for content-addressed assets, `/healthz` probe).

A couple of deployment-specific text bits are baked in the same way, each with a
sensible default so a plain build still works:

| Build arg         | Controls                                         | Default                    |
| ----------------- | ------------------------------------------------ | -------------------------- |
| `VITE_SITE_URL`   | Origin for social-embed (Open Graph) URLs        | `https://crimsonhaven.to`  |
| `VITE_HOSTED_IN`  | Where user data lives (About/footer/tour badge)  | `Secret:3`                 |
| `VITE_DMCA_MAIL`  | Takedown / DMCA contact on the Disclaimer page   | `NoEmailProvided`          |

Because these are **baked at build time** (Vite), they must be set when the image
is built, not at container runtime. `VITE_SITE_URL` is set per environment by CI
(dev vs prod) so link previews on Discord/Twitter resolve the `og:image` against
the right host — social scrapers don't run JS, so this can't be done at runtime.
`VITE_HOSTED_IN` / `VITE_DMCA_MAIL` come from the repo's Actions variables
`HOSTED_IN` / `DMCA_MAIL` (Settings → Secrets and variables → Actions → Variables);
leave them unset to keep the defaults. `VITE_HOSTED_IN` accepts a flag emoji too,
e.g. `🇨🇭 Switzerland`.

### Single host — Docker Compose
```bash
# Build + run locally on http://localhost:8080
VITE_API_BASE_URL=https://backend.crimsonhaven.to docker compose up --build
```

### Cluster — Docker Swarm
The stack publishes through Swarm's **ingress routing mesh** (built-in L4 load
balancing), runs **3 replicas**, **self-heals** failed containers, and performs
**zero-downtime rolling updates with automatic rollback**.

```bash
# Build & push to a registry your nodes can reach
docker build --build-arg VITE_API_BASE_URL=https://backend.crimsonhaven.to \
  -t registry.example.com/crimson-client:1.0 .
docker push registry.example.com/crimson-client:1.0

# Deploy the stack
docker swarm init                       # once, if not already a manager
CRIMSON_IMAGE=registry.example.com/crimson-client:1.0 \
  docker stack deploy -c docker-stack.yml crimson

docker service ls                       # watch replicas converge -> 3/3
curl http://<any-node>:8080/healthz     # -> ok
```

Tuning lives in `docker-stack.yml` (`deploy.replicas`, `restart_policy`,
`update_config`, `rollback_config`, `resources`). Each container exposes a
`HEALTHCHECK` hitting `/healthz`, so Swarm only routes to healthy replicas.

### 📲 Installable Web App (PWA)
The client ships a web manifest (`public/manifest.webmanifest`) and a service
worker (`public/sw.js`), so browsers offer **"Install app"** (desktop) /
**Add to Home Screen** (mobile). The worker only caches the same-origin app
shell — it **never** touches the cross-origin backend API, so streaming, auth
and progress calls behave exactly as before.

---

## 🩸 Client-Side Resolution (the New System)

The client no longer just *consumes* the backend's `/watch` stream — it can **scrape
and resolve sources itself**, in the viewer's own browser, so video bytes flow
`CDN → viewer` and the backend leaves the byte path. It runs **alongside** the backend
stream and feeds the same consumer, so a locally-resolved source is indistinguishable
from a backend one and nothing regresses.

- **`vendor/crimson-sources`** — the TS scrape/resolve engine (the part you 
  yourself need to bring and keep a tight secret ;3), vendored as a **git
  submodule** and bundled by Vite (aliased, transpiled inline — no separate build).
- **`src/clientSources.js`** — the bridge: runs the engine, enriches the `MediaCtx`
  from the backend `/scrape-meta` (+ `/scrape-meta/movie`) grant (title + year + imdb),
  and wires the **E2** path (`signProxyUrl` → backend `/sign`) and the **`/resolve`**
  grant for secret-bound sources. `src/hooks.js` runs it inside the anime / show /
  movie watch hooks, deduping local vs backend by `(source, language)` (local wins).
- **The Companion (E3)** — the [crimson-extension](../crimson-extension) is shipped
  *from the client itself*: vendored at **`vendor/crimson-extension`**, zipped by the
  Dockerfile `extpack` stage, and offered on the themed **`/extension`** download page
  (`src/DownloadExtension.jsx`) with a home-page nudge banner. With it on, the engine
  resolves gated sources straight from the viewer's residential IP.
- **CSP** `connect-src 'self' https:` (in `security-headers.conf`) — required so the
  in-app player may load rotating hoster CDNs directly; `script-src 'self'` is untouched.

All of this is a pure upgrade: with no companion **and** no proxy configured, the
client falls back to the backend `/watch` line exactly as before.

## 🦇 Architectural Integrity
This project follows a strict **Atomic Design Manifest**:
- **`src/hooks.js`:** The cerebral cortex; handles API communications, stream scraping logic, and cryptographic state.
- **`src/clientSources.js`:** The summoning circle; drives the local `crimson-sources` engine + the `/scrape-meta`, `/sign` and `/resolve` grants.
- **`src/DownloadExtension.jsx`:** The Companion altar; the `/extension` download + side-load guide page.
- **`src/CrimsonPlayer.jsx`:** The Heart; a custom HLS/MP4 engine with vampiric controls and CSP-compliant demuxing.
- **`src/Account.jsx`:** The Sanctuary; manages cryptographic links and profile integrity via mnemonic-based authentication.
- **`src/Catalogue.jsx`:** The Royal Archives; a dynamic, filterable list of all indexed manifestations.
- **`src/AnimeOverview.jsx`:** The Chronicle; provides detailed metadata, season mapping, and episode gateways.
- **`src/App.jsx`:** The Castle Floorplan; manages routing and global layout persistence.
- **`src/NotFound.jsx`:** The Forgotten Corridor; a thematic safety net for navigation errors.

---

## ⚖️ The Queen's Disclaimer
*The Crimson Veil is a neutral viewing interface — a performance-optimized face for the Crimson Haven framework. It does **not** host, store, embed, or ship any sources, and it ships with **no** streaming providers of its own; we do **not** condone piracy. Any sources a self-hoster chooses to wire in live in their **own** private repository and resolve in the viewer's own browser — you, the mortal, are responsible for ensuring they are lawful in your realm. :3*

---

<p align="center">
  <img src="public/lumi_nobackground.png" width="150" alt="Luminas Mascot" />
  <br>
  <b>Forged in the shadows for the anime community.</b>
</p>

---

## 📜 License

Released under the **MIT License** — see [`LICENSE`](LICENSE). In short: take it,
fork it, remix it, build something lovely with it. ( ˶ ˆ ᗜ ˆ ˶ )

A tiny request from Lumi, heart-to-heart 🩸 — the MIT license only asks that you
keep the copyright notice, but I'd *so* appreciate it if you also left a little
link back to the original home, [`crimsonhaven-to`](https://github.com/crimsonhaven-to),
in anything you build on top of this. It's not a legal demand, just a kindness
between mortals and curators — it helps others find their way home to the source,
and it makes my little undead heart flutter. Thank you for being wonderful! ( ^ . ^ )

