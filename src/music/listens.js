// What this device listened to, reported for Crimson Wrapped. A song counts
// once it has really played for 30 seconds (Spotify's rule), and the seconds
// are time spent playing, not how far the scrubber got, so seeking about does
// not inflate anything.
//
// Reports wait in an outbox in localStorage until the backend takes them,
// because the songs that most need counting are the ones played offline: a
// download in the car, a tunnel. The song playing now is kept there too, so a
// PWA swept from memory mid-song still counts it on the next launch.
import { apiFetch, getSessionToken } from '../hooks/apiClient';

const OUTBOX_KEY = 'crimson:music-listens';
const CURRENT_KEY = 'crimson:music-listening';
export const MIN_SECONDS = 30;
// A gap larger than this between two time updates is a seek or a stall, not
// listening.
const MAX_STEP_SECONDS = 1.5;
const MAX_OUTBOX = 1000;
const BATCH = 200;
const PERSIST_EVERY_MS = 10_000;

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or a private window: this song goes uncounted.
  }
}

// A listen as the backend takes it, or null when it is too short to count.
export function toReport(listen) {
  if (!listen || listen.seconds < MIN_SECONDS) return null;
  return { track_id: listen.track_id, listened_at: listen.listened_at, seconds: Math.round(listen.seconds * 10) / 10 };
}

export function heardBetween(last, now) {
  if (last === null || !Number.isFinite(now)) return 0;
  const step = now - last;
  return step > 0 && step <= MAX_STEP_SECONDS ? step : 0;
}

// Restored from the last page life, so a song resumed after a reload goes on
// being one listen rather than two.
let current = read(CURRENT_KEY, null);
let restored = current !== null;
let lastPosition = null;
let lastPersisted = 0;

function commit() {
  const report = toReport(current);
  current = null;
  write(CURRENT_KEY, null);
  if (!report) return;
  const outbox = [...read(OUTBOX_KEY, []), report].slice(-MAX_OUTBOX);
  write(OUTBOX_KEY, outbox);
  flushListens();
}

// A song starts playing from the top: a new one, a repeat, or a restart.
export function beginListen(track) {
  lastPosition = null;
  if (restored && current?.track_id === track.id) {
    restored = false;
    return;
  }
  restored = false;
  commit();
  current = { track_id: track.id, listened_at: new Date().toISOString(), seconds: 0 };
}

// Called on every time update of the playing song.
export function heardUntil(position) {
  if (!current) return;
  current.seconds += heardBetween(lastPosition, position);
  lastPosition = position;
  if (Date.now() - lastPersisted > PERSIST_EVERY_MS) {
    lastPersisted = Date.now();
    write(CURRENT_KEY, current);
  }
}

export function endListen() {
  restored = false;
  lastPosition = null;
  commit();
}

let flushing = false;

export async function flushListens() {
  if (flushing || !getSessionToken() || !navigator.onLine) return;
  const batch = read(OUTBOX_KEY, []).slice(0, BATCH);
  if (!batch.length) return;
  flushing = true;
  try {
    const res = await apiFetch('/music/listens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listens: batch }),
      keepalive: true,
    });
    // A refusal (no music access, a malformed report) will not change on a
    // retry, so those are let go. A 401, a rate limit or a server error keeps them.
    const drop = res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429);
    if (drop) {
      const sent = new Set(batch.map((l) => `${l.track_id}@${l.listened_at}`));
      write(OUTBOX_KEY, read(OUTBOX_KEY, []).filter((l) => !sent.has(`${l.track_id}@${l.listened_at}`)));
    }
  } catch {
    // Offline after all. The next song or the next launch tries again.
  } finally {
    flushing = false;
  }
}

// On sign-out: another account may use this device next.
export function forgetListens() {
  current = null;
  restored = false;
  write(CURRENT_KEY, null);
  write(OUTBOX_KEY, null);
}

if (typeof window !== 'undefined') window.addEventListener('online', flushListens);
