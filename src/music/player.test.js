import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./trackStore', () => ({ localAudio: async () => null }));
vi.mock('./preload', () => ({ preloadAhead: () => {}, preloadCount: () => 0 }));
vi.mock('./listens', () => ({ beginListen: vi.fn(), endListen: vi.fn(), flushListens: vi.fn(), heardUntil: vi.fn() }));

// Just enough of an <audio> element to drive the player: events are fired by
// the test, the way the browser would.
class FakeAudio extends EventTarget {
  constructor() {
    super();
    this.src = '';
    this.currentTime = 0;
    this.duration = NaN;
    this.paused = true;
    this.volume = 1;
    this.playbackRate = 1;
  }

  play() {
    this.paused = false;
    this.fire('play');
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.fire('pause');
  }

  load() {}

  removeAttribute(name) {
    if (name === 'src') this.src = '';
  }

  fire(type) {
    this.dispatchEvent(new Event(type));
  }
}

const decks = [];
vi.stubGlobal('Audio', class extends FakeAudio {
  constructor() {
    super();
    decks.push(this);
  }
});

const player = await import('./player');
const { setCrossfadeSetting } = await import('./crossfade');

const track = (id) => ({ id, title: `Song ${id}`, artists: [], duration_ms: 100_000, stream_url: `https://cdn/${id}.m4a` });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const playing = () => decks.find((d) => d.src && !d.paused && d.volume > 0.5) || null;

async function startTwoSongs() {
  player.playTracks([track(1), track(2)], 0, null, { shuffle: false });
  await settle();
  const first = decks.find((d) => d.src.endsWith('/1.m4a'));
  first.duration = 100;
  first.fire('playing');
  return first;
}

async function reachTheEnd(deck) {
  deck.currentTime = 96;
  deck.fire('timeupdate');
  await settle();
  return decks.find((d) => d.src.endsWith('/2.m4a'));
}

describe('crossfade', () => {
  beforeEach(() => {
    player.close();
    localStorage.clear();
  });

  it('is off by default: the next song waits for the last one to end', async () => {
    const first = await startTwoSongs();
    await reachTheEnd(first);
    expect(player.getState().position).toBe(0);
    first.fire('ended');
    await settle();
    expect(player.getState().position).toBe(1);
  });

  it('starts the next song in the same task the last one ends in', async () => {
    const first = await startTwoSongs();
    const second = await reachTheEnd(first);
    expect(second.paused).toBe(true);
    first.paused = true;
    first.fire('ended');
    expect(player.getState().position).toBe(1);
    expect(second.paused).toBe(false);
    expect(first.src).toBe('');
  });

  it('drops the loaded next song when the queue order changes', async () => {
    const first = await startTwoSongs();
    const second = await reachTheEnd(first);
    player.toggleRepeat();
    player.toggleRepeat();
    expect(second.src).toBe('');
    first.fire('ended');
    await settle();
    expect(player.getState().position).toBe(0);
  });

  it('starts the next song on the other deck and blends them', async () => {
    setCrossfadeSetting({ on: true, seconds: 5 });
    const first = await startTwoSongs();
    const second = await reachTheEnd(first);

    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(player.getState().position).toBe(1);
    expect(second.paused).toBe(false);
    expect(first.paused).toBe(false);

    second.currentTime = 2.5;
    second.fire('timeupdate');
    expect(second.volume).toBeGreaterThan(0.5);
    expect(first.volume).toBeGreaterThan(0.5);
    expect(second.volume).toBeLessThan(1);

    second.currentTime = 5;
    second.fire('timeupdate');
    expect(second.volume).toBe(1);
    expect(first.paused).toBe(true);
    expect(first.src).toBe('');
  });

  it('ignores the old song ending while it fades out', async () => {
    setCrossfadeSetting({ on: true, seconds: 5 });
    const first = await startTwoSongs();
    const second = await reachTheEnd(first);
    first.fire('ended');
    await settle();
    expect(player.getState().position).toBe(1);
    expect(second.paused).toBe(false);
  });

  it('pausing mid-fade silences the old song and keeps the new one ready at full volume', async () => {
    setCrossfadeSetting({ on: true, seconds: 5 });
    const first = await startTwoSongs();
    const second = await reachTheEnd(first);
    second.currentTime = 1;
    second.fire('timeupdate');
    player.pause();
    expect(first.paused).toBe(true);
    expect(second.paused).toBe(true);
    expect(second.volume).toBe(1);
    expect(player.getState().playing).toBe(false);
    player.play();
    expect(playing()).toBe(second);
  });

  it('does not fade out of the last song or into a repeat of the same one', async () => {
    setCrossfadeSetting({ on: true, seconds: 5 });
    player.playTracks([track(1)], 0, null, { shuffle: false });
    await settle();
    const only = decks.find((d) => d.src.endsWith('/1.m4a'));
    only.duration = 100;
    only.fire('playing');
    only.currentTime = 97;
    only.fire('timeupdate');
    await settle();
    expect(decks.filter((d) => d.src).length).toBe(1);
  });
});
