import { apiFetch } from './hooks';

const _json = (res) => res.json();
const _qs = (params) =>
  new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();

export const adminApi = {
  stats: () => apiFetch('/admin/stats').then(_json),
  health: () => apiFetch('/health').then(_json),
  system: () => apiFetch('/admin/system').then(_json),
  // text/plain, not JSON, and a build without prometheus-client answers 503, so this
  // returns an envelope. The route still requires the admin bearer or a METRICS_TOKEN
  // even though it is whitelisted on the login wall.
  metrics: async () => {
    const res = await apiFetch('/metrics');
    if (res.status === 503) return { ok: false, unavailable: true };
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, text: await res.text() };
  },
  // Panel and range ids come from the panels response and are sent straight back: the
  // browser never composes a PromQL query, it picks a name off a server-owned list.
  metricsPanels: () => apiFetch('/admin/metrics/panels').then(_json),
  metricsSeries: (panel, range) =>
    apiFetch(`/admin/metrics/series?${_qs({ panel, range })}`).then(_json),
  metricsTargets: () => apiFetch('/admin/metrics/targets').then(_json),
  // force=true bypasses the backend's short result cache.
  sourceHealth: (force = false) => apiFetch(`/admin/source-health${force ? '?force=true' : ''}`).then(_json),
  // From anonymous client beacons: the client and extension path source_health cannot see.
  sourceStats: (days = 14) => apiFetch(`/admin/source-stats?days=${days}`).then(_json),
  securityStats: (days = 14) => apiFetch(`/admin/security/stats?days=${days}`).then(_json),
  securityEvents: (params) => apiFetch(`/admin/security/events?${_qs(params)}`).then(_json),
  listUsers: (params) => apiFetch(`/admin/users?${_qs(params)}`).then(_json),
  updateUser: (id, body) =>
    apiFetch(`/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  deleteUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }).then(_json),
  broadcastEmailStatus: () => apiFetch('/admin/broadcast-email').then(_json),
  sendBroadcastEmail: (body) =>
    apiFetch('/admin/broadcast-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  revokeUserSessions: (id) =>
    apiFetch(`/admin/users/${id}/revoke-sessions`, { method: 'POST' }).then(_json),
  // Per-user chat grants are not here: they ride on updateUser alongside the admin flag.
  chatSettings: () => apiFetch('/admin/chat/settings').then(_json),
  updateChatSettings: (body) =>
    apiFetch('/admin/chat/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  chatUsage: (days = 30) => apiFetch(`/admin/chat/usage?days=${days}`).then(_json),
  musicLibrary: (params) => apiFetch(`/admin/music/library?${_qs(params)}`).then(_json),
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
  backfill: (body) =>
    apiFetch('/admin/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(_json),
  backfillStatus: () => apiFetch('/admin/backfill/status').then(_json),
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
  // The per-source `download_enabled` toggle goes through updateLocalSource.
  downloadsOverview: () => apiFetch('/admin/downloads').then(_json),
  listDownloadJobs: (params) => apiFetch(`/admin/download-jobs?${_qs(params)}`).then(_json),
  createDownload: (body) =>
    apiFetch('/admin/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(_json),
  pauseDownload: (id) => apiFetch(`/admin/download-jobs/${id}/pause`, { method: 'POST' }).then(_json),
  resumeDownload: (id) => apiFetch(`/admin/download-jobs/${id}/resume`, { method: 'POST' }).then(_json),
  retryDownload: (id) => apiFetch(`/admin/download-jobs/${id}/retry`, { method: 'POST' }).then(_json),
  deleteDownload: (id) => apiFetch(`/admin/download-jobs/${id}`, { method: 'DELETE' }).then(_json),
  // The raw key only ever appears in the create response; list and revoke use its hash.
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
