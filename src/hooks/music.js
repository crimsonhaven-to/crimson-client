// --- Music library ---------------------------------------------------------
// The backend's /music API: the Spotify link, imported playlists, and the
// tracks that need a person to pick a recording. Downloads happen on the
// server's music worker, so while anything is queued the hooks poll to show
// tracks turning ready.
import { useCallback, useEffect, useState } from 'react';

import { apiFetch, extractError } from './apiClient';

const POLL_MS = 8000;

async function call(path, options = {}) {
  const init = { ...options };
  if (options.json !== undefined) {
    init.method = options.method || 'POST';
    init.headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    init.body = JSON.stringify(options.json);
    delete init.json;
  }
  const res = await apiFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(extractError(data, `Request failed (${res.status})`));
    error.status = res.status;
    throw error;
  }
  return data;
}

export const musicApi = {
  status: () => call('/music/status'),
  connectSpotify: (body) => call('/music/spotify/connect', { json: body }),
  disconnectSpotify: () => call('/music/spotify', { method: 'DELETE' }),
  spotifyPlaylists: () => call('/music/spotify/playlists'),
  playlists: () => call('/music/playlists'),
  importPlaylist: (source, playlist) => call('/music/playlists', { json: { source, playlist } }),
  importCsv: (name, csv) => call('/music/playlists/csv', { json: { name, csv } }),
  playlist: (id) => call(`/music/playlists/${id}`),
  setSync: (id, syncEnabled) =>
    call(`/music/playlists/${id}`, { method: 'PATCH', json: { sync_enabled: syncEnabled } }),
  sync: (id) => call(`/music/playlists/${id}/sync`, { method: 'POST' }),
  deletePlaylist: (id) => call(`/music/playlists/${id}`, { method: 'DELETE' }),
  candidates: (trackId) => call(`/music/tracks/${trackId}/candidates`),
  chooseMatch: (trackId, url) => call(`/music/tracks/${trackId}/match`, { json: { url } }),
  retry: (trackId) => call(`/music/tracks/${trackId}/retry`, { method: 'POST' }),
  search: (q) => call(`/music/search?${new URLSearchParams({ q })}`),
};

const BUSY = ['pending', 'working'];

// Loads `load(key)`, and polls while `isBusy(data)` says the worker still has
// work for this view. `load` and `isBusy` are module-level functions, so the
// data is named by `key` alone. `reload` is returned for after an action.
function usePolled(key, load, isBusy) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => load(key).then(
    (next) => { setData(next); setError(null); return next; },
    (err) => { setError(err); return null; },
  ).finally(() => setLoading(false)), [key, load]);

  useEffect(() => { reload(); }, [reload]);

  const busy = data ? isBusy(data) : false;
  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [busy, reload]);

  return { data, error, loading, reload };
}

const loadStatus = () => musicApi.status();
const statusBusy = (s) => BUSY.some((k) => s.counts?.[k] > 0);

const loadPlaylists = () => musicApi.playlists().then((d) => d.playlists);
const playlistsBusy = (list) => list.some(
  (p) => p.ready_count + p.review_count + p.problem_count < p.track_count + p.removed_count,
);

const loadPlaylist = (id) => musicApi.playlist(id);
const playlistBusy = (d) => d.tracks.some((t) => BUSY.includes(t.status));

export function useMusicStatus() {
  return usePolled('status', loadStatus, statusBusy);
}

export function useMusicPlaylists() {
  const state = usePolled('playlists', loadPlaylists, playlistsBusy);
  return { ...state, playlists: state.data || [] };
}

export function useMusicPlaylist(id) {
  const state = usePolled(id, loadPlaylist, playlistBusy);
  return { ...state, playlist: state.data?.playlist, tracks: state.data?.tracks || [] };
}
