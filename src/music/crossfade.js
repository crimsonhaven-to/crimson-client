// Crossfade: the last seconds of a song blend into the start of the next one.
// A per-device setting like preloading, since headphones on a phone and
// speakers on a laptop want different things. Off by default.
const SETTING_KEY = 'crimson:music-crossfade';
export const MIN_SECONDS = 3;
export const MAX_SECONDS = 8;
const DEFAULT = { on: false, seconds: 5 };

export function parseSetting(raw) {
  let saved;
  try {
    saved = JSON.parse(raw || 'null');
  } catch {
    saved = null;
  }
  const seconds = Math.round(Number(saved?.seconds));
  return {
    on: saved?.on === true,
    seconds: seconds >= MIN_SECONDS && seconds <= MAX_SECONDS ? seconds : DEFAULT.seconds,
  };
}

export function crossfadeSetting() {
  try {
    return parseSetting(localStorage.getItem(SETTING_KEY));
  } catch {
    return DEFAULT;
  }
}

export function setCrossfadeSetting(setting) {
  try {
    localStorage.setItem(SETTING_KEY, JSON.stringify(setting));
  } catch {
    // A private window: the default stays.
  }
}

// iPhones and iPads ignore a page setting an audio element's volume, so a fade
// there would be two songs at full volume at once. Those switch songs as before.
let volumeWorks = null;
export function canCrossfade() {
  if (volumeWorks === null) {
    try {
      const probe = new Audio();
      probe.volume = 0.5;
      volumeWorks = probe.volume === 0.5;
    } catch {
      volumeWorks = false;
    }
  }
  return volumeWorks;
}

// How long the current fade should last, or 0 for none.
export function crossfadeSeconds() {
  const { on, seconds } = crossfadeSetting();
  return on && canCrossfade() ? seconds : 0;
}

// Equal power, so the blend does not dip in loudness halfway through the way
// two straight lines would.
export function fadeVolumes(progress) {
  const p = Math.min(Math.max(progress, 0), 1);
  return { incoming: Math.sin((p * Math.PI) / 2), outgoing: Math.cos((p * Math.PI) / 2) };
}
