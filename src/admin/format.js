// Kept apart from ui.jsx because Vite fast-refresh needs a file to export either
// components or helpers, not both.

export const STATUS_META = {
  ok:        { label: 'Healthy',  dot: 'bg-green-400',  text: 'text-green-300',  ring: 'border-green-700/40',  glow: 'shadow-[0_0_10px_rgba(74,222,128,0.5)]' },
  active:    { label: 'Active',   dot: 'bg-green-400',  text: 'text-green-300',  ring: 'border-green-700/40',  glow: 'shadow-[0_0_10px_rgba(74,222,128,0.5)]' },
  empty:     { label: 'Empty',    dot: 'bg-amber-400',  text: 'text-amber-300',  ring: 'border-amber-700/40',  glow: 'shadow-[0_0_10px_rgba(251,191,36,0.5)]' },
  idle:      { label: 'Idle',     dot: 'bg-amber-400',  text: 'text-amber-300',  ring: 'border-amber-700/40',  glow: 'shadow-[0_0_10px_rgba(251,191,36,0.5)]' },
  error:     { label: 'Down',     dot: 'bg-crimson-500', text: 'text-crimson-400', ring: 'border-crimson-600/50', glow: 'shadow-[0_0_10px_rgba(255,0,60,0.5)]' },
  disabled:  { label: 'Dormant',  dot: 'bg-crimson-900', text: 'text-crimson-600', ring: 'border-crimson-900/50', glow: '' },
};

export const statusMeta = (s) => STATUS_META[s] || { label: s || '-', dot: 'bg-crimson-700', text: 'text-crimson-500', ring: 'border-crimson-900/50', glow: '' };

export const fmtDate = (iso) => {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

export const formatBytes = (n) => {
  if (n == null) return '-';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};
