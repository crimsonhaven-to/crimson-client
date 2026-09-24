// Queue arithmetic for the music player, kept free of the audio element so it
// can be tested on its own. `order` is the play order as indices into the
// track list: identity normally, a shuffle of it in shuffle mode.

export const REPEAT_OFF = 'off';
export const REPEAT_ALL = 'all';
export const REPEAT_ONE = 'one';

export function identityOrder(length) {
  return Array.from({ length }, (_, i) => i);
}

// Fisher-Yates, with the current track moved to the front so turning shuffle
// on never interrupts what is playing.
export function shuffledOrder(length, current, random = Math.random) {
  const order = identityOrder(length).filter((i) => i !== current);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return current >= 0 && current < length ? [current, ...order] : order;
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
