# Crimson Presence Helper

A local bridge that lets Crimson Haven's browser-based Discord Rich Presence reach
the Discord desktop client.

The site ([`src/discordPresence.js`](../src/discordPresence.js)) builds
`SET_ACTIVITY` frames and dials a Discord RPC WebSocket on the loopback port range.
Discord and arRPC reject that socket because `https://crimsonhaven.to` is not on
their hardcoded origin allowlist. The helper speaks the same WebSocket RPC
protocol, trusts our origin, and relays each frame to Discord over its local IPC
pipe. The site needs no changes: the helper answers on a port the page already
probes.

```
browser (crimsonhaven.to)      this helper                 Discord
ws://127.0.0.1:646x   ──────▶  origin trusted, relayed ──▶ \\.\pipe\discord-ipc-0
SET_ACTIVITY frames                                         SET_ACTIVITY
```

It listens only on `127.0.0.1` and talks only to the Discord pipe on the same
machine. Nothing leaves the computer.

## Usage

1. Run the Discord desktop client (the web app has no IPC pipe).
2. Start the helper:

   | OS | How |
   | --- | --- |
   | Windows | Double-click the `.exe`. No console window; it lives in the system tray. The tray menu opens the site, toggles **Start with Windows**, or quits. |
   | macOS, Linux | Run `./crimson-presence-helper` in a terminal and leave it running. |

3. On [crimsonhaven.to](https://crimsonhaven.to), open **Preferences** and turn on
   **Discord Presence**.

Without the helper the toggle does nothing and nothing breaks.

| Flag | Default | Meaning |
| --- | --- | --- |
| `-origin` | none | Comma-separated extra browser origins to trust, on top of `crimsonhaven.to`, `www.crimsonhaven.to` and any localhost origin. For self-hosting. |

## Behaviour

| Topic | Detail |
| --- | --- |
| Discord link | One long-lived connection, re-asserted every 15s. Survives Discord being quit and reopened. |
| Grace period | Presence is held across tab reloads, navigations and the page's retry loop, and cleared only after 60s with no connected tab. |
| Ports | Binds the first free port in 6463 to 6472. Discord itself usually holds 6463. |
| Autostart (Windows) | Per-user entry in `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, so no admin rights or UAC prompt. |
| Logs | Windows: `%LOCALAPPDATA%\CrimsonPresenceHelper\helper.log`, truncated each launch. macOS and Linux: stderr. |

## Building

Requires Go 1.26+.

```sh
cd rpc-helper
go build -o crimson-presence-helper .
```

Cross-compiling:

```sh
# -H=windowsgui drops the console window so the helper is tray-only.
GOOS=windows GOARCH=amd64 go build -ldflags "-H=windowsgui" -o crimson-presence-helper.exe .
GOOS=darwin  GOARCH=arm64 go build -o crimson-presence-helper .
GOOS=linux   GOARCH=amd64 go build -o crimson-presence-helper .
```

## Distribution

The repository is private, so release assets are not publicly
downloadable. Instead the `helper` stage of [`../Dockerfile`](../Dockerfile)
cross-compiles every platform into the site image, and
[`../nginx.conf`](../nginx.conf) serves them under `/helper/`. The Preferences page
links to `https://crimsonhaven.to/helper/...`, same-origin, with no account needed.

The binaries exist only in the built image, so `/helper/*` is empty under
`vite dev`. Test the links against an image build or the deployed site.

## Layout

| File | Role |
| --- | --- |
| `main.go` | Entry point: flags, origin allowlist, logging, start the app |
| `server.go` | Loopback WebSocket server: greets the page, feeds the presence |
| `presence.go` | The shared Discord link: re-assert, reconnect, grace period |
| `discord.go` | Discord IPC framing, activity pass-through, nonces |
| `discord_windows.go` | Named-pipe dial (`\\.\pipe\discord-ipc-N`) |
| `discord_unix.go` | Unix-socket dial, including Flatpak and Snap paths |
| `app_windows.go` | Tray app: menu, status, Start with Windows, file logging |
| `app_other.go` | macOS and Linux: foreground process |
| `icon_windows.go` | Generates the tray `.ico` at startup |
