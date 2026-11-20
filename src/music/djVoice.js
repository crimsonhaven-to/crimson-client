// Lumi speaks a set's intro over the start of its first song with the music
// lowered under her, the way Spotify's DJ talks over an intro.
import { setDucked } from './player';

let voice = null;

export function hush() {
  if (!voice) return;
  const clip = voice;
  voice = null;
  clip.pause();
  setDucked(false);
}

export const isSpeaking = () => voice !== null;

// `wav` is the base64 WAV the backend sends with the set.
export function speak(wav) {
  hush();
  const clip = new Audio(`data:audio/wav;base64,${wav}`);
  voice = clip;
  const done = () => {
    if (voice === clip) hush();
  };
  clip.addEventListener('ended', done);
  clip.addEventListener('error', done);
  setDucked(true);
  // A refused autoplay leaves the music playing on without her.
  clip.play().catch(done);
}
