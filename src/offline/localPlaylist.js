// The playlists of an offline copy. Segments are stored decrypted and one per
// cache entry, so the keys and byte ranges of the source's playlist go away and
// each URI is the relative path of its cache key (see videoStore.js).

export function mediaPlaylist(track, { maps, segments, isFmp4 }) {
  const target = Math.max(1, ...segments.map((s) => Math.ceil(s.duration || 0)));
  const lines = [
    '#EXTM3U',
    `#EXT-X-VERSION:${isFmp4 ? 7 : 3}`,
    `#EXT-X-TARGETDURATION:${target}`,
    '#EXT-X-PLAYLIST-TYPE:VOD',
    '#EXT-X-MEDIA-SEQUENCE:0',
  ];
  let currentMap = null;
  segments.forEach((seg, i) => {
    if (seg.discontinuity) lines.push('#EXT-X-DISCONTINUITY');
    if (seg.map != null && seg.map !== currentMap && maps[seg.map]) {
      lines.push(`#EXT-X-MAP:URI="${track}/init${seg.map}"`);
      currentMap = seg.map;
    }
    lines.push(`#EXTINF:${(seg.duration || 0).toFixed(3)},`, `${track}/${i}`);
  });
  lines.push('#EXT-X-ENDLIST', '');
  return lines.join('\n');
}

// Only needed when the audio is a separate rendition; otherwise the video
// playlist is played directly.
export function masterPlaylist(variant) {
  const inf = [`BANDWIDTH=${variant.bandwidth || 1}`];
  if (variant.codecs) inf.push(`CODECS="${variant.codecs}"`);
  if (variant.resolution) inf.push(`RESOLUTION=${variant.resolution}`);
  inf.push('AUDIO="audio"');
  return [
    '#EXTM3U',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,URI="a.m3u8"',
    `#EXT-X-STREAM-INF:${inf.join(',')}`,
    'v.m3u8',
    '',
  ].join('\n');
}

// Segment numbers only mean the same thing across two fetches of a playlist
// when its shape is the same. A fresh link may hand out a different cut, and
// then the segments already kept cannot be reused.
export function layoutOf(tracks) {
  return tracks
    .map(({ name, media }) => `${name}:${media.segments.length}:${media.maps.length}`)
    .join(',');
}
