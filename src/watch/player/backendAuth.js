import { API_BASE_URL } from '../../api/config';
import { getSessionToken } from '../../api/client';

// /local_hls is the only HLS surface behind the login wall. The bearer must never
// reach a third-party CDN (token leak), and on the public proxies the extra header
// would make every segment a CORS-preflighted request.
export function attachBackendAuth(xhr, url) {
  try {
    const u = new URL(url, window.location.href);
    const backend = new URL(API_BASE_URL, window.location.href).origin;
    if (u.origin !== backend || !u.pathname.startsWith('/local_hls/')) return;
    const token = getSessionToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  } catch { /* malformed URL: the request proceeds unauthenticated */ }
}
