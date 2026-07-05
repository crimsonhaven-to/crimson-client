import { useEffect, useState } from 'react';
import { getPlaybackPrefs } from './hooks';

// --- Discord Rich Presence (browser → loopback RPC, no backend) -------------
// We connect a browser WebSocket to a Discord RPC server on the loopback port
// range and push SET_ACTIVITY frames. Loopback is "potentially trustworthy", so
// https→ws is allowed (not mixed content) once connect-src permits it.
//
// IMPORTANT: the *real* Discord desktop client refuses RPC WebSockets whose Origin
// isn't on its hardcoded allowlist (discord.com et al.), so a site like ours can't
// talk to it directly — by design. The supported way to light this up is a small
// local bridge such as arRPC (https://github.com/OpenAsar/arrpc), which speaks the
// same RPC protocol WITHOUT the origin check and relays to Discord. So our client
// code is unchanged; presence simply appears for viewers who run such a bridge.
//
// Fully opt-in via the Preferences page (`discordPresence` pref) and degrades
// silently: with no bridge present we probe the ports once, find nothing, and stop
// — no reconnect loop, so users without a bridge don't get recurring console noise.

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
  { label: 'Discord', url: 'https://discord.gg/6an7E8aKGj' },
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
// `null` means "nowhere in particular" → the idle browsing presence. Otherwise it
// holds a *scene*: a small tagged descriptor for what page the viewer is on, set
// while that page is mounted and cleared on unmount (which drops them back to
// browsing). A tiny pub/sub keeps it framework-light and matches the window-event
// style used elsewhere in the app. The scene shapes buildActivity understands:
//   • null                                          → browsing the archives
//   • { kind:'watchlist' }                          → combing the watchlists
//   • { kind:'overview', title, mediaKind }         → lingering on a title's page
//   • { kind:'watch', title, isMovie, season,       → watching something
//       episode, totalSeasons, startedAt }
// Every page is last-write-wins: navigating swaps one scene for the next, and the
// debounced push in the controller collapses the clear+set of a navigation into a
// single Discord update so the card never flickers between them.
let _activity = null;
const _listeners = new Set();

const emit = () => _listeners.forEach((fn) => fn(_activity));

/** Announce what the viewer is watching. `{ title, isMovie, season, episode,
 *  totalSeasons, startedAt }`. */
export function setWatchActivity(watch) {
  _activity = { kind: 'watch', ...watch };
  emit();
}

/** Announce the viewer is tending their saved relics (the Watchlists page). */
export function setWatchlistActivity() {
  _activity = { kind: 'watchlist' };
  emit();
}

/** Announce the viewer is lingering on a title's overview before the watch.
 *  `mediaKind` is 'anime' | 'show' | 'movie' and only tints the flavour line. */
export function setOverviewActivity({ title, mediaKind }) {
  if (!title) return;            // overview not loaded yet — stay on the prior scene
  _activity = { kind: 'overview', title, mediaKind };
  emit();
}

/** Drop back to the idle "browsing the archives" presence. */
export function clearActivity() {
  _activity = null;
  emit();
}
// Kept as a named alias so the watch page reads symmetrically (set…/clear…).
export const clearWatchActivity = clearActivity;

function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// Turn the current scene (or null) into a Discord activity payload, phrased in
// Luminas' voice. `type: 3` is "Watching" — newer clients honour it so the profile
// line reads "Watching CRIMSONHAVEN"; older ones ignore it and fall back to
// "Playing", which is why the verb is repeated in `details` to guarantee the
// wording the card shows either way.
function buildActivity(scene) {
  const assets = {
    large_image: LARGE_IMAGE,
    large_text: LARGE_TEXT,
    small_image: SMALL_IMAGE,
    small_text: SMALL_TEXT,
  };
  const base = { type: 3, assets, buttons: BUTTONS };

  // Idle — drifting the Haven with nothing in particular open.
  if (!scene || (scene.kind === 'watch' && !scene.title)) {
    return { ...base, details: 'Browsing the archives…', state: "Beneath Luminas' crimson gaze" };
  }

  // Tending saved relics on the Watchlists page.
  if (scene.kind === 'watchlist') {
    return { ...base, details: 'Combing the watchlists', state: 'Tending her crimson reliquary' };
  }

  // Lingering on a title's overview, weighing whether to descend into it.
  if (scene.kind === 'overview') {
    const state =
      scene.mediaKind === 'movie' ? 'Weighing a crimson feature'
      : scene.mediaKind === 'anime' ? 'Tracing an inked saga'
      : 'Surveying a serial saga';
    return { ...base, details: clamp(`Beholding ${scene.title}`), state: clamp(state) };
  }

  // Watching something — the richest scene, with an elapsed timer.
  let state;
  if (scene.isMovie) {
    state = 'A crimson feature in the moonlight';
  } else if (scene.totalSeasons > 1) {
    state = `Season ${scene.season} · Episode ${scene.episode}`;
  } else {
    state = `Episode ${scene.episode}`;
  }

  return {
    ...base,
    details: clamp(`Watching ${scene.title}`),
    state: clamp(state),
    // Elapsed-since counter Discord renders as "xx:xx elapsed".
    timestamps: scene.startedAt ? { start: scene.startedAt } : undefined,
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
      // Per-cycle flag: did THIS attempt ever reach a live bridge?
      let cycleReady = false;
      conn = createRpcConnection({
        onReady: () => { cycleReady = true; ready = true; push(); },
        onClose: () => {
          ready = false;
          conn = null;
          if (cancelled) return;
          // Only retry when a working connection dropped (the bridge/Discord was
          // quit and may come back). A cycle that never connected means no bridge
          // is listening, so we stop — re-probing on a loop would just spam the
          // console with failed-WebSocket logs for everyone without a bridge.
          if (cycleReady) retryTimer = setTimeout(connect, 15_000);
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
