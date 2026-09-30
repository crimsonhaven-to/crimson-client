// Keeps the next few songs of the queue on the device, so a patchy connection
// (a tunnel, a dead spot on the motorway) does not stop the music between
// songs. How many is a per-device setting: a phone on a small data plan wants
// fewer than a laptop on Wi-Fi.
import { DOWNLOADS, PRELOADS, forget, storeAudio, storedAudioIds, supported } from './trackStore';

const SETTING_KEY = 'crimson:music-preload';
export const PRELOAD_CHOICES = [0, 3, 5, 10];
const DEFAULT_COUNT = 3;

export function preloadCount() {
  try {
    const saved = localStorage.getItem(SETTING_KEY);
    return saved !== null && PRELOAD_CHOICES.includes(Number(saved)) ? Number(saved) : DEFAULT_COUNT;
  } catch {
    return DEFAULT_COUNT;
  }
}

export function setPreloadCount(count) {
  try {
    localStorage.setItem(SETTING_KEY, String(count));
  } catch {
    // A private window: the default stays.
  }
  if (count === 0) clearPreloads();
}

// What to fetch and what to let go. The current song is kept too, so going
// back to it or repeating it does not fetch it again. Downloaded songs are
// already on the device and are never preloaded twice.
export function planPreload(currentId, upcoming, preloadedIds, downloadedIds) {
  const keep = new Set([currentId, ...upcoming.map((t) => t.id)]);
  return {
    fetch: upcoming.filter((t) => !preloadedIds.has(t.id) && !downloadedIds.has(t.id)),
    drop: [...preloadedIds].filter((id) => !keep.has(id)),
  };
}

let running = null;

// Called whenever the queue moves on. A new call cancels the previous run, so
// skipping through songs never leaves a pile of fetches behind.
export async function preloadAhead(current, upcoming) {
  running?.abort();
  if (!supported() || !current) return;
  const controller = new AbortController();
  running = controller;

  const [preloaded, downloaded] = await Promise.all([
    storedAudioIds(PRELOADS), storedAudioIds(DOWNLOADS),
  ]);
  if (controller.signal.aborted) return;
  const plan = planPreload(current.id, upcoming, preloaded, downloaded);
  await forget(PRELOADS, plan.drop);
  if (!navigator.onLine) return;

  // One at a time, in play order: the next song matters most.
  for (const track of plan.fetch) {
    if (controller.signal.aborted) return;
    try {
      await storeAudio(PRELOADS, track, controller.signal);
    } catch {
      // A dropped connection or an expired link: the song streams instead.
    }
  }
}

export async function clearPreloads() {
  running?.abort();
  if (supported()) await caches.delete(PRELOADS);
}
