// Lives outside React so playback survives route changes, and Android only keeps a
// page's audio alive in the background while something on it keeps playing.
//
// Two decks: the next song is loaded on the idle one while the current one plays, then
// started inside the old one's `ended` handler. Android freezes a hidden page the moment
// it goes quiet, and awaiting a read from the device between songs was long enough to
// lose the race and stop the music a few songs in. The same idle deck carries the
// crossfade. Only the playing deck's events reach the store.
import { useSyncExternalStore } from 'react';

import {
  REPEAT_OFF,
  cycleRepeat,
  identityOrder,
  nextPosition,
  previousPosition,
  shuffledOrder,
  upcomingPositions,
} from './queue';
import { preloadAhead, preloadCount } from './preload';
import { localAudio } from './trackStore';
import { bindMediaSession, clearMediaSession, showPlaying, showPosition, showTrack } from './mediaSession';
import { crossfadeSeconds, fadeVolumes } from './crossfade';
import { beginListen, endListen, flushListens, heardUntil } from './listens';

const SAVED_KEY = 'crimson:music-queue';
// A run of tracks that will not play (expired links, a file gone from the
// share) stops here rather than spinning through the whole queue.
const MAX_SKIPS_ON_ERROR = 3;
const FADE_STEP_MS = 50;
// Early enough that a slow read from the device or a stream that has to buffer is
// ready before the song ends, late enough not to fetch songs that get skipped.
const ARM_AHEAD_SECONDS = 30;

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
let decks = [];
// The deck playing the current song.
let audio = null;
// The object URL of the device copy each deck plays, released when it loads another.
const objectUrls = new Map();
// A crossfade in progress: { outgoing, timer, step }.
let fade = null;
// The next song on the idle deck: { deck, position, ready }.
let armed = null;
let failedInARow = 0;
let lastSavedAt = 0;
// Counts loads, so a slow read from the device cannot start a song the member
// has already skipped past.
let loadCount = 0;
const listeners = new Set();

