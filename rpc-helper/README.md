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
2. Run the helper:
   - **Windows** — double-click the `.exe`. There's **no console window**; it
     just appears as a crimson icon in your system tray. Right-click it for a
     menu: open the site, toggle **Start with Windows**, or quit.
   - **macOS / Linux** — run `./crimson-presence-helper` from a terminal and
     leave it running in the background.
3. Open [crimsonhaven.to](https://crimsonhaven.to), go to **Preferences**, and
   flip on **Discord Presence**. Your profile should light up.

No bridge running? Nothing breaks — the toggle just stays quiet.

### Staying reliable

The helper keeps **one** long-lived link to Discord and re-asserts your presence
on a ~15s cadence, so it transparently survives Discord being quit and reopened.
It also holds your presence across the website's normal reconnects (tab reloads,
navigations, the page's own retry loop) and only retires it after **60s** with no
viewers — so presence stays steady instead of flickering.

### Start with Windows

The tray's **Start with Windows** toggle writes a per-user entry under
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. It's **per-user**, so it
never needs administrator rights — no UAC prompt to scare anyone off.

### Logs

On Windows (no console) the helper logs to
`%LOCALAPPDATA%\CrimsonPresenceHelper\helper.log` (truncated each launch). On
macOS/Linux it logs to the terminal.

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
# -H=windowsgui drops the console window so it's tray-only on Windows.
GOOS=windows GOARCH=amd64 go build -ldflags "-H=windowsgui" -o crimson-presence-helper.exe .
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
| `main.go`             | Entry point: flags, origin allowlist, start logging + the app.      |
| `server.go`           | Loopback WebSocket server; greets the page, feeds the manager.      |
| `presence.go`         | The single long-lived Discord link: re-assert, reconnect, grace.    |
| `discord.go`          | Discord IPC wire format: framing, button transform, nonce.          |
| `discord_windows.go`  | Named-pipe dial (`\\.\pipe\discord-ipc-N`).                          |
| `discord_unix.go`     | Unix-socket dial (macOS/Linux, incl. Flatpak/Snap paths).           |
| `app_windows.go`      | Windows tray app: menu, status, start-with-Windows, file logging.   |
| `app_other.go`        | macOS/Linux: run headless in the foreground.                        |
| `icon_windows.go`     | Generates the crimson tray icon (`.ico`) at startup.                |
