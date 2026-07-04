// --- Manga (the reading surface) --------------------------------------------
// The reading twin of the anime/show/movie hooks: discovery + overview + a reader
// data layer, all keyed by AniList id. Discovery + metadata come from the backend
// (AniList); the CHAPTER LIST and PAGE IMAGES are resolved in the viewer's own
// browser (crimson-sources, via clientManga.js) because the public backend never
// talks to a manga host. When a chapter list comes back empty (a base build with no
// server-side provider) we fill it client-side and mark the overview `_clientResolved`
// so the reader fetches its pages the same way. Progress reuses the normal
// /account/progress with media_type:'manga' (chapter ordinal in episode_number, page
// in position_seconds), so continue-reading works with no schema change.
import { useCallback, useEffect, useState } from 'react';

import { apiFetch, useSessionToken } from './apiClient';
import { memGet, memSet } from './memCache';
import { clientMangaEnabled, resolveMangaSources, resolveMangaPages } from '../clientManga';

// Fetch a manga overview from the backend and, when the backend didn't map any
// chapters (public build), resolve the chapter list client-side and fold it in.
// Shared by useMangaOverview and useMangaReader so a deep-linked reader resolves the
// same way. Best-effort: on client-resolution failure we keep the backend response.
//
// Resolution is multi-source: `manga_sources` carries one entry per matched source
// (each with its own tagged chapter list) so the overview can offer a source picker,
// while `chapters` defaults to the first source so the existing single-list callers
// (resume, "Start Reading") keep working unchanged.
async function loadOverview(anilistId) {
  const res = await apiFetch(`/manga-overview/${anilistId}`);
  if (!res.ok) throw new Error(`Failed to load overview (HTTP ${res.status})`);
  const data = await res.json();
  if ((!data.chapters || data.chapters.length === 0) && clientMangaEnabled()) {
    const sources = await resolveMangaSources({
      titles: data.candidate_titles || [],
      contentRating: data.content_rating || [],
      language: data.language || data.languages?.[0] || 'en',
    });
    const primary = sources[0];
    if (primary?.chapters?.length) {
      return {
        ...data,
        manga_sources: sources,
        chapters: primary.chapters,
        chapter_count: primary.chapters.length,
        mangadex_id: primary.mangaId,
        mapped: true,
        _clientResolved: true, // the reader must resolve pages client-side too
      };
    }
  }
  return data;
}

// One chapter's ordered page-image URLs. Backend-provider builds serve them from
// /read; a client-resolved overview (base build) resolves them in the browser (raw
// @Home URLs). We also fall back to the client if /read 404s (no provider present).
async function loadPages(anilistId, chapterId, clientResolved, dataSaver = false) {
  if (!clientResolved) {
    const res = await apiFetch(`/read/${anilistId}/${encodeURIComponent(chapterId)}`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.pages) ? data.pages : [];
    }
    if (res.status !== 404) throw new Error(`Failed to load chapter (HTTP ${res.status})`);
    // 404 => no server-side provider; resolve in the browser instead.
  }
  if (clientMangaEnabled()) {
    const pages = await resolveMangaPages(chapterId, dataSaver);
    if (pages.length) return pages;
  }
  throw new Error('Chapter pages unavailable');
}

