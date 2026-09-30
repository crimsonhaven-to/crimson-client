// Pure formatting for the airing calendar. Separate from the hook and the page
// so the day-boundary rules, which are the only part that can be wrong in a way
// nobody notices, can be tested without React.
//
// Everything here works in the browser's own timezone on purpose. An episode
// airing at 17:00 JST belongs to a different calendar day depending on where it
// is read, and grouping server-side would put it on the wrong one.

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Airings grouped by the viewer's local date, preserving the order they arrive
// in (the backend returns them chronologically).
export function groupByLocalDay(items) {
  const groups = new Map();
  for (const item of items) {
    const at = new Date(item.airing_at);
    if (Number.isNaN(at.getTime())) continue;
    const key = at.toDateString();
    if (!groups.has(key)) groups.set(key, { key, date: startOfDay(at), items: [] });
    groups.get(key).items.push(item);
  }
  return Array.from(groups.values());
}

export function dayLabel(date, now = new Date()) {
  const diff = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

export const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const hasAired = (iso, now = Date.now()) => new Date(iso).getTime() <= now;
