import { useEffect, useState } from 'react';
import { getPlaybackPrefs } from '../account/playbackPrefs';
import { currentTrack, getState as getPlayerState, subscribe as subscribeToPlayer } from '../music/player';

// Loopback is "potentially trustworthy", so an https page may open ws://127.0.0.1
// (not mixed content) once connect-src permits it.
//
// The real Discord client rejects RPC WebSockets from origins off its hardcoded
// allowlist, so presence only appears for viewers running a local bridge such as
// arRPC (https://github.com/OpenAsar/arrpc), which skips the origin check. Without
// one the ports are probed once and never again, to avoid recurring console noise.

// Public by design: it only selects whose name and uploaded art the card shows.
const DISCORD_CLIENT_ID = '1519351546297712792';

// Keys uploaded under the app's Rich Presence > Art Assets.
const LARGE_IMAGE = 'crimson';
const SMALL_IMAGE = 'lumi_cuty';
const LARGE_TEXT = "Crimson Haven · Luminas' sanctuary";
const SMALL_TEXT = 'Luminas Crimsonveil ( ^ . ^ )';

// Discord allows at most two buttons.
const BUTTONS = [
  { label: 'Discord', url: 'https://discord.gg/6an7E8aKGj' },
  { label: 'GitLab', url: 'https://gitlab.ramon.moe/crimsonhaven-to' },
];

// Discord's local RPC server binds the first free port in this range at startup.
const RPC_PORTS = [6463, 6464, 6465, 6466, 6467, 6468, 6469, 6470, 6471, 6472];

// Discord caps details/state at 128 chars.
const clamp = (s) => (s && s.length > 128 ? `${s.slice(0, 127)}…` : s);

// The RPC schema requires a pid and the browser has none. Discord only uses it to
// auto-clear when the process vanishes, so a stable random stand-in is fine.
const PID = Math.floor(Math.random() * 1_000_000);
const nonce = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);

// The scene is set by the mounted page and cleared on unmount; null is idle
// browsing. Shapes: { kind: 'watchlist' }, { kind: 'overview', title, mediaKind },
// { kind: 'watch', title, isMovie, season, episode, totalSeasons, startedAt },
// and { kind: 'music' } from musicScene. The debounced push collapses a
// navigation's clear+set into one update so the card never flickers.
//
// Music is not a page scene: it plays across routes, so while a song plays it
// outranks the page. A video starting pauses the music, so watching still wins.
let _activity = null;
const _listeners = new Set();

const emit = () => _listeners.forEach((fn) => fn(_activity));

export function setWatchActivity(watch) {
  _activity = { kind: 'watch', ...watch };
  emit();
}

export function setWatchlistActivity() {
  _activity = { kind: 'watchlist' };
  emit();
}

// `mediaKind` ('anime' | 'show' | 'movie') only tints the flavour line.
export function setOverviewActivity({ title, mediaKind }) {
  if (!title) return; // overview not loaded yet, keep the prior scene
  _activity = { kind: 'overview', title, mediaKind };
  emit();
}

export function clearActivity() {
  _activity = null;
  emit();
}
// Lets the watch page read symmetrically with setWatchActivity.
export const clearWatchActivity = clearActivity;

function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// `startedAt` is when the song would have started had it played straight
// through, which is what Discord's progress bar counts from.
export function musicScene(player, now = Date.now()) {
  const track = currentTrack(player);
  if (!track || !player.playing) return null;
  const duration = Number.isFinite(player.duration) && player.duration > 0
    ? player.duration
    : track.duration_ms / 1000;
  return {
    kind: 'music',
    id: track.id,
    title: track.title,
    artists: (track.artists || []).join(', '),
    album: track.album || '',
    cover: track.cover_url || null,
    startedAt: Math.round(now - player.currentTime * 1000),
    duration,
  };
}

// The player reports its position four times a second; Discord only needs to
// hear about a new song, a pause, or a seek. A drift under two seconds is the
// clock, not a seek.
export function sameMusic(a, b) {
  if (!a || !b) return a === b;
  return a.id === b.id
    && Math.abs(a.startedAt - b.startedAt) < 2000
    && Math.round(a.duration) === Math.round(b.duration);
}

// Discord fetches an https image link itself; anything else (a device-local
// blob, an overlong signed link) falls back to the uploaded art.
const coverImage = (url) => (url && url.startsWith('https://') && url.length <= 256 ? url : null);

