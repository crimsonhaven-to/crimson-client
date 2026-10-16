// What this device keeps for watching offline, remembered in localStorage so the
// Downloads page still lists it with no connection. The video itself lives in
// videoStore's cache.
//
// An entry: { id, titleKey, titleName, poster, href, kind ('movie' | 'episode'),
//   season, episode, episodeTitle, target: { path, ctx }, subtitleQuery,
//   wanted: { source, language }, status ('queued' | 'downloading' | 'done' |
//   'failed'), error, source, format ('hls' | 'mp4'), bytes, layout, subtitles,
//   position, duration, addedAt }
import { useSyncExternalStore } from 'react';

const SAVED_KEY = 'crimson:video-downloads';
const PREFS_KEY = 'crimson:video-downloads-prefs';
const DEFAULT_PREFS = { paused: false, autoDelete: false };

function readSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch {
    return {};
  }
}

function writeSaved(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota: the copies stay, but this list is not remembered past a reload.
  }
}

// progress: { [id]: { done, total, bytes } } for the running download, never
// persisted. waiting: why the queue is not resolving its next link, or null.
// prefs: { paused, autoDelete }, kept per device like the downloads themselves.
let state = {
  entries: readSaved(SAVED_KEY),
  progress: {},
  waiting: null,
  prefs: { ...DEFAULT_PREFS, ...readSaved(PREFS_KEY) },
};
const listeners = new Set();

function emit(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getState = () => state;

export function useVideoDownloads() {
  return useSyncExternalStore(subscribe, getState, getState);
}

function saveEntries(entries) {
  writeSaved(SAVED_KEY, entries);
  emit({ entries });
}

export function putEntries(added) {
  saveEntries({ ...state.entries, ...added });
}

export function patchEntry(id, patch) {
  if (!state.entries[id]) return;
  saveEntries({ ...state.entries, [id]: { ...state.entries[id], ...patch } });
}

export function dropEntry(id) {
  const entries = { ...state.entries };
  delete entries[id];
  saveEntries(entries);
  setProgress(id, null);
}

export function setProgress(id, progress) {
  const next = { ...state.progress };
  if (progress) next[id] = progress;
  else delete next[id];
  emit({ progress: next });
}

export function setWaiting(waiting) {
  if (state.waiting !== waiting) emit({ waiting });
}

export function setPrefs(patch) {
  const prefs = { ...state.prefs, ...patch };
  writeSaved(PREFS_KEY, prefs);
  emit({ prefs });
}

export function resetAll() {
  writeSaved(SAVED_KEY, {});
  emit({ entries: {}, progress: {}, waiting: null });
}

const byEpisode = (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0);

// One group per movie or show, the most recently added first (or the largest
// first, by: 'size'), its episodes in order. bytes counts finished copies only.
export function titlesOf(entries, { by = 'added' } = {}) {
  const groups = new Map();
  for (const entry of Object.values(entries)) {
    let group = groups.get(entry.titleKey);
    if (!group) {
      group = { key: entry.titleKey, name: entry.titleName, poster: entry.poster, href: entry.href, entries: [], addedAt: 0, bytes: 0 };
      groups.set(entry.titleKey, group);
    }
    group.entries.push(entry);
    group.addedAt = Math.max(group.addedAt, entry.addedAt || 0);
    if (entry.status === 'done') group.bytes += entry.bytes || 0;
  }
  return [...groups.values()]
    .map((group) => ({ ...group, entries: group.entries.sort(byEpisode) }))
    .sort(by === 'size' ? (a, b) => b.bytes - a.bytes : (a, b) => b.addedAt - a.addedAt);
}

export function queuedOf(entries) {
  return Object.values(entries)
    .filter((e) => e.status === 'queued')
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
}

export const nextQueued = (entries) => queuedOf(entries)[0] || null;

// The queue runs in addedAt order, so moving hands the queued entries' own
// timestamps back out in the new order.
export function moveQueued(id, index) {
  const queued = queuedOf(state.entries);
  const from = queued.findIndex((e) => e.id === id);
  if (from < 0) return;
  const stamps = queued.map((e) => e.addedAt || 0);
  const [moved] = queued.splice(from, 1);
  queued.splice(Math.max(0, Math.min(index, queued.length)), 0, moved);
  const entries = { ...state.entries };
  queued.forEach((e, i) => { entries[e.id] = { ...e, addedAt: stamps[i] }; });
  saveEntries(entries);
}

// The next kept episode of the same title, for the offline player's Next button.
export function nextKept(entries, id) {
  const entry = entries[id];
  if (!entry || entry.kind !== 'episode') return null;
  return Object.values(entries)
    .filter((e) => e.titleKey === entry.titleKey && e.status === 'done' && byEpisode(e, entry) > 0)
    .sort(byEpisode)[0] || null;
}

export const hasVideoDownloads = () => Object.keys(state.entries).length > 0;