// Trending manga for the landing page's manga row (mirrors useTrendingShows).
export function useTrendingManga() {
  const [trendingManga, setTrendingManga] = useState(() => memGet('trending-manga') || []);
  const [trendLoading, setTrendLoading] = useState(() => !memGet('trending-manga'));

  useEffect(() => {
    if (memGet('trending-manga')) return;
    (async () => {
      setTrendLoading(true);
      try {
        const res = await apiFetch(`/trending/manga`);
        if (!res.ok) throw new Error('Failed to fetch trending manga.');
        const data = await res.json();
        if (data.success && Array.isArray(data.manga)) {
          setTrendingManga(data.manga);
          memSet('trending-manga', data.manga);
        }
      } catch (e) {
        // Best-effort: an empty row simply doesn't render (manga may be disabled).
        console.error('Error fetching trending manga:', e);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, []);

  return { trendingManga, trendLoading };
}

// Full manga overview: AniList metadata + the chapter list (backend-mapped or
// client-resolved). The reading twin of useShowOverview, but flatter (no seasons — a
// manga is a single ordered run of chapters). Cached module-wide so opening the
// reader afterwards is instant (it reuses the same `manga-overview:{id}` cache entry).
export function useMangaOverview(anilistId) {
  const [overview, setOverview] = useState(() => (anilistId ? memGet(`manga-overview:${anilistId}`) : null));
  const [loading, setLoading] = useState(() => !(anilistId && memGet(`manga-overview:${anilistId}`)));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!anilistId) return;
    const cached = memGet(`manga-overview:${anilistId}`);
    if (cached) { setOverview(cached); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await loadOverview(anilistId);
        if (cancelled) return;
        setOverview(data);
        memSet(`manga-overview:${anilistId}`, data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [anilistId]);

  return { overview, loading, error };
}

// Latest reading-progress row for ONE manga, so the overview can surface a
// "continue reading" banner and the reader can resume the right chapter/page.
// Manga rows carry media_type:'manga' and match on anilist_id. Best-effort/silent.
export function useMangaResume(anilistId) {
  const sessionToken = useSessionToken();
  const [resume, setResume] = useState(null);

  const refresh = useCallback(async () => {
    if (!sessionToken || anilistId == null) { setResume(null); return; }
    try {
      const res = await apiFetch(`/account/progress`);
      if (!res.ok) return;
      const rows = (await res.json()).progress || [];
      const match = rows.find(r => r.media_type === 'manga' && String(r.anilist_id) === String(anilistId));
      setResume(match || null);
    } catch { /* no banner on failure */ }
  }, [sessionToken, anilistId]);

  useEffect(() => { refresh(); }, [refresh]);
  return resume;
}

// Reader data layer: resolves the chapter list (reusing the overview cache) and
// fetches the ordered page images for the current chapter. Exposes the neighbouring
// chapters so the reader can wire prev/next without another request.
export function useMangaReader(anilistId, chapterId) {
  const [overview, setOverview] = useState(() => (anilistId ? memGet(`manga-overview:${anilistId}`) : null));
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ensure we have the chapter list (for prev/next + titles + how to fetch pages).
  // Cheap on a cache hit; re-runs (and returns early) once overview is set.
  useEffect(() => {
    if (!anilistId || overview) return;
    const cached = memGet(`manga-overview:${anilistId}`);
    if (cached) { setOverview(cached); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await loadOverview(anilistId);
        if (cancelled) return;
        setOverview(data);
        memSet(`manga-overview:${anilistId}`, data);
      } catch { /* the reader surfaces the error via the pages fetch below */ }
    })();
    return () => { cancelled = true; };
  }, [anilistId, overview]);

  // Fetch the page manifest for the current chapter (server-side or client-side).
  useEffect(() => {
    if (!anilistId || !chapterId) return;
    let cancelled = false;
    setPagesLoading(true);
    setPages([]);
    setError(null);
    (async () => {
      try {
        const clientResolved = Boolean(overview?._clientResolved);
        const pgs = await loadPages(anilistId, chapterId, clientResolved);
        if (cancelled) return;
        setPages(pgs);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setPagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Re-run once we learn the overview's resolution mode (_clientResolved) so a
    // client-resolved chapter doesn't first (needlessly) probe the backend /read.
  }, [anilistId, chapterId, overview?._clientResolved]);

  // With multi-source resolution the chapter id is namespaced "{sourceId}:{rawId}";
  // use the chapter list of the source that owns the CURRENT chapter so prev/next and
  // the reader's chapter dropdown stay within that source (each source has its own,
  // differently-numbered chapter list). Falls back to the default `chapters`.
  const sources = overview?.manga_sources;
  let chapters = overview?.chapters || [];
  if (Array.isArray(sources) && sources.length && chapterId) {
    const prefix = String(chapterId).split(':')[0];
    const owner = sources.find(s => s.sourceId === prefix);
    if (owner?.chapters?.length) chapters = owner.chapters;
  }
  const currentIndex = chapters.findIndex(c => String(c.id) === String(chapterId));
  const currentChapter = currentIndex >= 0 ? chapters[currentIndex] : null;
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1
    ? chapters[currentIndex + 1] : null;

  return {
    overview, chapters,
    currentChapter, currentIndex,
    prevChapter, nextChapter,
    pages, pagesLoading, error,
  };
}
