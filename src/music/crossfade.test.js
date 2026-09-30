import { describe, expect, it } from 'vitest';

import { MAX_SECONDS, MIN_SECONDS, fadeVolumes, parseSetting } from './crossfade';

describe('parseSetting', () => {
  it('is off at five seconds until chosen otherwise', () => {
    expect(parseSetting(null)).toEqual({ on: false, seconds: 5 });
    expect(parseSetting('not json')).toEqual({ on: false, seconds: 5 });
  });

  it('keeps a choice inside the range', () => {
    expect(parseSetting(JSON.stringify({ on: true, seconds: MIN_SECONDS }))).toEqual({ on: true, seconds: 3 });
    expect(parseSetting(JSON.stringify({ on: true, seconds: MAX_SECONDS }))).toEqual({ on: true, seconds: 8 });
  });

  it('falls back to the default length for one outside it', () => {
    expect(parseSetting(JSON.stringify({ on: true, seconds: 12 })).seconds).toBe(5);
    expect(parseSetting(JSON.stringify({ on: true, seconds: 1 })).seconds).toBe(5);
  });
});

describe('fadeVolumes', () => {
  it('hands over from the old song to the new one', () => {
    expect(fadeVolumes(0)).toEqual({ incoming: 0, outgoing: 1 });
    const end = fadeVolumes(1);
    expect(end.incoming).toBe(1);
    expect(end.outgoing).toBeCloseTo(0);
  });

  it('keeps the loudness level at the midpoint', () => {
    const { incoming, outgoing } = fadeVolumes(0.5);
    expect(incoming ** 2 + outgoing ** 2).toBeCloseTo(1);
  });

  it('never leaves the range an audio element accepts', () => {
    expect(fadeVolumes(-1).incoming).toBe(0);
    expect(fadeVolumes(3).incoming).toBe(1);
  });
});
