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

describe('appendTracks', () => {
  beforeEach(() => {
    player.close();
    localStorage.clear();
  });

  it('extends the queue without interrupting the song that plays', async () => {
    const first = await startTwoSongs();
    player.appendTracks([track(3), { ...track(4), stream_url: null }]);
    expect(player.getState().position).toBe(0);
    expect(playing()).toBe(first);
    expect(player.getState().order).toEqual([0, 1, 2]);
  });

  it('lets the last song roll on into what was added', async () => {
    player.playTracks([track(1)], 0, null, { shuffle: false });
    await settle();
    const only = decks.find((d) => d.src.endsWith('/1.m4a'));
    only.duration = 100;
    only.fire('playing');
    player.appendTracks([track(2)]);
    only.fire('ended');
    await settle();
    expect(player.getState().position).toBe(1);
    expect(player.getState().tracks[1].id).toBe(2);
  });
});

describe('queueTracks', () => {
  beforeEach(() => {
    player.close();
    localStorage.clear();
  });

  const upcomingIds = () => {
    const s = player.getState();
    return s.order.slice(s.position + 1).map((i) => s.tracks[i].id);
  };

  it('plays queued songs next, in the order they were added, before the rest', async () => {
    const first = await startTwoSongs();
    expect(player.queueTracks([track(7)])).toBe(1);
    player.queueTracks([track(8), { ...track(9), stream_url: null }]);
    expect(playing()).toBe(first);
    expect(upcomingIds()).toEqual([7, 8, 2]);
    first.fire('ended');
    await settle();
    expect(player.currentTrack().id).toBe(7);
  });

  it('starts playing when nothing is loaded', async () => {
    expect(player.queueTracks([track(5), track(6)])).toBe(2);
    await settle();
    expect(player.currentTrack().id).toBe(5);
  });

  it('keeps the queued songs next when shuffle is switched', async () => {
    await startTwoSongs();
    player.appendTracks([track(3), track(4)]);
    player.queueTracks([track(7)]);
    player.toggleShuffle();
    expect(upcomingIds()[0]).toBe(7);
    player.toggleShuffle();
    expect(upcomingIds()).toEqual([7, 2, 3, 4]);
  });

  it('is forgotten when a new list starts', async () => {
    await startTwoSongs();
    player.queueTracks([track(7)]);
    player.playTracks([track(1), track(2)], 0, null, { shuffle: false });
    expect(player.getState().queueEnd).toBe(0);
  });
});

describe('ducking under Lumi', () => {
  beforeEach(() => {
    player.close();
    player.setDucked(false);
    localStorage.clear();
  });

  it('lowers the song while she talks and restores it after', async () => {
    const first = await startTwoSongs();
    player.setDucked(true);
    expect(first.volume).toBeLessThan(0.5);
    player.setDucked(false);
    expect(first.volume).toBe(1);
  });

  it('keeps a crossfade under her voice', async () => {
    setCrossfadeSetting({ on: true, seconds: 5 });
    const first = await startTwoSongs();
    player.setDucked(true);
    const second = await reachTheEnd(first);
    second.currentTime = 5;
    second.fire('timeupdate');
    expect(second.volume).toBeLessThan(0.5);
    player.setDucked(false);
    expect(second.volume).toBe(1);
  });
});
