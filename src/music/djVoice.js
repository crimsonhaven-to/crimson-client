// Lumi speaks a set's intro over the start of its first song with the music
// lowered under her, the way Spotify's DJ talks over an intro.
import { setDucked } from './player';

let voice = null;

export function hush() {
  if (!voice) return;
  const { clip, url } = voice;
  voice = null;
  clip.pause();
  URL.revokeObjectURL(url);
  setDucked(false);
}

export const isSpeaking = () => voice !== null;

// The CSP's media-src allows blob: but not data:, so the WAV plays from an object URL.
export function wavBlob(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'audio/wav' });
}

// `wav` is the base64 WAV the backend sends with the set.
export function speak(wav) {
  hush();
  const url = URL.createObjectURL(wavBlob(wav));
  const clip = new Audio(url);
  const thisVoice = { clip, url };
  voice = thisVoice;
  const done = () => {
    if (voice === thisVoice) hush();
  };
  clip.addEventListener('ended', done);
  clip.addEventListener('error', done);
  setDucked(true);
  // A refused autoplay leaves the music playing on without her.
  clip.play().catch(done);
}
