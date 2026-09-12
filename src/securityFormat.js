// Pure formatting for the account security panel. Separate from the component so
// the two rules that matter can be tested: an unknown event type must stay
// visible, and a session with no device columns must still read as something.

// The backend returns a whitelisted event_type (audit.USER_VISIBLE_EVENTS).
// This only makes them readable; the list is deliberately not authoritative.
const EVENT_LABELS = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  login_unverified: 'Sign-in blocked, email not verified',
  register_success: 'Account created',
  password_reset_requested: 'Password reset requested',
  password_reset_success: 'Password changed',
  password_reset_failed: 'Password reset failed',
  email_verified: 'Email verified',
  verify_failed: 'Email verification failed',
  verify_resend_requested: 'Verification email resent',
  session_revoked: 'Signed a device out',
  account_delete_failed: 'Failed attempt to delete this account',
  account_deleted: 'Account deleted',
};

// An event type the client has no label for still renders, spelled out. Hiding
// it would mean a newly whitelisted server-side event silently vanishes from the
// feed, which is the opposite of what this panel is for.
export const eventLabel = (type) => EVENT_LABELS[type] || String(type || '').replace(/_/g, ' ');

// A user agent is long and mostly noise; the browser and platform are what makes
// a device recognisable to its owner. Sessions predating the device columns have
// none, and read as unknown rather than being dropped from the list.
export function deviceLabel(userAgent) {
  if (!userAgent) return 'Unknown device';
  const ua = String(userAgent);
  // Order matters: Edge and Opera both carry "Chrome", and Chrome carries
  // "Safari", so the more specific tokens have to be checked first.
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const platform =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod|iOS/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown platform';
  return `${browser} on ${platform}`;
}

export function when(iso, now = Date.now()) {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'unknown';
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 90) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
