// Queue arithmetic for the music player, kept free of the audio element so it
// can be tested on its own. `order` is the play order as indices into the
// track list: identity normally, a shuffle of it in shuffle mode.

export const REPEAT_OFF = 'off';
export const REPEAT_ALL = 'all';
export const REPEAT_ONE = 'one';

export function identityOrder(length) {
  return Array.from({ length }, (_, i) => i);
}

function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Fisher-Yates, with the current track moved to the front so turning shuffle
// on never interrupts what is playing.
export function shuffledOrder(length, current, random = Math.random) {
  const order = shuffle(identityOrder(length).filter((i) => i !== current), random);
  return current >= 0 && current < length ? [current, ...order] : order;
}

// "Add to queue" puts songs after the one playing and after anything queued
// before them, so they play in the order they were added, ahead of the rest.
// `queueEnd` is the position just past the last queued song.
export function queueInsert(order, position, queueEnd, indices) {
  const at = Math.max(position + 1, queueEnd);
  return {
    order: [...order.slice(0, at), ...indices, ...order.slice(at)],
    queueEnd: at + indices.length,
  };
}

// The play order after shuffle is switched on or off. The song playing stays
// put and the queued songs stay right behind it; only the rest moves.
export function reorder(order, position, queueEnd, shuffled, random = Math.random) {
  const current = order[position];
  const queued = order.slice(position + 1, Math.max(position + 1, queueEnd));
  const held = new Set([current, ...queued]);
  const rest = identityOrder(order.length).filter((i) => !held.has(i));
  if (shuffled) {
    const next = [current, ...queued, ...shuffle(rest, random)];
    return { order: next, position: 0, queueEnd: queued.length ? queued.length + 1 : 0 };
  }
  const before = rest.filter((i) => i < current);
  const after = rest.filter((i) => i > current);
  const next = [...before, current, ...queued, ...after];
  return {
    order: next,
    position: before.length,
    queueEnd: queued.length ? before.length + 1 + queued.length : 0,
  };
}

// The position in `order` to play after `position`, or -1 to stop. `manual`
// is a press of the next button, which skips even a repeated single track.
export function nextPosition(position, length, repeat, manual = false) {
  if (length === 0) return -1;
  if (repeat === REPEAT_ONE && !manual) return position;
  if (position + 1 < length) return position + 1;
  return repeat === REPEAT_OFF ? -1 : 0;
}

// Previous restarts the current track once it has played a few seconds, the
// way every music player does, and only then steps back.
export const RESTART_AFTER_SECONDS = 3;

export function previousPosition(position, length, elapsedSeconds, repeat) {
  if (length === 0) return -1;
  if (elapsedSeconds > RESTART_AFTER_SECONDS) return position;
  if (position > 0) return position - 1;
  return repeat === REPEAT_ALL ? length - 1 : 0;
}

// The positions that will play after `position` if nothing is skipped, at most
// `count`, for keeping them ready on the device. Repeat one still looks ahead
// in the order, because the next song is one press away.
export function upcomingPositions(position, length, repeat, count) {
  const upcoming = [];
  for (let step = 1; step <= count && step < length; step += 1) {
    const next = position + step;
    if (next < length) upcoming.push(next);
    else if (repeat !== REPEAT_OFF) upcoming.push(next % length);
  }
  return upcoming;
}

export function cycleRepeat(repeat) {
  if (repeat === REPEAT_OFF) return REPEAT_ALL;
  if (repeat === REPEAT_ALL) return REPEAT_ONE;
  return REPEAT_OFF;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = String(whole % 60).padStart(2, '0');
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
