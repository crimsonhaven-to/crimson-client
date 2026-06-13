// Progressive episode resolve, ported from api.py:stream_watch_response. Returns
// a ReadableStream that emits NDJSON lines (one `meta`, one `stream` per resolved
// source as it lands, a final `done`) — byte-for-byte the format the frontend's
// useAnimeStreamer reader already consumes, so the React layer is untouched.

import { fetchAnilistMetadata } from './anilist.js';
import { ALL_SCRAPERS, runScraper, resolveStreams } from './sources/index.js';

const enc = new TextEncoder();
const ndjson = (obj) => enc.encode(JSON.stringify(obj) + '\n');

export function watchStream(tmdbId, seasonNumber, episodeNumber, anilistId, fallbackTitle) {
  return new ReadableStream({
    async start(controller) {
      try {
        const anilistData = anilistId ? (await fetchAnilistMetadata(anilistId)) || {} : {};
        const title = anilistData.title || fallbackTitle || null;
        const mediaCtx = { ...anilistData, title };

        controller.enqueue(ndjson({
          type: 'meta',
          success: true,
          tmdb_id: tmdbId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          anilist_id: anilistId,
          title,
        }));

        const seenEmbeds = new Set();
        const seenUrls = new Set();
        let count = 0;

        // Run every scraper concurrently; emit each resolved stream the instant
        // it's ready, so the fastest source reaches the player first (matches the
        // backend's queue-drain behaviour, expressed as concurrent appends).
        await Promise.all(
          ALL_SCRAPERS.map(async (ScraperClass) => {
            let embeds;
            try {
              embeds = await runScraper(ScraperClass, tmdbId, seasonNumber, episodeNumber, mediaCtx);
            } catch (e) {
              console.warn('[watch] scraper failed:', ScraperClass.name, e);
              return;
            }
            for (const embed of embeds) {
              const embedUrl = typeof embed === 'object' ? embed.url : embed;
              const language = typeof embed === 'object' ? embed.language : null;
              if (!embedUrl || seenEmbeds.has(embedUrl)) continue;
              seenEmbeds.add(embedUrl);
              const streams = await resolveStreams([embedUrl], { language });
              for (const stream of streams) {
                if (seenUrls.has(stream.url)) continue;
                seenUrls.add(stream.url);
                count += 1;
                controller.enqueue(ndjson({
                  type: 'stream',
                  source: stream.source,
                  streamType: stream.type,
                  url: stream.url,
                  language: stream.language ?? null,
                }));
              }
            }
          }),
        );

        controller.enqueue(ndjson({ type: 'done', count }));
      } catch (e) {
        console.error('[watch] stream error:', e);
        try { controller.enqueue(ndjson({ type: 'done', count: 0 })); } catch { /* closed */ }
      } finally {
        controller.close();
      }
    },
  });
}
