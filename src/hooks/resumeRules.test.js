import { describe, it, expect } from 'vitest';
import { startsFresh } from './resumeRules';

// The rule: only a sequential advance out of a just-finished (>= 90%, matching
// the backend's completed inference) episode starts the target fresh. Everything
// else keeps the saved-position resume behaviour.
describe('startsFresh', () => {
  const done = { position: 1395, duration: 1400 };   // ~99.6%
  const ended = { position: 1400, duration: 1400 };  // exactly at the end
  const midway = { position: 700, duration: 1400 };  // 50%
  const almost = { position: 1240, duration: 1400 }; // ~88.6% — under the bar

  it('advance to the next episode after finishing → fresh', () => {
    expect(startsFresh(done, 1, 4, 1, 5)).toBe(true);
    expect(startsFresh(ended, 1, 4, 1, 5)).toBe(true);
  });

  it('season rollover / restarting a season at episode 1 after finishing → fresh', () => {
    expect(startsFresh(done, 1, 12, 2, 1)).toBe(true);
    expect(startsFresh(done, 3, 8, 1, 1)).toBe(true); // jumping back to start a re-watch
  });

  it('jumping ahead or backwards is not sequential → resume applies', () => {
    expect(startsFresh(done, 1, 4, 1, 7)).toBe(false);
    expect(startsFresh(done, 1, 4, 1, 3)).toBe(false);
    expect(startsFresh(done, 1, 12, 2, 5)).toBe(false); // cross-season, not ep 1
  });

  it('leaving an episode midway is not "finished" → resume applies', () => {
    expect(startsFresh(midway, 1, 4, 1, 5)).toBe(false);
    expect(startsFresh(almost, 1, 4, 1, 5)).toBe(false);
  });

  it('no playback reported this session (iframe / never played) → resume applies', () => {
    expect(startsFresh(null, 1, 4, 1, 5)).toBe(false);
    expect(startsFresh({ position: 10, duration: 0 }, 1, 4, 1, 5)).toBe(false);
    expect(startsFresh({ position: 10, duration: NaN }, 1, 4, 1, 5)).toBe(false);
  });
});
