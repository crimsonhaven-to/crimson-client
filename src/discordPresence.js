import { useEffect, useState } from 'react';
import { getPlaybackPrefs } from './hooks';

// --- Discord Rich Presence (no desktop helper, no backend) ------------------
// PreMiD-style presence, minus PreMiD: the Discord *desktop* client runs a local
// RPC server on a loopback WebSocket, and a browser tab is allowed to connect
// straight to it (loopback is a "potentially trustworthy" origin, so https→ws is
// not blocked as mixed content). So this page *is* the presence app — it tells
// the user's own Discord client what to show. Nothing is sent to our backend, and
// it only works while the viewer has the Discord desktop app open (browser/mobile
// Discord have no local RPC server — the feature simply no-ops there).
//
// The whole thing is opt-in via the Preferences page (the `discordPresence`
// playback pref) and degrades silently: if Discord isn't running, a port is
// refused, or the browser blocks the loopback socket, we just never show anything.

// The "CRIMSONHAVEN" application in the Discord Developer Portal. This id is
// public by design — it only selects whose name + uploaded art the card shows.
const DISCORD_CLIENT_ID = '1519351546297712792';

// Art asset keys uploaded under the app's Rich Presence › Art Assets.
const LARGE_IMAGE = 'crimson';    // Lumi's crimson sigil — the big tile
const SMALL_IMAGE = 'lumi_cuty';  // her chibi — the little corner badge
const LARGE_TEXT = "Crimson Haven · Luminas' sanctuary";
const SMALL_TEXT = 'Luminas Crimsonveil ( ^ . ^ )';

// Up to two clickable buttons on the card (Discord's hard limit). Same pair on
// every state, so it's defined once and shared by buildActivity.
const BUTTONS = [
  { label: 'Discord', url: 'https://discord.gg/yRjAcfCxpf' },
  { label: 'GitHub', url: 'https://github.com/crimsonhaven-to' },
];

// Discord's local RPC server binds the first free port in this range; the client
// picks one at startup, so we probe them in order until one answers.
const RPC_PORTS = [6463, 6464, 6465, 6466, 6467, 6468, 6469, 6470, 6471, 6472];

// Discord caps details/state at 128 chars; keep titles from tripping that.
const clamp = (s) => (s && s.length > 128 ? `${s.slice(0, 127)}…` : s);

// A pid is required by the RPC schema; the browser has none, so a stable random
// stand-in is fine (Discord only uses it to auto-clear if the process vanishes).
const PID = Math.floor(Math.random() * 1_000_000);
const nonce = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);

// --- Activity store ---------------------------------------------------------
// `null` means "no specific title" → the browsing presence. The watch page sets a
// descriptor while mounted (see setWatchActivity) and clears it on unmount, which
// drops the viewer back to browsing. A tiny pub/sub keeps it framework-light and
// matches the window-event style used elsewhere in the app.
let _activity = null;
const _listeners = new Set();

const emit = () => _listeners.forEach((fn) => fn(_activity));

/** Announce what the viewer is watching. `{ title, isMovie, season, episode,
 *  totalSeasons, startedAt }`. */
export function setWatchActivity(activity) {
  _activity = activity;
  emit();
}

/** Drop back to the idle "browsing the archives" presence. */
export function clearWatchActivity() {
  _activity = null;
  emit();
}

function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// Turn the current watch descriptor (or null) into a Discord activity payload.
// Phrased in Luminas' voice. `type: 3` is "Watching" — newer clients honour it so
// the profile line reads "Watching CRIMSONHAVEN"; older ones ignore it and fall
// back to "Playing", which is why the verb is repeated in `details` to guarantee
// the wording the card shows either way.
function buildActivity(watch) {
  const assets = {
    large_image: LARGE_IMAGE,
    large_text: LARGE_TEXT,
    small_image: SMALL_IMAGE,
    small_text: SMALL_TEXT,
  };

  if (!watch || !watch.title) {
    return {
      type: 3,
      details: 'Browsing the archives…',
      state: "Beneath Luminas' crimson gaze",
      assets,
      buttons: BUTTONS,
    };
  }

  let state;
  if (watch.isMovie) {
    state = 'A crimson feature in the moonlight';
  } else if (watch.totalSeasons > 1) {
    state = `Season ${watch.season} · Episode ${watch.episode}`;
  } else {
    state = `Episode ${watch.episode}`;
  }

  return {
    type: 3,
    details: clamp(`Watching ${watch.title}`),
    state: clamp(state),
    assets,
    buttons: BUTTONS,
    // Elapsed-since counter Discord renders as "xx:xx elapsed".
    timestamps: watch.startedAt ? { start: watch.startedAt } : undefined,
  };
}

