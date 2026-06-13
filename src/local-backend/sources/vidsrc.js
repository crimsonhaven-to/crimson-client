// VidSrc resolver — AniWatch's "VidSrc" (megaplay) server. Port of
// resolvers/vidsrc.py.
//
// The scraper hands off a decoded data-hash like
// https://1anime.site/megaplay/stream/s-2/95234/sub (matched on "megaplay"). We
// rebuild the equivalent megaplay.buzz stream page, read its canonical data-id,
// ask megaplay's /stream/getSources for the HLS master, and play it directly.
// The megaplay CDN (*.mewstream.buzz) is Referer-gated on https://megaplay.buzz/,
// supplied by a static rule (megaplay.buzz) + a dynamic rule (the CDN host).

import { BaseResolver } from './base.js';
import { addStreamRule } from '../proxy/dnr.js';

const MEGAPLAY_BASE = 'https://megaplay.buzz';
const MEGAPLAY_REFERER = `${MEGAPLAY_BASE}/`;

export class VidSrcResolver extends BaseResolver {
  domainKeyword = 'megaplay';
  sourceName = 'VidSrc';

  async resolve(embedUrl) {
    const m = embedUrl.match(/\/stream\/([^?#]+)/);
    if (!m) return null;
    const streamPath = m[1].replace(/^\/+|\/+$/g, '');
    const streamPage = `${MEGAPLAY_BASE}/stream/${streamPath}`;

    // The megaplay stream page carries the getSources id in data-id; fall back to
    // the numeric id in the path.
    let dataId = null;
    const page = await this.fetchText(streamPage);
    if (page) {
      const idMatch = page.match(/data-id="(\d+)"/);
      if (idMatch) dataId = idMatch[1];
    }
    if (!dataId) {
      const pathIds = streamPath.match(/\d+/g);
      dataId = pathIds ? pathIds[pathIds.length - 1] : null;
    }
    if (!dataId) return null;

    let payload;
    try {
      const res = await fetch(`${MEGAPLAY_BASE}/stream/getSources?id=${dataId}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) return null;
      payload = await res.json();
    } catch {
      return null;
    }

    const sources = payload && typeof payload === 'object' ? payload.sources : null;
    let fileUrl = null;
    if (sources && typeof sources === 'object' && !Array.isArray(sources)) {
      fileUrl = sources.file;
    } else if (Array.isArray(sources)) {
      const s = sources.find((x) => x && x.file);
      fileUrl = s && s.file;
    }
    if (!fileUrl) return null;

    await addStreamRule(fileUrl, { referer: MEGAPLAY_REFERER });
    const type = fileUrl.toLowerCase().includes('m3u8') ? 'hls' : 'mp4';
    return { url: fileUrl, type };
  }
}
