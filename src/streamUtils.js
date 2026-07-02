/*
 * Pure stream-presentation + ranking helpers.
 *
 * Extracted from the hooks.js god-module: these are dependency-free (no apiFetch,
 * no React, no storage) functions shared by the streamer hooks, WatchView and
 * CrimsonPlayer. They decide which source auto-plays (ranking) and how the source
 * list is grouped into provider cards. Kept as one module because grouping and
 * ranking both parse the same "Provider · variant (quality)" source-label shape.
 */

// --- Source grouping (Scraped Targets / player cog) -------------------------
// Several sources fan a single title into many tiles that only differ by a server
// or quality: ScreenScape ("ScreenScape · MovieBox (1080p)", ~15 servers ×
// qualities), Cinema.bz ("Cinema.bz (tcloud)" ×3), aniworld/s.to (the same VOE
// host in several dub/sub languages). Left flat that's a wall of buttons. These
// helpers collapse a provider's variants into one expandable card.
//
// The provider name is whatever precedes the first " · " (server split) or " ("
// (qualifier) in the source label, so the parsing is shared by the sidebar and the
// in-player cog and stays consistent.

export function streamProviderLabel(stream) {
  const s = stream?.source || '';
  const head = s.split(/\s+·\s+| \(/)[0].trim();
  return head || s;
}

// The variant's display name *within* its group: the part of the label after the
// provider name ("ScreenScape · MovieBox (1080p)" -> "MovieBox (1080p)";
// "Cinema.bz (tcloud)" -> "tcloud"). Falls back to the provider when there's
// nothing left (a lone, unqualified source).
export function streamVariantLabel(stream) {
  const s = stream?.source || '';
  const provider = streamProviderLabel(stream);
  if (!s.startsWith(provider)) return s;
  let rest = s.slice(provider.length).trim();
  rest = rest.replace(/^·\s*/, '').trim();
  if (rest.startsWith('(') && rest.endsWith(')')) rest = rest.slice(1, -1).trim();
  return rest || provider;
}

// Group resolved streams by provider, preserving first-arrival order (groups are
// anchored at their first member, so the auto-selected source's group stays near
// the top). Each group is { key, label, items: [{ stream, idx }], stacked }.
// `idx` is the stream's index in the original array, so selection still maps back
// to activeStreamIdx / onSelectStream. Cache sources are NEVER grouped — each NAS
// target is its own standalone, never-stacked card (detected by the /cache_proxy/
// marker in its URL); same for any provider that yields a single tile.
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
  // A group only "stacks" (gets the collapsible card chrome) with 2+ members; the
  // solo cache keys and one-off providers render as a single flat button.
  for (const g of groups) g.stacked = g.items.length > 1;
  return groups;
}

// --- Language-preference-aware ranking --------------------------------------
// How badly a stream's language tag misses the viewer's preference (0 = perfect
// match, higher = worse). An unset dimension never constrains; with no preference
// at all every stream scores 0, so nothing is preferred over anything else.
function languageMismatch(stream, prefs) {
  if (!prefs || (!prefs.language && !prefs.type)) return 0;
  const tag = (stream?.language || '').toLowerCase();
  let miss = 0;
  if (prefs.language && !tag.includes(prefs.language.toLowerCase())) miss += 1;
  if (prefs.type && !tag.includes(prefs.type.toLowerCase())) miss += 1;
  return miss;
}

// The auto-select rank used to pick the default source: the viewer's language/
// dub-sub preference is the ONLY key. Lower wins. There is deliberately no
// source-quality/provider ranking — sources are ranked purely on the user's
// preference, and streams that tie (same language match, or no preference set at
// all) fall back to arrival order, so the first one to resolve plays.
export function streamRank(stream, prefs) {
  return languageMismatch(stream, prefs);
}
