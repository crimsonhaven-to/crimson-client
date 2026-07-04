import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Rows3, Square, BookOpen,
  AlertTriangle, ArrowLeftRight, Loader2, Maximize2, Minimize2,
} from 'lucide-react';
import { useMangaReader, useMangaResume, useAccount, useAuth, useTitle } from './hooks';

// Manga reader — the reading twin of CrimsonPlayer. Launches inline (nav visible,
// not browser-fullscreen) with a full set of controls, and can go true fullscreen
// via the Fullscreen API. Two modes: a webtoon-style vertical long-strip (default)
// and a single-page "paged" mode with right-to-left support (manga reads RTL).
//
// Chrome (top bar + bottom control bar) auto-hides after a few seconds of reading
// and re-reveals on mouse-move or scroll-up — and in fullscreen a small exit button
// is ALWAYS present so you can never get stuck. Reading progress reuses
// /account/progress (media_type:'manga'): the chapter ordinal rides in
// episode_number, the page in position_seconds — so "continue reading" works with no
// schema change. Prefs persist in localStorage.
//
// Two routes hit this component:
//   /read/:anilistId/:chapterId  — read a specific chapter
//   /read/:anilistId             — RESUME: resolve the saved chapter and redirect
const MODE_KEY = 'crimson:manga:mode';
const RTL_KEY = 'crimson:manga:rtl';
const loadPref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const savePref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const MangaReader = () => {
  const { anilistId, chapterId } = useParams();
  const navigate = useNavigate();
  const { updateProgress } = useAccount();
  const { isAuthenticated } = useAuth();
  const resume = useMangaResume(anilistId);

  const {
    overview, chapters,
    currentChapter, currentIndex,
    prevChapter, nextChapter,
    pages, pagesLoading, error,
  } = useMangaReader(anilistId, chapterId);

  const [mode, setMode] = useState(() => (loadPref(MODE_KEY, 'vertical') === 'paged' ? 'paged' : 'vertical'));
  const [rtl, setRtl] = useState(() => loadPref(RTL_KEY, '0') === '1');
  const [page, setPage] = useState(1);           // 1-based current page
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const total = pages.length;
  const chapterOrdinal = currentIndex >= 0 ? currentIndex + 1 : null;
  const title = overview?.title || 'Manga';
  useTitle(currentChapter ? `${title} — Ch. ${currentChapter.chapter ?? chapterOrdinal}` : title);

  // --- resume route (/read/:anilistId, no chapter id) --------------------------
  // Map the saved progress ordinal → chapter id and redirect into the reader so
  // "Continue Reading" from history/overview reads immediately. Falls back to the
  // first chapter (fresh start) and, if the title never maps, to the overview.
  useEffect(() => {
    if (chapterId) return;
    if (!chapters.length) {
      // Overview finished loading but produced no chapters -> nothing to resume into.
      if (overview) navigate(`/manga/${anilistId}`, { replace: true });
      return;
    }
    const ord = resume?.episode_number;
    const target = (ord && chapters[ord - 1]) || chapters[0];
    if (target) navigate(`/read/${anilistId}/${encodeURIComponent(target.id)}`, { replace: true });
  }, [chapterId, chapters, overview, resume, anilistId, navigate]);

  // Refs for each page (vertical mode) so an IntersectionObserver can tell us which
  // page is currently on screen (drives the counter + progress + scrubber).
  const pageRefs = useRef([]);
  pageRefs.current = [];
  const registerPage = (el) => { if (el) pageRefs.current.push(el); };

  // --- chrome auto-hide (reveal on activity, hide while reading) ----------------
  const hideTimer = useRef(null);
  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), 3200);
  }, []);
  // Reveal on mount + whenever the chapter changes, then let it settle.
  useEffect(() => { revealChrome(); }, [chapterId, revealChrome]);
  // Mouse-move reveals; scroll direction reveals (up) / hides (down). Bind to both
  // window (inline) and the container (which is the scroller in fullscreen).
  useEffect(() => {
    const onMove = () => revealChrome();
    const lastY = { v: 0 };
    const onScroll = (e) => {
      const y = (e.target === document ? window.scrollY : e.target.scrollTop) || 0;
      if (y < lastY.v - 4) revealChrome();
      else if (y > lastY.v + 10) { setChromeVisible(false); if (hideTimer.current) clearTimeout(hideTimer.current); }
      lastY.v = y;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    const el = containerRef.current;
    el?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      el?.removeEventListener('scroll', onScroll);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [revealChrome, isFullscreen]);

  // --- fullscreen (real Fullscreen API on the reader container) -----------------
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }, []);
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // --- resume: jump to the saved page when this is the resumed chapter ----------
  const appliedResumeRef = useRef(false);
  useEffect(() => { appliedResumeRef.current = false; }, [chapterId]);
  useEffect(() => {
    if (appliedResumeRef.current || pagesLoading || total === 0) return;
    appliedResumeRef.current = true;
    // Only resume the page if the saved progress is for THIS chapter ordinal.
    if (resume && resume.episode_number === chapterOrdinal && resume.position_seconds > 1) {
      const startPage = Math.min(Math.max(1, Math.round(resume.position_seconds)), total);
      setPage(startPage);
      if (mode === 'paged') return;
      // Vertical: scroll the saved page into view once images have a chance to lay out.
      setTimeout(() => {
        const el = pageRefs.current[startPage - 1];
        if (el) el.scrollIntoView({ block: 'start' });
      }, 100);
    } else {
      setPage(1);
    }
  }, [pagesLoading, total, resume, chapterOrdinal, mode]);

  // --- vertical mode: track the on-screen page via IntersectionObserver --------
  useEffect(() => {
    if (mode !== 'vertical' || total === 0) return;
    const els = pageRefs.current;
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best = null, bestRatio = 0;
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= bestRatio) {
            bestRatio = e.intersectionRatio;
            best = Number(e.target.dataset.index);
          }
        }
        if (best != null) setPage(best + 1);
      },
      // In fullscreen the reader container is the scroller, so it's the root.
      { threshold: [0.1, 0.5, 0.9], root: isFullscreen ? containerRef.current : null }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [mode, total, chapterId, isFullscreen]);

  // --- progress: save (debounced) as the page changes, and on unmount ----------
  const saveProgress = useCallback((pageNum) => {
    if (!isAuthenticated || !overview || chapterOrdinal == null || !total) return;
    updateProgress({
      anilist_id: Number(anilistId),
      media_type: 'manga',
      episode_number: chapterOrdinal,   // chapter ordinal (1-based)
      position_seconds: pageNum,        // current page (1-based)
      duration_seconds: total,          // pages in this chapter
      title: overview.title,
      poster: overview.poster,
    });
  }, [isAuthenticated, overview, chapterOrdinal, total, anilistId, updateProgress]);

  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    if (pagesLoading || !total) return;
    const t = setTimeout(() => saveProgress(pageRef.current), 1200);
    return () => clearTimeout(t);
  }, [page, pagesLoading, total, saveProgress]);
  // Flush on unmount / chapter change so we never lose the last position.
  useEffect(() => () => saveProgress(pageRef.current), [saveProgress]);

  // --- navigation --------------------------------------------------------------
  const goToChapter = useCallback((ch) => {
    if (ch) navigate(`/read/${anilistId}/${encodeURIComponent(ch.id)}`);
  }, [anilistId, navigate]);

  // Jump to a page (scrubber / paging). Scrolls it into view in vertical mode.
  const goToPage = useCallback((n) => {
    const clamped = Math.min(Math.max(1, n), total || 1);
    setPage(clamped);
    if (mode === 'vertical') {
      const el = pageRefs.current[clamped - 1];
      if (el) el.scrollIntoView({ block: 'start' });
    }
  }, [total, mode]);

  const flipNext = useCallback(() => {
    if (page < total) goToPage(page + 1);
    else if (nextChapter) goToChapter(nextChapter);
  }, [page, total, nextChapter, goToChapter, goToPage]);

  const flipPrev = useCallback(() => {
    if (page > 1) goToPage(page - 1);
    else if (prevChapter) goToChapter(prevChapter);
  }, [page, prevChapter, goToChapter, goToPage]);

  // Keyboard: arrows page (RTL swaps their meaning); F toggles fullscreen; Esc exits
  // (fullscreen first — the browser handles that — else back to the overview).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { if (document.fullscreenElement) return; navigate(`/manga/${anilistId}`); return; }
      if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); return; }
      if (e.key === 'ArrowRight') { mode === 'paged' && (rtl ? flipPrev() : flipNext()); }
      else if (e.key === 'ArrowLeft') { mode === 'paged' && (rtl ? flipNext() : flipPrev()); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, rtl, flipNext, flipPrev, navigate, anilistId, toggleFullscreen]);

  // Preload the neighbouring pages in paged mode for instant flips.
  useEffect(() => {
    if (mode !== 'paged' || !total) return;
    [page, page + 1].forEach((n) => {
      const url = pages[n - 1];
      if (url) { const img = new Image(); img.src = url; }
    });
  }, [mode, page, total, pages]);

  const toggleMode = () => setMode((m) => { const next = m === 'vertical' ? 'paged' : 'vertical'; savePref(MODE_KEY, next); return next; });
  const toggleRtl = () => setRtl((v) => { savePref(RTL_KEY, v ? '0' : '1'); return !v; });

  const chapterLabel = (ch) => (ch?.chapter != null ? `Ch. ${ch.chapter}` : 'Oneshot') + (ch?.title ? ` · ${ch.title}` : '');

  // While the resume route resolves (no chapterId yet) show a clean spinner.
  const resolvingResume = !chapterId;

  // --- chrome (top bar + bottom control bar) -----------------------------------
  const iconBtn = 'p-2 rounded-lg border transition-all shrink-0';
  const header = (
    <div className={`sticky top-0 z-40 transition-transform duration-300 ${chromeVisible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 bg-crimson-950/95 backdrop-blur-xl border-b border-crimson-900/60">
        <Link to={`/manga/${anilistId}`} className="p-2 rounded-lg text-crimson-400 hover:text-white hover:bg-crimson-900/50 transition-all shrink-0" aria-label="Back to overview">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-grow">
          <p className="text-xs sm:text-sm font-black text-crimson-50 truncate tracking-tight">{title}</p>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 truncate">
            {currentChapter ? chapterLabel(currentChapter) : 'Chapter'}
          </p>
        </div>

        {/* Chapter picker */}
        {chapters.length > 0 && (
          <select
            value={chapterId || ''}
            onChange={(e) => navigate(`/read/${anilistId}/${encodeURIComponent(e.target.value)}`)}
            className="max-w-[8rem] sm:max-w-[12rem] text-[11px] font-bold bg-crimson-950/60 border border-crimson-900/60 rounded-lg text-crimson-200 px-2 py-1.5 focus:outline-none focus:border-crimson-600 truncate"
            aria-label="Jump to chapter"
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>{chapterLabel(ch)}</option>
            ))}
          </select>
        )}

        <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} className={`${iconBtn} border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600`} aria-label="Toggle fullscreen">
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  const controlBar = total > 0 && !resolvingResume && (
    <div className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${chromeVisible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="mx-auto max-w-4xl m-3 rounded-2xl border border-crimson-900/60 bg-crimson-950/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] px-3 sm:px-4 py-2.5 space-y-2">
        {/* Page scrubber */}
        <div className="flex items-center gap-3">
          <button onClick={flipPrev} disabled={page <= 1 && !prevChapter} className="p-1.5 rounded-lg text-crimson-400 hover:text-white hover:bg-crimson-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0" aria-label="Previous page">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <input
            type="range"
            min={1}
            max={total}
            value={Math.min(page, total)}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="manga-scrubber flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-crimson-900/70 accent-crimson-500"
            aria-label="Page scrubber"
          />
          <span className="text-[11px] font-black tabular-nums tracking-widest text-crimson-300 shrink-0 w-16 text-center">
            {Math.min(page, total)} / {total}
          </span>
          <button onClick={flipNext} disabled={page >= total && !nextChapter} className="p-1.5 rounded-lg text-crimson-400 hover:text-white hover:bg-crimson-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0" aria-label="Next page">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Secondary controls: chapter hop + reading options */}
        <div className="flex items-center gap-2">
          <button onClick={() => goToChapter(prevChapter)} disabled={!prevChapter} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-crimson-400 hover:text-white hover:bg-crimson-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronLeft className="w-3.5 h-3.5" /> Prev Ch.
          </button>
          <button onClick={() => goToChapter(nextChapter)} disabled={!nextChapter} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-crimson-400 hover:text-white hover:bg-crimson-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            Next Ch. <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1" />

          {mode === 'paged' && (
            <button onClick={toggleRtl} title={rtl ? 'Right-to-left (manga)' : 'Left-to-right'} className={`${iconBtn} ${rtl ? 'bg-crimson-600/20 border-crimson-500/50 text-crimson-300' : 'border-crimson-900/60 text-crimson-500 hover:text-white'}`} aria-label="Toggle reading direction">
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          )}
          <button onClick={toggleMode} title={mode === 'vertical' ? 'Vertical (webtoon)' : 'Paged'} className={`${iconBtn} border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600`} aria-label="Toggle reading mode">
            {mode === 'vertical' ? <Rows3 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );

  // Root: the fullscreen target. In fullscreen it becomes the scroll container.
  const rootClass = `relative bg-crimson-950 ${isFullscreen ? 'h-screen overflow-y-auto' : 'min-h-screen'}`;

  // Small always-present exit while fullscreen with chrome hidden — never get stuck.
  const fsExit = isFullscreen && !chromeVisible && (
    <button onClick={toggleFullscreen} className="fixed top-3 right-3 z-50 p-2 rounded-full bg-crimson-950/80 border border-crimson-900/70 text-crimson-300 hover:text-white hover:border-crimson-600 shadow-lg transition-all" aria-label="Exit fullscreen">
      <Minimize2 className="w-4 h-4" />
    </button>
  );

  if (error) {
    return (
      <div ref={containerRef} className={rootClass}>
        {header}
        <div className="max-w-md mx-auto pt-32 px-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-crimson-500 mx-auto" />
          <p className="text-crimson-300 font-bold">This chapter's pages could not be conjured.</p>
          <div className="flex items-center justify-center gap-3">
            {prevChapter && <button onClick={() => goToChapter(prevChapter)} className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500 hover:text-crimson-400">Previous</button>}
            {nextChapter && <button onClick={() => goToChapter(nextChapter)} className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500 hover:text-crimson-400">Next</button>}
          </div>
        </div>
        {fsExit}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={rootClass}>
      {header}
      {fsExit}

      {(pagesLoading || resolvingResume) ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-8 h-8 text-crimson-500 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-crimson-600">
            {resolvingResume ? 'Finding your place' : 'Summoning pages'}
          </p>
        </div>
      ) : mode === 'vertical' ? (
        // --- Webtoon long-strip ---------------------------------------------
        <div className="max-w-3xl mx-auto pb-28" onClick={() => setChromeVisible((v) => !v)}>
          {pages.map((url, i) => (
            <img
              key={i}
              ref={registerPage}
              data-index={i}
              src={url}
              alt={`Page ${i + 1}`}
              loading={i < 2 ? 'eager' : 'lazy'}
              className="w-full block select-none"
              draggable={false}
            />
          ))}
          <ChapterFooter prevChapter={prevChapter} nextChapter={nextChapter} onGo={goToChapter} chapterLabel={chapterLabel} />
        </div>
      ) : (
        // --- Paged (single page, RTL-aware) ---------------------------------
        <div className="relative max-w-3xl mx-auto min-h-screen flex items-center justify-center px-2 select-none">
          {pages[page - 1] && (
            <img src={pages[page - 1]} alt={`Page ${page}`} className="max-h-[calc(100vh-2rem)] w-auto mx-auto" draggable={false} />
          )}

          {/* Tap zones: outer thirds flip pages (respecting RTL); centre toggles chrome. */}
          <button className="absolute inset-y-0 left-0 w-1/3 cursor-pointer focus:outline-none" onClick={rtl ? flipNext : flipPrev} aria-label={rtl ? 'Next page' : 'Previous page'} />
          <button className="absolute inset-y-0 left-1/3 w-1/3 cursor-pointer focus:outline-none" onClick={() => setChromeVisible((v) => !v)} aria-label="Toggle controls" />
          <button className="absolute inset-y-0 right-0 w-1/3 cursor-pointer focus:outline-none" onClick={rtl ? flipPrev : flipNext} aria-label={rtl ? 'Previous page' : 'Next page'} />
        </div>
      )}

      {controlBar}
    </div>
  );
};

// End-of-chapter card (vertical mode): jump to the neighbouring chapters.
function ChapterFooter({ prevChapter, nextChapter, onGo, chapterLabel }) {
  if (!prevChapter && !nextChapter) {
    return (
      <div className="text-center py-12 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-700">
        <BookOpen className="w-6 h-6 mx-auto mb-3 text-crimson-800" />
        The end, for now
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-8">
      {prevChapter ? (
        <button onClick={() => onGo(prevChapter)} className="flex-1 flex items-center gap-3 px-4 py-4 rounded-xl bg-crimson-950/50 border border-crimson-900/60 hover:border-crimson-600/60 transition-all text-left group">
          <ChevronLeft className="w-5 h-5 text-crimson-500 shrink-0 group-hover:-translate-x-1 transition-transform" />
          <span className="min-w-0">
            <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600">Previous</span>
            <span className="block text-xs font-bold text-crimson-200 truncate">{chapterLabel(prevChapter)}</span>
          </span>
        </button>
      ) : <div className="flex-1" />}
      {nextChapter ? (
        <button onClick={() => onGo(nextChapter)} className="flex-1 flex items-center justify-end gap-3 px-4 py-4 rounded-xl bg-crimson-600/15 border border-crimson-500/40 hover:border-crimson-500/70 transition-all text-right group">
          <span className="min-w-0">
            <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-crimson-500">Next</span>
            <span className="block text-xs font-bold text-crimson-100 truncate">{chapterLabel(nextChapter)}</span>
          </span>
          <ChevronRight className="w-5 h-5 text-crimson-400 shrink-0 group-hover:translate-x-1 transition-transform" />
        </button>
      ) : <div className="flex-1" />}
    </div>
  );
}

export default MangaReader;
