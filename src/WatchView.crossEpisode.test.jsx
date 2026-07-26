// Empirical reproduction harness for the "old timestamp persists across
// episode change while fullscreen" bug. Mounts the REAL WatchView + REAL
// CrimsonPlayer (jsdom, mp4 path) under a wrapper that replicates WatchPage's
// hook structure exactly (streamer effect BEFORE resume-reset effect), then
// replays the episode-change sequence and records every seek on the <video>.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCallback, useEffect, useRef, useState, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import WatchView from './WatchView';
import { startsFresh } from './hooks/resumeRules';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks fetch in some paths — stub it so stray apiFetch calls don't blow up.
globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));

const EP1 = { url: 'https://cdn.example/ep1.mp4', type: 'mp4', source: 'MockSource' };
const EP2 = { url: 'https://cdn.example/ep2.mp4', type: 'mp4', source: 'MockSource' };
const META = { episodes_list: [{ episode_number: 1 }, { episode_number: 2 }, { episode_number: 3 }] };

let hooks = {};
// episode_number -> stale saved position from an "earlier watch-through"
// (the harness's stand-in for the backend's /account/progress rows)
const saved = { current: {} };

function Wrapper() {
  // --- WatchPage mimic: refs + progress handler (same as App.jsx WatchPage) ---
  const livePositionRef = useRef(0);
  const playbackRef = useRef(null);
  const handlePlayerProgress = useCallback((position, duration) => {
    playbackRef.current = { position, duration };
    livePositionRef.current = position;
  }, []);

  // --- streamer mimic (hook order: BEFORE the resume effect, as in WatchPage) ---
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [streams, setStreams] = useState([]);
  const [streamLoading, setStreamLoading] = useState(false); // initial state as in the hook
  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  const epRef = useRef(currentEpisode);
  epRef.current = currentEpisode;
  useEffect(() => {
    // mimics useAnimeStreamer's resolve effect
    setStreamLoading(true);
    setStreams([]);
    setActiveStreamIdx(0);
  }, [currentEpisode]);

  // --- sequential-advance stamp (same wiring as WatchPage/ShowWatch) ---
  const startFreshKeyRef = useRef(null);
  const advanceTo = useCallback((nextEpisode) => {
    if (startsFresh(playbackRef.current, 1, epRef.current, 1, nextEpisode)) {
      startFreshKeyRef.current = `1:${nextEpisode}`;
    }
    setCurrentEpisode(nextEpisode);
  }, []);

  // --- resume mimic (same order/deps as WatchPage, async like the real fetch) ---
  const [resumeAt, setResumeAt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResumeAt(0);
    livePositionRef.current = 0;
    if (startFreshKeyRef.current === `1:${currentEpisode}`) {
      startFreshKeyRef.current = null;
      return undefined;
    }
    const pos = saved.current[currentEpisode];
    if (pos) Promise.resolve().then(() => { if (!cancelled) setResumeAt(pos); });
    return () => { cancelled = true; };
  }, [currentEpisode]);

  const playerStartAt = livePositionRef.current > 5 ? livePositionRef.current : resumeAt;

  // expose the control surface to the test (outside render, keeping lint clean)
  useEffect(() => {
    hooks = { setCurrentEpisode, advanceTo, setStreams, setStreamLoading, setResumeAt, livePositionRef, playbackRef };
  });

  return (
    <MemoryRouter>
      <WatchView
        streams={streams}
        streamLoading={streamLoading}
        activeStreamIdx={activeStreamIdx}
        onSelectStream={setActiveStreamIdx}
        poster=""
        playerStartAt={playerStartAt}
        onPlayerProgress={handlePlayerProgress}
        metadata={META}
        displayTitle={undefined}
        totalSeasons={1}
        currentSeason={1}
        currentEpisode={currentEpisode}
        availableSeasons={[]}
        onEpisodeChange={advanceTo}
        isAuthenticated={false}
        backUrl="/"
      />
    </MemoryRouter>
  );
}

