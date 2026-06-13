// Vidmoly resolver — port of resolvers/vidmoly.py.
//
// Fetches the embed page (following the vidmoly.net -> live-mirror 301) and pulls
// the JWPlayer `file: "https://…"` source. The backend proxied this only to wrap
// it in a same-origin fullscreen player; in the extension hls.js plays the direct
// URL fine, with a DNR rule supplying the vidmoly Referer the CDN expects.

import { BaseResolver } from './base.js';
import { addStreamRule } from '../proxy/dnr.js';

const VIDMOLY_REFERER = 'https://vidmoly.me/';

export class VidmolyResolver extends BaseResolver {
  domainKeyword = 'vidmoly';
  sourceName = 'Vidmoly';

  async resolve(embedUrl) {
    // Fetch the embed page like a navigation (strip Origin, set Sec-Fetch-*).
    await addStreamRule(embedUrl, { referer: VIDMOLY_REFERER, navigation: true });
    const html = await this.fetchText(embedUrl); // fetch() follows the mirror 301
    if (!html) return null;

    const m = html.match(/file\s*:\s*["'](https?:\/\/[^"']+)["']/);
    if (!m) return null;
    const streamUrl = m[1];

    await addStreamRule(streamUrl, { referer: VIDMOLY_REFERER });
    const type = streamUrl.toLowerCase().includes('m3u8') ? 'hls' : 'mp4';
    return { url: streamUrl, type };
  }
}
