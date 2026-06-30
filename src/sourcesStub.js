/*
 * Built-in "no sources" fallback engine.
 *
 * crimson-client normally bundles a private sources engine from
 * `vendor/crimson-sources` (a git submodule) at build time. When that submodule
 * is ABSENT — e.g. building without access to the private sources repository, or
 * a fork that has none — `vite.config.js` aliases the `crimson-sources` import to
 * THIS file instead, so the build still succeeds with zero sources.
 *
 * The site then runs with no client-side resolution: playback falls back entirely
 * to the backend (its operator-owned sources), exactly as if the local engine
 * could resolve nothing. This is the graceful-degradation safeguard — never a
 * build failure just because the private engine isn't present.
 *
 * It mirrors the public surface of the real engine's `src/index.ts`, but every
 * operation is an inert no-op.
 */

// An async-iterable that yields nothing — the no-op form of `streamEpisode()`.
// Written without a generator so it stays clean under `require-yield`.
function noStreams() {
  return {
    [Symbol.asyncIterator]() {
      return { next: () => Promise.resolve({ done: true, value: undefined }) };
    },
  };
}

export async function createEngine() {
  return {
    // No sources can run, so the host never starts the local engine.
    capabilities: () => ({}),
    canRunAny: () => false,
    streamEpisode: noStreams,
    dispose: () => Promise.resolve(),
  };
}

export function getExtensionBridge() {
  return null;
}

export function waitForExtensionBridge() {
  return Promise.resolve(null);
}

export function probeExtension() {
  return Promise.resolve(null);
}

export const SOURCES = [];