// `type: 3` is "Watching", but older clients ignore it and show "Playing", so the
// verb is repeated in `details`.
export function buildActivity(scene) {
  // `type: 2` is "Listening to"; start plus end give Discord its progress bar.
  if (scene?.kind === 'music') {
    const start = scene.startedAt;
    return {
      type: 2,
      assets: {
        large_image: coverImage(scene.cover) || LARGE_IMAGE,
        large_text: clamp(scene.album || LARGE_TEXT),
        small_image: SMALL_IMAGE,
        small_text: SMALL_TEXT,
      },
      buttons: BUTTONS,
      details: clamp(scene.title),
      state: clamp(scene.artists ? `by ${scene.artists}` : 'A crimson melody'),
      timestamps: scene.duration > 0
        ? { start, end: start + Math.round(scene.duration * 1000) }
        : { start },
    };
  }

  const assets = {
    large_image: LARGE_IMAGE,
    large_text: LARGE_TEXT,
    small_image: SMALL_IMAGE,
    small_text: SMALL_TEXT,
  };
  const base = { type: 3, assets, buttons: BUTTONS };

  if (!scene || (scene.kind === 'watch' && !scene.title)) {
    return { ...base, details: 'Browsing the archives…', state: "Beneath Luminas' crimson gaze" };
  }

  if (scene.kind === 'watchlist') {
    return { ...base, details: 'Combing the watchlists', state: 'Tending her crimson reliquary' };
  }

  if (scene.kind === 'overview') {
    const state =
      scene.mediaKind === 'movie' ? 'Weighing a crimson feature'
      : scene.mediaKind === 'anime' ? 'Tracing an inked saga'
      : 'Surveying a serial saga';
    return { ...base, details: clamp(`Beholding ${scene.title}`), state: clamp(state) };
  }

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
    timestamps: scene.startedAt ? { start: scene.startedAt } : undefined,
  };
}

// The client_id rides in the query string, so Discord greets with DISPATCH/READY
// on connect with no handshake. `onClose` fires once, terminally: no port
// answered or an established socket dropped.
function createRpcConnection({ onReady, onClose }) {
  let live = null;
  let portIdx = 0;
  let closed = false;

  const tryNextPort = () => {
    if (closed) return;
    if (portIdx >= RPC_PORTS.length) {
      onClose?.();
      return;
    }
    const port = RPC_PORTS[portIdx++];
    let socket;
    try {
      socket = new WebSocket(
        `ws://127.0.0.1:${port}/?v=1&client_id=${DISCORD_CLIENT_ID}&encoding=json`
      );
    } catch {
      tryNextPort(); // some browsers throw synchronously on a blocked loopback
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
    // Errors also fire close, which drives the state machine.
    socket.onerror = () => {};
    socket.onclose = () => {
      if (closed) return;
      if (live === socket) {
        live = null;
        onClose?.();
      } else {
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

// The desktop app talks to Discord's IPC itself, so there is no WebSocket and
// no origin check to get past. It is always "ready"; without Discord running
// the updates go nowhere, quietly.
function createNativeConnection({ onReady }) {
  const discord = window.CrimsonNative.discord;
  queueMicrotask(() => onReady?.());
  return {
    send(payload) {
      discord.setActivity(DISCORD_CLIENT_ID, payload.args.activity).catch(() => {});
      return true;
    },
    close() {},
  };
}

const setActivityFrame = (activity) => ({
  cmd: 'SET_ACTIVITY',
  nonce: nonce(),
  args: { pid: PID, activity },
});

// Mount once at the app root.
export function useDiscordPresence() {
  const [enabled, setEnabled] = useState(() => getPlaybackPrefs().discordPresence);

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
    const native = Boolean(window.CrimsonNative?.discord);
    if (!native && typeof WebSocket === 'undefined') return;

    let cancelled = false;
    let conn = null;
    let ready = false;
    let pushTimer = null;
    let retryTimer = null;
    let music = musicScene(getPlayerState());

    const push = () => {
      if (conn && ready) conn.send(setActivityFrame(buildActivity(music || _activity)));
    };
    const schedulePush = () => {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(push, 400);
    };

    const connect = () => {
      if (cancelled) return;
      let cycleReady = false;
      conn = (native ? createNativeConnection : createRpcConnection)({
        onReady: () => { cycleReady = true; ready = true; push(); },
        onClose: () => {
          ready = false;
          conn = null;
          if (cancelled) return;
          // Only a dropped working connection retries. Re-probing when nothing
          // ever answered would spam failed-WebSocket logs for everyone without
          // a bridge.
          if (cycleReady) retryTimer = setTimeout(connect, 15_000);
        },
      });
    };

    const unsubscribe = subscribe(schedulePush);
    const unsubscribePlayer = subscribeToPlayer(() => {
      const next = musicScene(getPlayerState());
      if (sameMusic(music, next)) return;
      music = next;
      schedulePush();
    });
    connect();

    return () => {
      cancelled = true;
      clearTimeout(pushTimer);
      clearTimeout(retryTimer);
      unsubscribe();
      unsubscribePlayer();
      if (conn) {
        // Otherwise the presence lingers after logout.
        conn.send(setActivityFrame(null));
        conn.close();
      }
    };
  }, [enabled]);
}
