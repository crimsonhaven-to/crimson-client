// The backend is on another origin, so the same-origin GET guard in the fetch
// handler keeps every API, auth and stream request out of this worker.
// Offline music under /music-offline/ and offline videos under /video-offline/
// live in their own caches, which an update of this worker never deletes.

const VERSION = 'v4';
// Filled in by swPrecache in vite.config.js, so each deploy is a new worker that
// precaches its own chunks and pages never opened online still load offline.
const BUILD_ID = 'dev';
const BUILD_ASSETS = [];
const SHELL_CACHE = `crimson-shell-${VERSION}-${BUILD_ID}`;
const RUNTIME_CACHE = `crimson-runtime-${VERSION}`;
const OFFLINE_CACHE_PREFIXES = ['crimson-music-', 'crimson-video-'];
// The page plays videos through hls.js straight from the cache. Serving them
// here too covers Safari's native HLS, which only loads real URLs.
const OFFLINE_PATHS = ['/music-offline/cover/', '/video-offline/'];

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
      // Not addAll: one missing asset would fail the whole install.
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
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE && !OFFLINE_CACHE_PREFIXES.some((p) => k.startsWith(p)))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (OFFLINE_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      caches.match(url.pathname).then((r) => r || new Response('Not found', { status: 404 }))
    );
    return;
  }

  // Network first so a deploy is picked up online; the cached shell is the offline fallback.
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
          // respondWith rejects anything that is not a Response.
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
