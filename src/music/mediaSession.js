// The Media Session API: what Android shows on the lock screen and in the
// notification shade, and what a car receives over Bluetooth (title, artist,
// cover, and the play, pause, skip and seek buttons). Every call is guarded,
// because a browser without it must still play.

const supported = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator;

const FALLBACK_ART = [{ src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }];

export function bindMediaSession(actions) {
  if (!supported()) return;
  const handlers = {
    play: actions.play,
    pause: actions.pause,
    stop: actions.stop,
    nexttrack: actions.next,
    previoustrack: actions.previous,
    seekto: (details) => actions.seek(details.seekTime),
    seekbackward: (details) => actions.seekBy(-(details.seekOffset || 10)),
    seekforward: (details) => actions.seekBy(details.seekOffset || 10),
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // An action this browser does not know. The rest still work.
    }
  }
}

export function showTrack(track) {
  if (!supported() || typeof MediaMetadata === 'undefined') return;
  navigator.mediaSession.metadata = track
    ? new MediaMetadata({
      title: track.title,
      artist: (track.artists || []).join(', '),
      album: track.album || '',
      artwork: track.cover_url
        ? [{ src: track.cover_url, sizes: '512x512', type: 'image/jpeg' }]
        : FALLBACK_ART,
    })
    : null;
}

export function showPlaying(playing) {
  if (supported()) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

// Drives the scrubber on the lock screen. Browsers throw on a position past
// the duration or a duration that is not finite yet, so both are checked.
export function showPosition(duration, position) {
  if (!supported() || !navigator.mediaSession.setPositionState) return;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.min(Math.max(position, 0), duration),
      playbackRate: 1,
    });
  } catch {
    // Mid-transition values; the next timeupdate sets it right.
  }
}

export function clearMediaSession() {
  if (!supported()) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
}
