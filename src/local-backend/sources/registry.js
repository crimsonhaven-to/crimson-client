// Source registry. Scrapers turn (tmdb/anilist + season + episode) into embed
// URLs/markers; resolvers turn those into playable stream URLs. Kept separate so
// sources/index.js (the pipeline) stays source-agnostic.

import { CinemabzScraper, CinemabzTcloudResolver, CinemabzIpcloudResolver, CinemabzNgcloudResolver } from './cinemabz.js';
import { PlayimdbScraper, PlayimdbResolver } from './playimdb.js';
import { AniworldScraper } from './aniworld.js';
import { VoeResolver } from './voe.js';
import { VidmolyResolver } from './vidmoly.js';
import { AniwatchScraper } from './aniwatch.js';
import { VidSrcResolver } from './vidsrc.js';

export const ALL_SCRAPERS = [
  // TMDB-keyed (M3)
  CinemabzScraper,
  PlayimdbScraper,
  // Anime sites (M4)
  AniworldScraper, // -> VOE / Vidmoly
  AniwatchScraper, // -> VidSrc (megaplay)
];

export const ALL_RESOLVERS = [
  CinemabzTcloudResolver,
  CinemabzIpcloudResolver,
  CinemabzNgcloudResolver,
  PlayimdbResolver,
  VoeResolver,
  VidmolyResolver,
  VidSrcResolver,
];
