// Lumi as a DJ. She picks a theme and a few songs from the member's library, the
// player plays them, and a little before the set runs out the next one is fetched
// and appended, so the music never stops for her to think. Playing anything else
// ends the DJ session, the way picking a playlist ends Spotify's DJ.
import { useSyncExternalStore } from 'react';

import { apiFetch, extractError } from '../api/client';
import {
  appendTracks, currentTrack, getState as getPlayer, playTracks, subscribe as subscribePlayer,
} from './player';

// Two songs of warning leaves time for a slow model without ending a set early.
const FETCH_WHEN_LEFT = 2;
// The backend only avoids repeating this many, so a long session sends no more.
const PLAYED_SENT = 500;

// `failedAt` is the queue position a fetch failed at; the next song tries again.
const IDLE = { active: false, loading: false, error: null, failedAt: null, sets: [] };
let state = IDLE;
const listeners = new Set();

function emit(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getDjState = () => state;

export function useDj() {
  return useSyncExternalStore(subscribe, getDjState, getDjState);
}

async function fetchSet(player, sets) {
  const res = await apiFetch('/chat/dj', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      played_ids: player.tracks.slice(-PLAYED_SENT).map((t) => t.id),
      themes: sets.map((s) => s.theme),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractError(data, 'Lumi would not take the decks.'));
  return data;
}

// The set the song at `trackIndex` belongs to: the last one that starts at or before it.
export function setFor(sets, trackIndex) {
  let found = null;
  for (const set of sets) {
    if (set.firstIndex <= trackIndex) found = set;
  }
  return found;
}

export function needsNextSet(player) {
  return player.position >= 0 && player.order.length - player.position <= FETCH_WHEN_LEFT;
}

const DJ_SOURCE = { name: 'Lumi DJ', dj: true };

// Safari may refuse to start audio this late after the tap; the player then
// shows paused and one more tap on play starts the set.
// Resolves whether a set started.
export async function startDj() {
  if (state.loading) return false;
  emit({ ...IDLE, loading: true });
  try {
    const set = await fetchSet({ tracks: [] }, []);
    emit({ active: true, loading: false, sets: [{ theme: set.theme, intro: set.intro, firstIndex: 0 }] });
    playTracks(set.tracks, 0, DJ_SOURCE, { shuffle: false });
    return true;
  } catch (err) {
    emit({ loading: false, error: err.message });
    return false;
  }
}

export function stopDj() {
  state = IDLE;
  for (const listener of listeners) listener();
}

async function extend() {
  emit({ loading: true });
  try {
    const player = getPlayer();
    const set = await fetchSet(player, state.sets);
    if (!state.active) return;
    const firstIndex = getPlayer().tracks.length;
    emit({
      loading: false, error: null, failedAt: null, sets: [...state.sets, { theme: set.theme, intro: set.intro, firstIndex }],
    });
    appendTracks(set.tracks);
  } catch (err) {
    emit({ loading: false, error: err.message, failedAt: getPlayer().position });
  }
}

subscribePlayer(() => {
  if (!state.active) return;
  const player = getPlayer();
  if (!player.source?.dj) {
    stopDj();
    return;
  }
  if (!state.loading && state.failedAt !== player.position && needsNextSet(player)) extend();
});

// The set playing now, for the Now Playing card.
export function currentSet(dj = state, player = getPlayer()) {
  if (!dj.active || !currentTrack(player)) return null;
  return setFor(dj.sets, player.order[player.position]);
}
