/*
 * Admin dashboard API client.
 *
 * Thin wrappers over the gated /admin endpoints (require an admin session; the
 * bearer token is attached by apiFetch). Each returns the parsed JSON body.
 * Extracted out of the hooks.js god-module — it's a self-contained leaf that only
 * needs apiFetch, so it lives on its own and is imported directly by Admin.jsx.
 */
import { apiFetch } from './hooks';

const _json = (res) => res.json();
const _qs = (params) =>
  new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();

export const adminApi = {
  stats: () => apiFetch('/admin/stats').then(_json),
  health: () => apiFetch('/health').then(_json),
  // Rich runtime snapshot (version/uptime, registry sizes, flags, DB pool, cache).
  system: () => apiFetch('/admin/system').then(_json),
  // Per-source health probe. force=true bypasses the backend's short result cache.
  sourceHealth: (force = false) => apiFetch(`/admin/source-health${force ? '?force=true' : ''}`).then(_json),
  // Real per-source resolve success rates from anonymous client beacons (the
  // client+extension path source_health can't see). days = aggregation window.
  sourceStats: (days = 14) => apiFetch(`/admin/source-stats?days=${days}`).then(_json),
  listUsers: (params) => apiFetch(`/admin/users?${_qs(params)}`).then(_json),
  updateUser: (id, body) =>
    apiFetch(`/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  deleteUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }).then(_json),
  revokeUserSessions: (id) =>
    apiFetch(`/admin/users/${id}/revoke-sessions`, { method: 'POST' }).then(_json),
  listInvites: (params) => apiFetch(`/admin/invites?${_qs(params)}`).then(_json),
  createInvites: (body) =>
    apiFetch('/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  revokeInvite: (code) =>
    apiFetch(`/admin/invites/${encodeURIComponent(code)}`, { method: 'DELETE' }).then(_json),
  resync: () => apiFetch('/admin/resync', { method: 'POST' }).then(_json),
  resyncStatus: () => apiFetch('/admin/resync/status').then(_json),
  // Non-anime catalogue backfill (pages TMDB discover into tmdb_shows/tmdb_movies).
  backfill: (body) =>
    apiFetch('/admin/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(_json),
  backfillStatus: () => apiFetch('/admin/backfill/status').then(_json),
  // Local media sources (the "Local" direct-play source: NAS / Docker-mounted dirs).
  listLocalSources: () => apiFetch('/admin/local-sources').then(_json),
  discoverLocalSources: () => apiFetch('/admin/local-sources/discover').then(_json),
  addLocalSource: (body) =>
    apiFetch('/admin/local-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  updateLocalSource: (id, body) =>
    apiFetch(`/admin/local-sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  deleteLocalSource: (id) => apiFetch(`/admin/local-sources/${id}`, { method: 'DELETE' }).then(_json),
  // Server-side video cache (downloads played episodes to a NAS target, replays
  // them as a named source).
  cacheOverview: () => apiFetch('/admin/cache').then(_json),
  setCacheEnabled: (enabled) =>
    apiFetch('/admin/cache/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then(_json),
  listCacheTargets: () => apiFetch('/admin/cache-targets').then(_json),
  discoverCacheTargets: () => apiFetch('/admin/cache-targets/discover').then(_json),
  addCacheTarget: (body) =>
    apiFetch('/admin/cache-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  updateCacheTarget: (id, body) =>
    apiFetch(`/admin/cache-targets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  deleteCacheTarget: (id) => apiFetch(`/admin/cache-targets/${id}`, { method: 'DELETE' }).then(_json),
  listCachedEpisodes: (params) => apiFetch(`/admin/cached-episodes?${_qs(params)}`).then(_json),
  deleteCachedEpisode: (id) => apiFetch(`/admin/cached-episodes/${id}`, { method: 'DELETE' }).then(_json),
  // movie-web bridge API keys (machine credentials for the /mw endpoints, baked
  // into the movie-web fork's proxy). The raw key is only ever in the create
  // response — list/revoke deal in the non-secret key id (its hash).
  listApiKeys: (params) => apiFetch(`/admin/api-keys?${_qs(params)}`).then(_json),
  createApiKey: (body) =>
    apiFetch('/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(_json),
  revokeApiKey: (id) =>
    apiFetch(`/admin/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(_json),
};
