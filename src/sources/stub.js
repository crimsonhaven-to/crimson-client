/*
 * When the private `vendor/crimson-sources` submodule is absent (no access, or a
 * fork), vite.config.js aliases `crimson-sources` to this file so the build still
 * succeeds and playback falls back entirely to the backend. Mirrors the public
 * surface of the real engine's `src/index.ts` with inert no-ops.
 */

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
    capabilities: () => ({}),
    canRunAny: () => false,
    streamEpisode: noStreams,
    dispose: () => Promise.resolve(),
  };
}

// Mirrors src/manga/engine.ts.
export async function createMangaEngine() {
  return {
    available: false,
    env: null,
    resolveManga: () => Promise.resolve(null),
    chapters: () => Promise.resolve([]),
    pages: () => Promise.resolve([]),
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