// --- Loopback RPC connection ------------------------------------------------
// Walks the port range until a Discord client answers (it greets us with a
// DISPATCH/READY frame the moment we connect, since the client_id rides in the
// query string — no IPC handshake needed over the WS transport). `onClose` fires
// once, terminally: either no port answered or an established socket dropped.
function createRpcConnection({ onReady, onClose }) {
  let live = null;       // the socket that reached READY
  let portIdx = 0;
  let closed = false;

  const tryNextPort = () => {
    if (closed) return;
    if (portIdx >= RPC_PORTS.length) {
      onClose?.();        // nothing answered — Discord likely isn't running
      return;
    }
    const port = RPC_PORTS[portIdx++];
    let socket;
    try {
      socket = new WebSocket(
        `ws://127.0.0.1:${port}/?v=1&client_id=${DISCORD_CLIENT_ID}&encoding=json`
      );
    } catch {
      tryNextPort();      // some browsers throw synchronously on a blocked loopback
      return;
    }

    socket.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.cmd === 'DISPATCH' && msg.evt === 'READY') {
        live = socket;
        onReady?.(socket);
      }
    };
    // Errors surface as a close; let onclose drive the state machine.
    socket.onerror = () => {};
    socket.onclose = () => {
      if (closed) return;
      if (live === socket) {  // a working connection dropped (Discord quit)
        live = null;
        onClose?.();
      } else {                // this port wasn't Discord — keep probing
        tryNextPort();
      }
    };
  };

  tryNextPort();

  return {
    send(payload) {
      if (live && live.readyState === WebSocket.OPEN) {
        live.send(JSON.stringify(payload));
        return true;
      }
      return false;
    },
    close() {
      closed = true;
      try { live?.close(); } catch { /* already gone */ }
    },
  };
}

const setActivityFrame = (activity) => ({
  cmd: 'SET_ACTIVITY',
  nonce: nonce(),
  args: { pid: PID, activity },
});

// --- Controller hook --------------------------------------------------------
// Mount once at the app root. Watches the opt-in preference; while enabled it
// keeps a live RPC connection and pushes the current activity, debounced so rapid
// changes (seeking, flipping episodes) collapse into one update. Reconnects on a
// gentle timer if Discord wasn't running yet. Does nothing at all when disabled.
export function useDiscordPresence() {
  const [enabled, setEnabled] = useState(() => getPlaybackPrefs().discordPresence);

  // React to the toggle (this tab, the settings broadcast, or another tab).
  useEffect(() => {
    const sync = () => setEnabled(getPlaybackPrefs().discordPresence);
    window.addEventListener('crimson-playback-prefs', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-playback-prefs', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof WebSocket === 'undefined') return;

    let cancelled = false;
    let conn = null;
    let ready = false;
    let pushTimer = null;
    let retryTimer = null;

    const push = () => {
      if (conn && ready) conn.send(setActivityFrame(buildActivity(_activity)));
    };
    const schedulePush = () => {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(push, 400);
    };

    const connect = () => {
      if (cancelled) return;
      conn = createRpcConnection({
        onReady: () => { ready = true; push(); },
        onClose: () => {
          ready = false;
          conn = null;
          if (!cancelled) retryTimer = setTimeout(connect, 30_000);
        },
      });
    };

    const unsubscribe = subscribe(schedulePush);
    connect();

    return () => {
      cancelled = true;
      clearTimeout(pushTimer);
      clearTimeout(retryTimer);
      unsubscribe();
      if (conn) {
        // Clear the presence so it doesn't linger after we stop (e.g. logout).
        conn.send(setActivityFrame(null));
        conn.close();
      }
    };
  }, [enabled]);
}
