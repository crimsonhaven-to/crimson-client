// Chapter lists and page images are resolved in the viewer's browser
// (clientManga.js) because the public backend never talks to a manga host.
// Progress reuses /account/progress with media_type 'manga': chapter ordinal in
// episode_number, page in position_seconds.
import { useCallback, useEffect, useState } from 'react';

import { apiFetch, useSessionToken } from '../api/client';
import { memGet, memSet } from '../api/memCache';
import { clientMangaEnabled, resolveMangaSources, resolveMangaPages } from './clientManga';

// When the backend mapped no chapters (public build) they are resolved client-side.
// `manga_sources` feeds the source picker; `chapters` is the first source so
// single-list callers (resume, "Start Reading") need not know about sources.
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
        _clientResolved: true,
      };
    }
  }
  return data;
}

async function loadPages(anilistId, chapterId, clientResolved, dataSaver = false) {
  if (!clientResolved) {
    const res = await apiFetch(`/read/${anilistId}/${encodeURIComponent(chapterId)}`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.pages) ? data.pages : [];
    }
    if (res.status !== 404) throw new Error(`Failed to load chapter (HTTP ${res.status})`);
    // 404 means no server-side provider, so resolve in the browser.
  }
  if (clientMangaEnabled()) {
    const pages = await resolveMangaPages(chapterId, dataSaver);
    if (pages.length) return pages;
  }
  throw new Error('Chapter pages unavailable');
}

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
        // An empty row does not render, and manga may simply be disabled.
        console.error('Error fetching trending manga:', e);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, []);

  return { trendingManga, trendLoading };
}

// Shares the `manga-overview:{id}` cache entry with useMangaReader, so opening the
// reader afterwards is instant.
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

export function useMangaReader(anilistId, chapterId) {
  const [overview, setOverview] = useState(() => (anilistId ? memGet(`manga-overview:${anilistId}`) : null));
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [error, setError] = useState(null);

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
    // Depends on _clientResolved so a client-resolved chapter never probes /read.
  }, [anilistId, chapterId, overview?._clientResolved]);

  // Chapter ids are "{sourceId}:{rawId}". Each source numbers chapters differently,
  // so prev/next must stay within the source that owns the current chapter.
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
