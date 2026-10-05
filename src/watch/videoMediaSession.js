// What the OS media controls (Windows' overlay, MPRIS on Linux, the lock
// screen) show while a video is on screen. The music player binds the media
// keys to itself, which would resume a song instead of pausing the film, so
// its handlers are released here and Chromium's defaults drive the <video>.
const ACTIONS = ['play', 'pause', 'stop', 'nexttrack', 'previoustrack', 'seekto', 'seekbackward', 'seekforward'];

const supported = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator
  && typeof MediaMetadata !== 'undefined';

export function showVideo({ title, detail }) {
  if (!supported()) return;
  for (const action of ACTIONS) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {
      // An action this browser does not know.
    }
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist: detail || '',
    artwork: [{ src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }],
  });
}

export function clearVideo() {
  if (supported()) navigator.mediaSession.metadata = null;
}
