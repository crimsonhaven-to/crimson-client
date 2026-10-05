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

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeSaved(entries) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(entries));
  } catch {
    // Quota: the copies stay, but this list is not remembered past a reload.
  }
}

// progress: { [id]: { done, total, bytes } } for the running download, never
// persisted. waiting: why the queue is not resolving its next link, or null.
let state = { entries: readSaved(), progress: {}, waiting: null };
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
  writeSaved(entries);
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

export function resetAll() {
  writeSaved({});
  emit({ entries: {}, progress: {}, waiting: null });
}

const byEpisode = (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0);

// One group per movie or show, the most recently added first, its episodes in order.
export function titlesOf(entries) {
  const groups = new Map();
  for (const entry of Object.values(entries)) {
    let group = groups.get(entry.titleKey);
    if (!group) {
      group = { key: entry.titleKey, name: entry.titleName, poster: entry.poster, href: entry.href, entries: [], addedAt: 0 };
      groups.set(entry.titleKey, group);
    }
    group.entries.push(entry);
    group.addedAt = Math.max(group.addedAt, entry.addedAt || 0);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, entries: group.entries.sort(byEpisode) }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

export function nextQueued(entries) {
  return Object.values(entries)
    .filter((e) => e.status === 'queued')
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))[0] || null;
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
