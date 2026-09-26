/*
 * Crimsonhaven service worker.
 *
 * Goal: make the web app installable + resilient offline WITHOUT ever changing
 * how the app talks to the backend. The backend lives on a different origin
 * (e.g. https://dev-backend.crimsonhaven.to), so the guard below — "same-origin
 * GET only" — means every API/auth/stream request bypasses the worker entirely
 * and hits the network exactly as before. Non-GET requests are never touched.
 *
 * Music on the device is the one exception to "network first": songs and covers
 * the page stored under /music-offline/ (src/music/trackStore.js) are served
 * from their caches, which an update of this worker never deletes.
 */

const VERSION = 'v4';
// The build replaces BUILD_ID and BUILD_ASSETS (see swPrecache in vite.config.js),
// so every deploy is a new worker that precaches that build's own chunks. Without
// them, a page never opened online (say, Music) would not load offline.
const BUILD_ID = 'dev';
const BUILD_ASSETS = [];
const SHELL_CACHE = `crimson-shell-${VERSION}-${BUILD_ID}`;
const RUNTIME_CACHE = `crimson-runtime-${VERSION}`;
const MUSIC_CACHE_PREFIX = 'crimson-music-';
const MUSIC_COVER_PATH = '/music-offline/cover/';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/favicon.ico',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll is atomic; ignore individual misses so install never hard-fails.
      .then((cache) => Promise.allSettled([...SHELL_ASSETS, ...BUILD_ASSETS].map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE && !k.startsWith(MUSIC_CACHE_PREFIX))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Let the page tell a freshly-installed worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Hard guard: only ever handle same-origin GET. Everything else (the backend
  // API on another origin, POST/DELETE auth + progress calls, the NDJSON stream)
  // falls straight through to the network, untouched.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith(MUSIC_COVER_PATH)) {
    event.respondWith(
      caches.match(url.pathname).then((r) => r || new Response('Not found', { status: 404 }))
    );
    return;
  }

  // SPA navigations: network-first so a deployed update is picked up online,
  // with the cached shell as an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate for instant loads that
  // still refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => {
          if (cached) return cached;
          // Return a valid Response object to prevent "Failed to convert value to 'Response'"
          return new Response('Network error', { 
            status: 408, 
            statusText: 'Network error',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      return cached || network;
    })
  );
});
