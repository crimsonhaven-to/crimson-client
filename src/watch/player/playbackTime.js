export function formatPlaybackTime(s) {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  const h = Math.floor(m / 60);
  const mm = h ? String(m % 60).padStart(2, '0') : m;
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
