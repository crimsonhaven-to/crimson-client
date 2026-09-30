// Grouping and ranking live together because both parse the same
// "Provider · variant (quality)" source-label shape.

// Some sources fan one title into many tiles that differ only by server or quality
// (ScreenScape has ~15 servers x qualities); left flat that's a wall of buttons.

export function streamProviderLabel(stream) {
  const s = stream?.source || '';
  const head = s.split(/\s+·\s+| \(/)[0].trim();
  return head || s;
}

// "ScreenScape · MovieBox (1080p)" -> "MovieBox (1080p)"; "Cinema.bz (tcloud)" -> "tcloud".
export function streamVariantLabel(stream) {
  const s = stream?.source || '';
  const provider = streamProviderLabel(stream);
  if (!s.startsWith(provider)) return s;
  let rest = s.slice(provider.length).trim();
  rest = rest.replace(/^·\s*/, '').trim();
  if (rest.startsWith('(') && rest.endsWith(')')) rest = rest.slice(1, -1).trim();
  return rest || provider;
}

// Returns [{ key, label, items: [{ stream, idx }], stacked }] in first-arrival order,
// so the auto-selected source's group stays near the top. `idx` indexes the original
// array. Each NAS cache target stays its own card.
export function groupStreams(streams = []) {
  const groups = [];
  const byKey = new Map();
  streams.forEach((stream, idx) => {
    const entry = { stream, idx };
    const isCache = (stream?.url || '').includes('/cache_proxy/');
    const key = isCache ? `__solo_${idx}` : streamProviderLabel(stream);
    let g = byKey.get(key);
    if (!g) {
      g = { key, label: isCache ? (stream?.source || 'Cache') : key, items: [], stacked: false };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(entry);
  });
  for (const g of groups) g.stacked = g.items.length > 1;
  return groups;
}

function languageMismatch(stream, prefs) {
  if (!prefs || (!prefs.language && !prefs.type)) return 0;
  const tag = (stream?.language || '').toLowerCase();
  let miss = 0;
  if (prefs.language && !tag.includes(prefs.language.toLowerCase())) miss += 1;
  if (prefs.type && !tag.includes(prefs.type.toLowerCase())) miss += 1;
  return miss;
}

// Lower wins. Deliberately no provider/quality ranking: ties fall back to arrival
// order, so the first source to resolve plays.
export function streamRank(stream, prefs) {
  return languageMismatch(stream, prefs);
}
