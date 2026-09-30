import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, status: 200 })),
  getSessionToken: () => null,
}));

const { beginListen, endListen, heardBetween, heardUntil, toReport } = await import('./listens');

const outbox = () => JSON.parse(localStorage.getItem('crimson:music-listens') || '[]');

describe('heardBetween', () => {
  it('counts normal playback between two updates', () => {
    expect(heardBetween(10, 10.25)).toBeCloseTo(0.25);
  });

  it('does not count a seek either way, or the first update', () => {
    expect(heardBetween(10, 90)).toBe(0);
    expect(heardBetween(90, 10)).toBe(0);
    expect(heardBetween(null, 5)).toBe(0);
  });
});

describe('toReport', () => {
  it('drops a song skipped before thirty seconds', () => {
    expect(toReport({ track_id: 1, listened_at: 'x', seconds: 29.9 })).toBeNull();
  });

  it('keeps one played long enough', () => {
    expect(toReport({ track_id: 1, listened_at: 'x', seconds: 31.26 })).toEqual({ track_id: 1, listened_at: 'x', seconds: 31.3 });
  });
});

describe('a listen', () => {
  beforeEach(() => {
    endListen();
    localStorage.clear();
  });

  const play = (seconds) => {
    for (let t = 0; t <= seconds; t += 0.25) heardUntil(t);
  };

  it('goes to the outbox when the next song starts', () => {
    beginListen({ id: 7 });
    play(40);
    beginListen({ id: 8 });
    expect(outbox().map((l) => l.track_id)).toEqual([7]);
    expect(outbox()[0].seconds).toBeCloseTo(40, 0);
  });

  it('is not reported when skipped early', () => {
    beginListen({ id: 7 });
    play(10);
    endListen();
    expect(outbox()).toEqual([]);
  });

  it('counts a seek to the end as the time really played', () => {
    beginListen({ id: 7 });
    play(20);
    heardUntil(200);
    endListen();
    expect(outbox()).toEqual([]);
  });
});
