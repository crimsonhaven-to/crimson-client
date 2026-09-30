// The T00:00:00 suffix parses as local time; a bare 'YYYY-MM-DD' is UTC and can show the previous day.
export function formatAirDate(iso) {
  if (!iso) return '';
  const t = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
