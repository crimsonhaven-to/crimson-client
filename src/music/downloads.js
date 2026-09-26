// Playlists kept on this device for listening without a connection. What is
// downloaded is remembered per playlist, with the tracks as the API last listed
// them, so the Music pages can still show and play them offline. The audio and
// covers themselves live in trackStore's downloads cache, once per song however
// many downloaded playlists hold it.
//
// A downloaded playlist follows the server: opening it online, or starting the
// app online, fetches songs added since and lets go of songs removed.
import { useSyncExternalStore } from 'react';

import { musicApi } from '../hooks/music';
import {
  DOWNLOADS, coverKey, forget, forgetAll, storeAudio, storeCover, storedAudioIds, supported,
} from './trackStore';

const SAVED_KEY = 'crimson:music-downloads';

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeSaved(saved) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {
    // Quota: the songs stay, but this list is not remembered past a reload.
  }
}

// saved: { [playlistId]: { playlist, tracks } }. stored: ids of songs on the
// device. progress: { done, total } while downloading.
let state = { saved: readSaved(), stored: new Set(), progress: null, failed: 0 };
const listeners = new Set();

function emit(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getState = () => state;

export function useDownloads() {
  return useSyncExternalStore(subscribe, getState, getState);
}

if (supported()) storedAudioIds(DOWNLOADS).then((stored) => emit({ stored }));

// Every song the saved playlists hold that the device does not have yet, once
// each, and the stored songs that no saved playlist holds any more.
export function planDownloads(saved, storedIds) {
  const wanted = new Map();
  for (const { tracks } of Object.values(saved)) {
    for (const track of tracks) wanted.set(track.id, track);
  }
  return {
    fetch: [...wanted.values()].filter((t) => !storedIds.has(t.id)),
    drop: [...storedIds].filter((id) => !wanted.has(id)),
  };
}

// False once the member removed every downloaded playlist holding the song
// while a run was under way.
const stillWanted = (id) => Object.values(state.saved).some(({ tracks }) => tracks.some((t) => t.id === id));

let running = null;
let runAgain = false;

// One run at a time. A change during a run (a playlist added or removed)
// queues exactly one more run, which picks up whatever the change left.
function sync() {
  if (running) {
    runAgain = true;
    return running;
  }
  running = download().finally(() => {
    running = null;
    if (runAgain) {
      runAgain = false;
      sync();
    }
  });
  return running;
}

async function download() {
  if (!supported()) return;
  const plan = planDownloads(state.saved, state.stored);
  await forget(DOWNLOADS, plan.drop);
  const stored = new Set(state.stored);
  for (const id of plan.drop) stored.delete(id);
  emit({ stored, failed: 0 });
  if (!plan.fetch.length) return;

  let done = 0;
  let failed = 0;
  emit({ progress: { done, total: plan.fetch.length } });
  for (const track of plan.fetch) {
    if (!navigator.onLine) {
      failed += plan.fetch.length - done;
      break;
    }
    if (!stillWanted(track.id)) {
      done += 1;
      continue;
    }
    try {
      await storeAudio(DOWNLOADS, track);
      if (track.cover_url) await storeCover(DOWNLOADS, track).catch(() => {});
      emit({ stored: new Set(state.stored).add(track.id) });
    } catch {
      failed += 1;
    }
    done += 1;
    emit({ progress: { done, total: plan.fetch.length } });
  }
  emit({ progress: null, failed });
}

function save(saved) {
  writeSaved(saved);
  emit({ saved });
  return sync();
}

export function isDownloaded(playlistId, s = state) {
  return String(playlistId) in s.saved;
}

// The saved copy for offline use, covers pointed at the device's own copies.
// The playlist's own cover is not downloaded, so its first song's stands in.
export function savedPlaylist(playlistId, s = state) {
  const entry = s.saved[playlistId];
  if (!entry) return null;
  const tracks = entry.tracks.map((t) => ({ ...t, cover_url: t.cover_url ? coverKey(t.id) : null }));
  return {
    playlist: { ...entry.playlist, cover_url: tracks.find((t) => t.cover_url)?.cover_url || null },
    tracks,
  };
}

export function downloadPlaylist(playlist, tracks) {
  // Asks the browser not to evict the songs when space runs low. Installed
  // PWAs are usually granted this without a prompt.
  navigator.storage?.persist?.().catch(() => {});
  const ready = tracks.filter((t) => t.status === 'ready' && t.stream_url);
  return save({ ...state.saved, [playlist.id]: { playlist, tracks: ready } });
}

// A fresh listing from the server for a playlist already downloaded: it also
// brings fresh links for whatever is still missing.
export function refreshDownload(playlist, tracks) {
  if (!isDownloaded(playlist.id)) return undefined;
  return downloadPlaylist(playlist, tracks);
}

export function removeDownload(playlistId) {
  const saved = { ...state.saved };
  delete saved[playlistId];
  return save(saved);
}

// At app start, online: every downloaded playlist is listed again, which picks
// up songs added elsewhere and replaces links that expired while offline.
export async function resumeDownloads() {
  for (const id of Object.keys(state.saved)) {
    try {
      const { playlist, tracks } = await musicApi.playlist(id);
      refreshDownload(playlist, tracks);
    } catch (err) {
      if (err.status === 404) removeDownload(id);
    }
  }
  return sync();
}

// Signing out leaves nothing of the account's music on a shared device.
export async function forgetDownloads() {
  writeSaved({});
  emit({ saved: {}, stored: new Set(), progress: null, failed: 0 });
  await forgetAll();
}

export function hasDownloads() {
  return Object.keys(state.saved).length > 0;
}
