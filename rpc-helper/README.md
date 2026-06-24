# Crimson Presence Helper 🩸

A tiny local bridge that lets Crimson Haven's **browser-based Discord Rich
Presence** actually reach your Discord client.

## Why this exists

The website ([`src/discordPresence.js`](../src/discordPresence.js)) already builds
the `SET_ACTIVITY` frames and dials a Discord RPC WebSocket on the loopback port
range. The catch: the real Discord desktop client — and arRPC — **reject that
socket** because `https://crimsonhaven.to` isn't on their hardcoded origin
allowlist. That's by design on their end, and there's no way to ask them to add
us.

This helper speaks the *exact same* WebSocket RPC protocol the page expects, but
trusts our origin, and relays whatever the page sends straight to Discord over
its local IPC pipe. **The website's code is unchanged** — the helper simply
answers on the port the page already dials.

```
 browser (crimsonhaven.to)            this helper                 Discord
 ────────────────────────            ───────────                 ───────
 ws://127.0.0.1:646x  ──────▶  origin trusted, relayed  ──────▶  \\.\pipe\discord-ipc-0
   SET_ACTIVITY frames               (no origin check)             SET_ACTIVITY
```

It listens **only** on `127.0.0.1` and talks **only** to the Discord pipe on the
same machine. Nothing leaves your computer.

## Using it

1. Make sure the Discord **desktop** client is running (not just the web app).
2. Run the helper — just double-click the binary, or from a terminal:
   ```
   ./crimson-presence-helper
   ```
   Leave it running (it's happiest minimized in the background / taskbar).
3. Open [crimsonhaven.to](https://crimsonhaven.to), go to **Preferences**, and
   flip on **Discord Presence**. Your profile should light up.

No bridge running? Nothing breaks — the toggle just stays quiet.

### Flags

| Flag       | Default | Meaning                                                              |
| ---------- | ------- | ------------------------------------------------------------------- |
| `-origin`  | _(none)_| Comma-separated extra browser origins to trust, on top of the built-in Crimson Haven + any-localhost set. Handy for self-hosting. |

## Building from source

Requires Go 1.26+.

```sh
cd rpc-helper
go build -o crimson-presence-helper .
```

Cross-compile for another OS:

```sh
GOOS=windows GOARCH=amd64 go build -o crimson-presence-helper.exe .
GOOS=darwin  GOARCH=arm64 go build -o crimson-presence-helper .
GOOS=linux   GOARCH=amd64 go build -o crimson-presence-helper .
```

## Distribution

The repo is **private**, so GitHub Release assets aren't publicly downloadable.
Instead, the binaries are cross-compiled for all platforms **inside the site's
Docker image** (the `helper` stage in [`../Dockerfile`](../Dockerfile)) and
served as static downloads from the site itself under `/helper/` (see the
matching `location` block in [`../nginx.conf`](../nginx.conf)). The Preferences
page links straight to them, so viewers download the bridge same-origin from
`https://crimsonhaven.to/helper/…` — no auth, no GitHub account needed.

> The downloads only exist in the built image, so `/helper/*` is empty under
> `vite dev`; test the links against a real image build or the deployed site.

## Layout

| File                  | Role                                                                 |
| --------------------- | ------------------------------------------------------------------- |
| `main.go`             | Entry point: flags, origin allowlist, start the server.             |
| `server.go`           | Loopback WebSocket server; greets the page and forwards activities. |
| `discord.go`          | Discord IPC client: framing, handshake, button transform, keepalive.|
| `discord_windows.go`  | Named-pipe dial (`\\.\pipe\discord-ipc-N`).                          |
| `discord_unix.go`     | Unix-socket dial (macOS/Linux, incl. Flatpak/Snap paths).           |