// Instrument a <video> element: settable currentTime + recorded seeks + duration.
function instrument(video, duration) {
  const rec = { time: 0, seeks: [] };
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => rec.time,
    set: (v) => { rec.seeks.push(v); rec.time = v; },
  });
  Object.defineProperty(video, 'duration', { configurable: true, get: () => duration.value });
  Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
  // real browsers reset the playback position when the media is (re)loaded
  video.load = () => { rec.time = 0; };
  video.play = () => Promise.resolve();
  return rec;
}

async function flush() { await act(async () => {}); }

describe('cross-episode timestamp', () => {
  let container, root;
  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saved.current = {};
  });

  async function mountAndPlayEp1({ position }) {
    await act(async () => { root.render(<Wrapper />); });
    // resolve ep1
    await act(async () => { hooks.setStreams([EP1]); hooks.setStreamLoading(false); });
    // let the lazy CrimsonPlayer chunk land and Suspense re-render
    await act(async () => {
      await import('./CrimsonPlayer');
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    const duration = { value: 1400 };
    const rec = instrument(video, duration);
    await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
    // simulate playback progress at `position`
    rec.time = position;
    await act(async () => { video.dispatchEvent(new Event('timeupdate')); });
    expect(hooks.livePositionRef.current).toBe(position); // gate open for ep1
    return { video, rec, duration };
  }

  it('picker jump mid-episode: new episode must start at 0', async () => {
    const { video, rec, duration } = await mountAndPlayEp1({ position: 1390 });

    // episode change (in-player picker / below-player card path)
    await act(async () => { hooks.setCurrentEpisode(2); });
    expect(hooks.livePositionRef.current).toBe(0); // reset ran

    // old video still playing behind the veil — reports must be dropped
    rec.time = 1391;
    await act(async () => { video.dispatchEvent(new Event('timeupdate')); });
    expect(hooks.livePositionRef.current).toBe(0);

    rec.seeks.length = 0; // only interested in seeks from here on

    // ep2 resolves
    await act(async () => { hooks.setStreams([EP2]); hooks.setStreamLoading(false); });
    duration.value = 1420;
    await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
    await flush();

    const badSeeks = rec.seeks.filter((s) => s > 5);
    expect(badSeeks).toEqual([]);
  });

  it('auto-next at ended (old ep never consumed a resume seek): new episode must start at 0', async () => {
    const { video, rec, duration } = await mountAndPlayEp1({ position: 1399.5 }); // at the very end
    await act(async () => { video.dispatchEvent(new Event('ended')); });

    await act(async () => { hooks.setCurrentEpisode(2); });
    rec.seeks.length = 0;

    await act(async () => { hooks.setStreams([EP2]); hooks.setStreamLoading(false); });
    duration.value = 1420;
    await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
    await flush();

    const badSeeks = rec.seeks.filter((s) => s > 5);
    expect(badSeeks).toEqual([]);
  });

  it('late resume fetch for the NEW episode landing after src swap seeks only the legit value', async () => {
    const { video, rec, duration } = await mountAndPlayEp1({ position: 1390 });
    await act(async () => { hooks.setCurrentEpisode(2); });
    rec.seeks.length = 0;

    await act(async () => { hooks.setStreams([EP2]); hooks.setStreamLoading(false); });
    duration.value = 1420;
    await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
    // resume lookup resolves late with a legit position for ep2
    await act(async () => { hooks.setResumeAt(0); });
    await flush();

    const badSeeks = rec.seeks.filter((s) => s > 5);
    expect(badSeeks).toEqual([]);
  });

  it('re-watch: sequential advance ignores a stale saved position for the next episode', async () => {
    saved.current = { 2: 700 }; // ep2 was left midway on an earlier watch-through
    const { video, rec, duration } = await mountAndPlayEp1({ position: 1399.5 });
    await act(async () => { video.dispatchEvent(new Event('ended')); });

    // advance through the real handler (Auto-Next / next-episode click path)
    await act(async () => { hooks.advanceTo(2); });
    rec.seeks.length = 0;

    await act(async () => { hooks.setStreams([EP2]); hooks.setStreamLoading(false); });
    duration.value = 1420;
    await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
    await flush(); // the (suppressed) resume lookup would land here

    const badSeeks = rec.seeks.filter((s) => s > 5);
    expect(badSeeks).toEqual([]);
    expect(rec.time).toBeLessThan(5);
  });

  it('direct jump out of a half-watched episode still resumes the target', async () => {
    saved.current = { 2: 700 };
    const { video, rec, duration } = await mountAndPlayEp1({ position: 600 }); // ep1 only midway

    await act(async () => { hooks.advanceTo(2); }); // not "finished" → no fresh stamp
    rec.seeks.length = 0;

    await act(async () => { hooks.setStreams([EP2]); hooks.setStreamLoading(false); });
    duration.value = 1420;
    await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
    await flush(); // resume lookup lands → player seeks to the saved spot

    expect(rec.seeks).toContain(700);
  });

  it('episode change where the new episode resolves to the SAME url: player must reload', async () => {
    const { video, rec, duration } = await mountAndPlayEp1({ position: 1399.5 });
    await act(async () => { video.dispatchEvent(new Event('ended')); });

    await act(async () => { hooks.setCurrentEpisode(2); });

    // new episode resolves to the exact same URL (stable companion/capture endpoint)
    const EP2_SAME = { ...EP1 };
    await act(async () => { hooks.setStreams([EP2_SAME]); hooks.setStreamLoading(false); });
    duration.value = 1420;
    await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
    await flush();

    // the player must have restarted playback for the new episode — not be
    // parked at the old episode's end
    expect(rec.time).toBeLessThan(5);
  });

  it('REAL Auto-Next countdown path: new episode must start at 0', async () => {
    localStorage.setItem('crimson:autoNext', '1');
    const { video, rec, duration } = await mountAndPlayEp1({ position: 1399.5 });
    vi.useFakeTimers();
    try {

      // playback reaches the end → 'ended' arms the Up Next countdown
      await act(async () => { video.dispatchEvent(new Event('ended')); });

      // let the 8s grace period elapse — onNext fires from inside the countdown
      // interval's setCountdown updater (the real production path)
      for (let i = 0; i < 9; i++) {
        await act(async () => { vi.advanceTimersByTime(1000); });
      }
      expect(hooks.livePositionRef.current).toBe(0); // reset ran on episode change

      // stray timeupdate from the old (ended) source during the gap
      rec.time = 1399.6;
      await act(async () => { video.dispatchEvent(new Event('timeupdate')); });
      expect(hooks.livePositionRef.current).toBe(0);

      rec.seeks.length = 0;
      await act(async () => { hooks.setStreams([EP2]); hooks.setStreamLoading(false); });
      duration.value = 1420;
      await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); });
      await act(async () => { vi.advanceTimersByTime(100); });

      const badSeeks = rec.seeks.filter((s) => s > 5);
      expect(badSeeks).toEqual([]);
    } finally {
      vi.useRealTimers();
      localStorage.removeItem('crimson:autoNext');
    }
  });

  it('timeupdate in the paint window right after the episode-change commit is not persisted', async () => {
    const { video, rec } = await mountAndPlayEp1({ position: 1390 });

    // Commit the episode change WITHOUT flushing passive effects, then let a
    // timeupdate from the old source sneak in (the real-browser paint window).
    const { flushSync } = await import('react-dom');
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      flushSync(() => { hooks.setCurrentEpisode(2); });
      rec.time = 1391;
      video.dispatchEvent(new Event('timeupdate'));
    } finally {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    }
    await flush(); // passive effects now run

    expect(hooks.livePositionRef.current).toBe(0);

    rec.seeks.length = 0;
    await act(async () => { hooks.setStreams([EP2]); hooks.setStreamLoading(false); });
    await flush();
    const badSeeks = rec.seeks.filter((s) => s > 5);
    expect(badSeeks).toEqual([]);
  });
});