function emit(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

// Exported for code outside React (the Discord presence), which must not re-render
// the app on every time update.
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getState = () => state;

export function useMusicPlayer() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function currentTrack(s = state) {
  return s.position >= 0 ? s.tracks[s.order[s.position]] || null : null;
}

// Survives a reload or the PWA being swept from memory, so getting back in the car
// picks up where it stopped.
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
  flushListens();
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

function createDeck() {
  const deck = new Audio();
  deck.preload = 'auto';
  const on = (type, handler) => deck.addEventListener(type, (event) => {
    if (deck === audio) handler(event);
  });
  on('play', () => { emit({ playing: true }); showPlaying(true); });
  on('pause', () => {
    emit({ playing: false });
    showPlaying(false);
    syncPosition();
    save();
  });
  on('waiting', () => emit({ loading: true }));
  on('playing', () => {
    failedInARow = 0;
    emit({ loading: false, playing: true, error: null });
    syncPosition();
    preloadNext();
  });
  on('loadedmetadata', () => {
    emit({ duration: deck.duration });
    syncPosition();
  });
  on('seeked', syncPosition);
  on('ratechange', syncPosition);
  // No lock screen update here: it counts forward by itself from the last jump,
  // which is how the Media Session API expects to be fed.
  on('timeupdate', () => {
    emit({ currentTime: deck.currentTime });
    if (!deck.paused) heardUntil(deck.currentTime);
    if (Date.now() - lastSavedAt > 10_000) {
      lastSavedAt = Date.now();
      save();
    }
    if (fade?.step) {
      fade.step();
    } else {
      maybeArm();
      maybeCrossfade();
    }
  });
  on('ended', () => advance(false));
  on('error', onError);
  return deck;
}

function element() {
  if (audio) return audio;
  decks = [createDeck(), createDeck()];
  audio = decks[0];

  bindMediaSession({ play, pause, stop: close, next: () => advance(true), previous, seek, seekBy });

  // A video starting anywhere in the app should not play over the music.
  document.addEventListener('play', (event) => {
    if (event.target instanceof HTMLVideoElement) pause();
  }, true);
  return audio;
}

function syncPosition() {
  showPosition(audio.duration, audio.currentTime, audio.playbackRate);
}

function preloadNext() {
  const upcoming = upcomingPositions(state.position, state.order.length, state.repeat, preloadCount())
    .map((position) => state.tracks[state.order[position]]);
  preloadAhead(currentTrack(), upcoming);
}

async function sourceFor(track) {
  const copy = await localAudio(track.id).catch(() => null);
  return copy ? { url: URL.createObjectURL(copy), local: true } : { url: track.stream_url, local: false };
}

function setSource(deck, { url, local }) {
  const previous = objectUrls.get(deck);
  if (local) objectUrls.set(deck, url);
  else objectUrls.delete(deck);
  deck.src = url;
  if (previous) URL.revokeObjectURL(previous);
}

function silence(deck) {
  deck.pause();
  deck.removeAttribute('src');
  deck.load();
  deck.volume = 1;
  const url = objectUrls.get(deck);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(deck);
}

function onError() {
  const track = currentTrack();
  // A broken copy on the device: the server still has the song.
  if (objectUrls.has(audio) && track?.stream_url) {
    setSource(audio, { url: track.stream_url, local: false });
    play();
    return;
  }
  failedInARow += 1;
  emit({ loading: false, error: track ? `Could not play ${track.title}.` : 'Playback failed.' });
  if (failedInARow < MAX_SKIPS_ON_ERROR && state.tracks.length > 1) advance(true);
}

function announce(position, track, startAt, autoplay) {
  emit({ position, currentTime: startAt, duration: track.duration_ms / 1000, loading: autoplay, error: null });
  // The last song's position must not linger on the lock screen until this one's metadata loads.
  showPosition(0, 0);
  showTrack(track);
  beginListen(track);
  save();
}

async function load(position, autoplay, startAt = 0) {
  const track = state.tracks[state.order[position]];
  if (!track) return;
  stopFade();
  disarm();
  const deck = element();
  const thisLoad = ++loadCount;
  announce(position, track, startAt, autoplay);
  const source = await sourceFor(track);
  if (thisLoad !== loadCount) {
    if (source.local) URL.revokeObjectURL(source.url);
    return;
  }
  setSource(deck, source);
  if (startAt > 0) {
    deck.addEventListener('loadedmetadata', () => { deck.currentTime = startAt; }, { once: true });
  }
  if (autoplay) play();
}

// The position that plays when this song ends by itself, or -1 when nothing new does.
function followingPosition() {
  const position = nextPosition(state.position, state.order.length, state.repeat, false);
  // The end of the queue and a song on repeat need no second deck.
  return position === state.position ? -1 : position;
}

async function maybeArm() {
  if (armed || fade || audio.paused) return;
  const remaining = audio.duration - audio.currentTime;
  if (!Number.isFinite(remaining) || remaining > crossfadeSeconds() + ARM_AHEAD_SECONDS) return;
  const position = followingPosition();
  const track = state.tracks[state.order[position]];
  if (!track) return;
  const thisArm = { deck: decks.find((deck) => deck !== audio), position, ready: false };
  armed = thisArm;
  const source = await sourceFor(track);
  if (armed !== thisArm) {
    if (source.local) URL.revokeObjectURL(source.url);
    return;
  }
  setSource(thisArm.deck, source);
  thisArm.ready = true;
  // The read may have finished after the fade was already due.
  maybeCrossfade();
}

function disarm() {
  if (!armed) return;
  const { deck } = armed;
  armed = null;
  if (deck !== audio) silence(deck);
}

// Moves playback to the armed deck. Synchronous on purpose, see the top of the file.
function takeArmed(position, volume) {
  if (!armed?.ready || armed.position !== position) return null;
  const outgoing = audio;
  audio = armed.deck;
  armed = null;
  loadCount += 1;
  audio.volume = volume;
  announce(position, state.tracks[state.order[position]], 0, true);
  play();
  return outgoing;
}

function maybeCrossfade() {
  const seconds = crossfadeSeconds();
  if (!seconds || fade || audio.paused) return;
  const remaining = audio.duration - audio.currentTime;
  // A song shorter than two fades would spend most of itself fading.
  if (!Number.isFinite(remaining) || remaining > seconds || audio.duration < seconds * 2) return;
  const position = followingPosition();
  if (position !== -1) crossfadeTo(position, seconds);
}

function crossfadeTo(position, seconds) {
  const incoming = armed?.deck;
  const outgoing = takeArmed(position, 0);
  if (!outgoing) return;
  // Paced by the new song's own clock, so a slow start (still buffering) holds
  // the old song up instead of the new one arriving at full volume. The time
  // updates step it too, since a phone with the screen off slows the timer down.
  const step = () => {
    const progress = incoming.currentTime / seconds;
    const volumes = fadeVolumes(progress);
    incoming.volume = volumes.incoming;
    outgoing.volume = volumes.outgoing;
    if (progress >= 1) stopFade();
  };
  fade = { outgoing, step, timer: setInterval(step, FADE_STEP_MS) };
}

// Ends a crossfade where it stands: the old song stops and the new one plays
// at full volume. Any control a member touches mid-fade lands here first.
function stopFade() {
  if (!fade) return;
  const { outgoing, timer } = fade;
  fade = null;
  clearInterval(timer);
  if (outgoing !== audio) silence(outgoing);
  audio.volume = 1;
}

export function play() {
  const deck = element();
  if (!deck.src && state.position >= 0) {
    load(state.position, true);
    return;
  }
  deck.play().catch((err) => {
    // Autoplay refusal needs a tap on play; anything else is a real failure.
    if (err?.name !== 'AbortError') emit({ loading: false, playing: false });
  });
}

export function pause() {
  stopFade();
  if (audio) audio.pause();
}

export function toggle() {
  if (state.playing) pause();
  else play();
}

export function seek(seconds) {
  if (!audio || !Number.isFinite(seconds)) return;
  stopFade();
  audio.currentTime = Math.max(0, seconds);
  emit({ currentTime: audio.currentTime });
}

export function seekBy(delta) {
  if (audio) seek(audio.currentTime + delta);
}

// The same song from the top counts as another listen.
function restart() {
  seek(0);
  const track = currentTrack();
  if (track) beginListen(track);
}

function advance(manual) {
  const position = nextPosition(state.position, state.order.length, state.repeat, manual);
  if (position === -1) {
    pause();
    seek(0);
    endListen();
    return;
  }
  if (position === state.position) {
    restart();
    play();
    return;
  }
  const finished = manual ? null : takeArmed(position, 1);
  if (finished) silence(finished);
  else load(position, true);
}

export function next() {
  advance(true);
}

export function previous() {
  const elapsed = audio ? audio.currentTime : 0;
  const position = previousPosition(state.position, state.order.length, elapsed, state.repeat);
  if (position === state.position) {
    restart();
    return;
  }
  if (position >= 0) load(position, true);
}

// `start` indexes into `tracks`; `source` labels the Now Playing header.
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
  disarm();
  save();
  preloadNext();
}

export function toggleRepeat() {
  emit({ repeat: cycleRepeat(state.repeat) });
  disarm();
  save();
  preloadNext();
}

export function playAt(position) {
  if (position >= 0 && position < state.order.length) load(position, true);
}

export function close() {
  loadCount += 1;
  stopFade();
  armed = null;
  decks.forEach(silence);
  endListen();
  state = EMPTY;
  for (const listener of listeners) listener();
  clearMediaSession();
  save();
}
