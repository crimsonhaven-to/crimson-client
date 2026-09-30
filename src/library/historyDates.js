export const BUCKETS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Calendar-day based.
export const bucketOf = (iso) => {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return 'Earlier';
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(t)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'This Month';
  return 'Earlier';
};

export const timeAgo = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// Calendar-day based: an air date of today is not in the future.
export const isFutureDate = (iso) => {
  if (!iso) return false;
  const t = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(t.getTime())) return false;
  return startOfDay(t) > startOfDay(new Date());
};
