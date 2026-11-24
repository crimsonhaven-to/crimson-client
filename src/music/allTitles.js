// Pure formatting, sorting, and offline deduplication helpers for the All titles view.

export function formatTitleCount(count) {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `${n} ${n === 1 ? 'title' : 'titles'}`;
}

export function formatAllTitlesSubtitle(ready, total, playlistCount = 0) {
  const totalCount = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  if (totalCount === 0) return 'No titles yet';
  const readyCount = Number.isFinite(ready) && ready > 0 ? Math.floor(ready) : 0;
  const parts = [`${readyCount} / ${totalCount} ready`];
  if (playlistCount > 0) {
    parts.push(`${playlistCount} ${playlistCount === 1 ? 'playlist' : 'playlists'}`);
  }
  return parts.join(' · ');
}

export function splitPlaylistBadges(playlists, maxVisible = 2) {
  const list = Array.isArray(playlists) ? playlists.filter((p) => p?.name) : [];
  if (list.length <= maxVisible) {
    return { visible: list, overflowCount: 0, overflowTitle: '' };
  }
  const hidden = list.slice(maxVisible);
  return {
    visible: list.slice(0, maxVisible),
    overflowCount: hidden.length,
    overflowTitle: hidden.map((p) => p.name).join(', '),
  };
}

// Mirrors the backend order: title, primary artist, then id for stability.
export function compareTitles(a, b) {
  const titleDiff = (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
  if (titleDiff !== 0) return titleDiff;
  const artistA = (a.artists?.[0] || '').toLowerCase();
  const artistB = (b.artists?.[0] || '').toLowerCase();
  const artistDiff = artistA.localeCompare(artistB);
  if (artistDiff !== 0) return artistDiff;
  return (a.id ?? 0) - (b.id ?? 0);
}

// Builds the offline All titles list from downloaded playlists, deduplicating
// shared tracks and preserving the playlists each track belongs to.
export function dedupeSavedTracks(saved, coverUrlFor = (t) => t.cover_url || null) {
  const byId = new Map();
  for (const entry of Object.values(saved || {})) {
    const playlist = entry?.playlist;
    for (const track of entry?.tracks || []) {
      let existing = byId.get(track.id);
      if (!existing) {
        existing = {
          ...track,
          cover_url: coverUrlFor(track),
          playlists: [],
        };
        byId.set(track.id, existing);
      }
      if (playlist && !existing.playlists.some((p) => p.id === playlist.id)) {
        existing.playlists.push({ id: playlist.id, name: playlist.name });
      }
    }
  }
  return [...byId.values()].sort(compareTitles);
}
