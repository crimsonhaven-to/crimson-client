// The music player: one <audio> element for the life of the app, a queue, and
// a tiny store React subscribes to. It lives outside React on purpose: playback
// must survive every route change, and Android keeps a page's audio going in
// the background (screen off, car on Bluetooth) only while that one element
// keeps playing. Swapping elements between tracks would drop the media session,
// so tracks change by swapping the element's src.
import { useSyncExternalStore } from 'react';

import {
  REPEAT_OFF,
  cycleRepeat,
  identityOrder,
  nextPosition,
  previousPosition,
  shuffledOrder,
} from './queue';
import { bindMediaSession, clearMediaSession, showPlaying, showPosition, showTrack } from './mediaSession';

const SAVED_KEY = 'crimson:music-queue';
// A run of tracks that will not play (expired links, a file gone from the
// share) stops here rather than spinning through the whole queue.
const MAX_SKIPS_ON_ERROR = 3;

const EMPTY = {
  tracks: [],
  order: [],
  position: -1,
  playing: false,
  loading: false,
  currentTime: 0,
  duration: 0,
  shuffle: false,
  repeat: REPEAT_OFF,
  source: null,
  error: null,
};

let state = EMPTY;
let audio = null;
let failedInARow = 0;
let lastSavedAt = 0;
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

export function useMusicPlayer() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function currentTrack(s = state) {
  return s.position >= 0 ? s.tracks[s.order[s.position]] || null : null;
}

// --- persistence --------------------------------------------------------------
// The queue survives a reload or the PWA being swept from memory, so getting
// back in the car picks up where it stopped. Per device, and optional: a
// browser without storage just starts empty.
function save() {
  try {
    if (!state.tracks.length) {
      localStorage.removeItem(SAVED_KEY);
      return;
    }
    const { tracks, order, position, shuffle, repeat, source } = state;
    const time = audio ? audio.currentTime : state.currentTime;
    localStorage.setItem(SAVED_KEY, JSON.stringify({ tracks, order, position, shuffle, repeat, source, time }));
  } catch {
    // Quota or a private window.
  }
}

export function restoreQueue() {
  if (state.tracks.length) return;
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null');
  } catch {
    saved = null;
  }
  if (!saved?.tracks?.length || saved.position < 0) return;
  emit({
    tracks: saved.tracks,
    order: saved.order,
    position: saved.position,
    shuffle: !!saved.shuffle,
    repeat: saved.repeat || REPEAT_OFF,
    source: saved.source || null,
  });
  load(saved.position, false, saved.time || 0);
}

// --- the element ----------------------------------------------------------------
function element() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'auto';
  audio.addEventListener('play', () => { emit({ playing: true }); showPlaying(true); });
  audio.addEventListener('pause', () => { emit({ playing: false }); showPlaying(false); save(); });
  audio.addEventListener('waiting', () => emit({ loading: true }));
  audio.addEventListener('playing', () => {
    failedInARow = 0;
    emit({ loading: false, playing: true, error: null });
  });
  audio.addEventListener('loadedmetadata', () => {
    emit({ duration: audio.duration });
    showPosition(audio.duration, audio.currentTime);
  });
  audio.addEventListener('timeupdate', () => {
    emit({ currentTime: audio.currentTime });
    showPosition(audio.duration, audio.currentTime);
    if (Date.now() - lastSavedAt > 10_000) {
      lastSavedAt = Date.now();
      save();
    }
  });
  audio.addEventListener('ended', () => advance(false));
  audio.addEventListener('error', onError);

  bindMediaSession({ play, pause, stop: close, next: () => advance(true), previous, seek, seekBy });

  // A video starting anywhere in the app should not play over the music.
  document.addEventListener('play', (event) => {
    if (event.target instanceof HTMLVideoElement) pause();
  }, true);
  return audio;
}

function onError() {
  const track = currentTrack();
  failedInARow += 1;
  emit({ loading: false, error: track ? `Could not play ${track.title}.` : 'Playback failed.' });
  if (failedInARow < MAX_SKIPS_ON_ERROR && state.tracks.length > 1) advance(true);
}

function load(position, autoplay, startAt = 0) {
  const track = state.tracks[state.order[position]];
  if (!track) return;
  const el = element();
  emit({ position, currentTime: startAt, duration: track.duration_ms / 1000, loading: autoplay, error: null });
  el.src = track.stream_url;
  if (startAt > 0) {
    el.addEventListener('loadedmetadata', () => { el.currentTime = startAt; }, { once: true });
  }
  showTrack(track);
  save();
  if (autoplay) play();
}

// --- controls -------------------------------------------------------------------
export function play() {
  const el = element();
  if (!el.src && state.position >= 0) {
    load(state.position, true);
    return;
  }
  el.play().catch((err) => {
    // Autoplay refusal needs a tap on play; anything else is a real failure.
    if (err?.name !== 'AbortError') emit({ loading: false, playing: false });
  });
}

export function pause() {
  if (audio) audio.pause();
}

export function toggle() {
  if (state.playing) pause();
  else play();
}

export function seek(seconds) {
  if (!audio || !Number.isFinite(seconds)) return;
  audio.currentTime = Math.max(0, seconds);
  emit({ currentTime: audio.currentTime });
}

export function seekBy(delta) {
  if (audio) seek(audio.currentTime + delta);
}

function advance(manual) {
  const position = nextPosition(state.position, state.order.length, state.repeat, manual);
  if (position === -1) {
    pause();
    seek(0);
    return;
  }
  if (position === state.position) {
    seek(0);
    play();
    return;
  }
  load(position, true);
}

export function next() {
  advance(true);
}

export function previous() {
  const elapsed = audio ? audio.currentTime : 0;
  const position = previousPosition(state.position, state.order.length, elapsed, state.repeat);
  if (position === state.position) {
    seek(0);
    return;
  }
  if (position >= 0) load(position, true);
}

// `tracks` are what can play (each has a stream_url); `start` indexes into
// them. `source` names where they came from, for the Now Playing header.
export function playTracks(tracks, start = 0, source = null, { shuffle = state.shuffle } = {}) {
  const playable = tracks.filter((t) => t.stream_url);
  if (!playable.length) return;
  const startIndex = Math.max(0, playable.indexOf(tracks[start]));
  const order = shuffle ? shuffledOrder(playable.length, startIndex) : identityOrder(playable.length);
  failedInARow = 0;
  emit({ tracks: playable, order, shuffle, source });
  load(order.indexOf(startIndex), true);
}

export function toggleShuffle() {
  if (!state.tracks.length) {
    emit({ shuffle: !state.shuffle });
    return;
  }
  const current = state.order[state.position];
  if (state.shuffle) {
    emit({ shuffle: false, order: identityOrder(state.tracks.length), position: current });
  } else {
    emit({ shuffle: true, order: shuffledOrder(state.tracks.length, current), position: 0 });
  }
  save();
}

export function toggleRepeat() {
  emit({ repeat: cycleRepeat(state.repeat) });
  save();
}

export function playAt(position) {
  if (position >= 0 && position < state.order.length) load(position, true);
}

export function close() {
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  state = EMPTY;
  for (const listener of listeners) listener();
  clearMediaSession();
  save();
}
