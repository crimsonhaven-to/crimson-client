// VOE resolver — port of resolvers/voe.py.
//
// Fetches the VOE embed page, extracts the obfuscated application/json blob, and
// decodes it (rot13 -> symbol scrub -> base64 -> char-shift -> reverse -> base64
// -> JSON) to the stream URL. The backend had to proxy because VOE binds the CDN
// token to the resolver's IP/ASN/UA — but here the resolver runs in the viewer's
// own browser, so the token is minted for *their* IP and plays directly. A DNR
// rule supplies the voe.sx Referer the CDN expects.

import { BaseResolver } from './base.js';
import { addStreamRule } from '../proxy/dnr.js';

const VOE_REFERER = 'https://voe.sx/';

function rot13(s) {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function cleanSymbols(s) {
  for (const p of ['@$', '^^', '~@', '%?', '*~', '!!', '#&']) s = s.split(p).join('_');
  return s;
}

function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function shiftBack(s, n) {
  let out = '';
  for (const ch of s) out += String.fromCharCode(ch.charCodeAt(0) - n);
  return out;
}

// Exported for unit testing — mirrors the Python decode chain exactly.
export function decodeVoe(encoded) {
  let d = rot13(encoded);
  d = cleanSymbols(d);
  d = d.replace(/_/g, '');
  d = b64ToUtf8(d);
  d = shiftBack(d, 3);
  d = d.split('').reverse().join('');
  d = b64ToUtf8(d);
  return JSON.parse(d);
}

export class VoeResolver extends BaseResolver {
  domainKeyword = 'voe';
  sourceName = 'Voe';

  async resolve(embedUrl) {
    // Fetch the embed page like a real navigation (strip Origin, set Sec-Fetch-*)
    // — VOE 500s a plain cross-origin fetch.
    await addStreamRule(embedUrl, { referer: embedUrl, navigation: true });
    let html = await this.fetchText(embedUrl);
    if (!html) return null;

    if (html.includes('Redirecting...')) {
      const m = html.match(/href\s*=\s*'(.*?)';/);
      if (!m) return null;
      await addStreamRule(m[1], { referer: embedUrl, navigation: true });
      html = await this.fetchText(m[1]);
      if (!html) return null;
    }

    const script = html.match(
      /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!script) return null;
    const enc = script[1].trim().match(/\["(.*?)"\]/);
    if (!enc) return null;

    let data;
    try {
      data = decodeVoe(enc[1]);
    } catch (e) {
      console.warn('[voe] decode failed:', e);
      return null;
    }

    let videoUrl = data.source;
    if (!videoUrl) {
      const fb = (data.fallback || []).find((f) => f && f.file);
      videoUrl = fb && fb.file;
    }
    if (!videoUrl) return null;

    await addStreamRule(videoUrl, { referer: VOE_REFERER });
    const type = videoUrl.toLowerCase().includes('m3u8') ? 'hls' : 'mp4';
    return { url: videoUrl, type };
  }
}
