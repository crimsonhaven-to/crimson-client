// AniList access — a direct port of api.py's fetch_anilist_metadata (single show)
// plus a browse query used to build the catalogue locally (the backend served the
// catalogue from its synced Postgres mirror; here we derive an equivalent list
// straight from AniList, which gives titles/format/genres directly).

import { cached } from './cache.js';
import { ensureMaps, firstAnilistToTmdb } from './mapping.js';

const ANILIST_URL = 'https://graphql.anilist.co';
const DAY = 24 * 60 * 60 * 1000;

async function gql(query, variables) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  return res.json();
}

const MEDIA_QUERY = `
query ($id: Int) {
  Media (id: $id, type: ANIME) {
    id status episodes bannerImage
    coverImage { large extraLarge }
    title { romaji english native }
    synonyms description
    startDate { year month day }
    endDate { year month day }
    streamingEpisodes { title thumbnail url }
    nextAiringEpisode { episode airingAt }
  }
}`;

// --- fetch_anilist_metadata ------------------------------------------------
export async function fetchAnilistMetadata(anilistId) {
  if (!anilistId) return {};
  return cached(`anilist:meta:${anilistId}`, DAY, async () => {
    let body;
    try {
      body = await gql(MEDIA_QUERY, { id: anilistId });
    } catch (e) {
      console.warn('[anilist] meta failed:', e);
      return {};
    }
    const media = body?.data?.Media;
    if (!media) return {};

    const raw = media.streamingEpisodes || [];
    let episodes = raw.map((ep, i) => ({
      episode_number: i + 1,
      title: ep.title || `Episode ${i + 1}`,
      thumbnail: ep.thumbnail,
      url: ep.url,
    }));
    if (!episodes.length && media.episodes) {
      episodes = Array.from({ length: media.episodes }, (_, i) => ({
        episode_number: i + 1,
        title: `Episode ${i + 1}`,
        thumbnail: null,
        url: null,
      }));
    }

    const t = media.title || {};
    const cover = media.coverImage || {};
    return {
      anilist_id: media.id,
      title: t.english || t.romaji,
      title_romaji: t.romaji,
      title_english: t.english,
      title_native: t.native,
      synonyms: media.synonyms || [],
      total_episodes: media.episodes,
      status: media.status,
      banner: media.bannerImage,
      cover: cover.extraLarge || cover.large,
      description: media.description,
      start_date: media.startDate,
      end_date: media.endDate,
      next_airing_episode: media.nextAiringEpisode,
      episodes_list: episodes,
    };
  });
}

// --- catalogue (AniList browse) --------------------------------------------
// AniList `format` -> the catalogue "category" the UI groups by.
const FORMAT_TO_CATEGORY = {
  TV: 'TV',
  TV_SHORT: 'TV',
  MOVIE: 'MOVIE',
  SPECIAL: 'SPECIAL',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'MUSIC',
};

const BROWSE_QUERY = `
query ($page: Int, $perPage: Int) {
  Page (page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media (type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      id format genres startDate { year }
      title { romaji english }
    }
  }
}`;

// Build a catalogue of the most popular anime. Cached for the session; AniList is
// paged 50 at a time. Each item is mapped to a tmdb_id (best-effort) for parity,
// but navigation uses anilist_id (matches the web Catalogue card).
export async function catalogueItems({ pages = 8, perPage = 50 } = {}) {
  return cached('anilist:catalogue', 6 * 60 * 60 * 1000, async () => {
    await ensureMaps(); // firstAnilistToTmdb below is a sync index lookup
    const items = [];
    for (let page = 1; page <= pages; page++) {
      let body;
      try {
        body = await gql(BROWSE_QUERY, { page, perPage });
      } catch (e) {
        console.warn('[anilist] catalogue page failed:', page, e);
        break;
      }
      const pageData = body?.data?.Page;
      if (!pageData) break;
      for (const m of pageData.media || []) {
        const t = m.title || {};
        items.push({
          anilist_id: m.id,
          tmdb_id: firstAnilistToTmdb(m.id),
          title: t.english || t.romaji,
          title_romaji: t.romaji,
          title_english: t.english,
          category: FORMAT_TO_CATEGORY[m.format] || 'UNKNOWN',
          genres: m.genres || [],
          year: m.startDate?.year ? String(m.startDate.year) : null,
        });
      }
      if (!pageData.pageInfo?.hasNextPage) break;
      // Be gentle with AniList's rate limiter between pages.
      await new Promise((r) => setTimeout(r, 700));
    }
    return items;
  });
}
