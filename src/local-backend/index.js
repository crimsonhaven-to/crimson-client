// Public entry for the local backend. apiFetch (src/hooks.js) calls localFetch
// for app-relative paths instead of hitting a remote server — it returns a real
// Response, so every existing hook (JSON reads and the /watch ReadableStream
// reader alike) keeps working with zero changes.

import { route } from './router.js';

export async function localFetch(path, options = {}) {
  return route(path, options);
}

export { needsSetup, getTmdbKey, setTmdbKey } from './config.js';
