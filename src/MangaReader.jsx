import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Rows3, Square, BookOpen,
  AlertTriangle, ArrowLeftRight, Loader2,
} from 'lucide-react';
import { useMangaReader, useMangaResume, useAccount, useAuth, useTitle } from './hooks';

// Manga reader (/read/:anilistId/:chapterId) — the reading twin of WatchView. Two
// modes: a webtoon-style vertical long-strip (default, works for both manga and
// webtoons) and a single-page "paged" mode with right-to-left support (manga reads
// RTL). Reading progress reuses /account/progress (media_type:'manga'): the chapter
// ordinal rides in episode_number, the page in position_seconds — so "continue
// reading" works with no schema change. Prefs persist in localStorage.
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
  const [chromeHidden, setChromeHidden] = useState(false);

  const total = pages.length;
  const chapterOrdinal = currentIndex >= 0 ? currentIndex + 1 : null;
  const title = overview?.title || 'Manga';
  useTitle(currentChapter ? `${title} — Ch. ${currentChapter.chapter ?? chapterOrdinal}` : title);

  // Refs for each page (vertical mode) so an IntersectionObserver can tell us which
  // page is currently on screen (drives the counter + progress).
  const pageRefs = useRef([]);
  pageRefs.current = [];
  const registerPage = (el) => { if (el) pageRefs.current.push(el); };

  // --- resume: jump to the saved page when this is the resumed chapter ---------
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
        // The most-visible intersecting page wins.
        let best = null, bestRatio = 0;
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= bestRatio) {
            bestRatio = e.intersectionRatio;
            best = Number(e.target.dataset.index);
          }
        }
        if (best != null) setPage(best + 1);
      },
      { threshold: [0.1, 0.5, 0.9] }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [mode, total, chapterId]);

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

  const flipNext = useCallback(() => {
    if (page < total) setPage((p) => p + 1);
    else if (nextChapter) goToChapter(nextChapter);
  }, [page, total, nextChapter, goToChapter]);

  const flipPrev = useCallback(() => {
    if (page > 1) setPage((p) => p - 1);
    else if (prevChapter) goToChapter(prevChapter);
  }, [page, prevChapter, goToChapter]);

  // Keyboard: arrows page in paged mode (RTL swaps their meaning); Esc exits.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { navigate(`/manga/${anilistId}`); return; }
      if (mode !== 'paged') return;
      if (e.key === 'ArrowRight') rtl ? flipPrev() : flipNext();
      else if (e.key === 'ArrowLeft') rtl ? flipNext() : flipPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, rtl, flipNext, flipPrev, navigate, anilistId]);

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

  // --- render ------------------------------------------------------------------
  const header = (
    <div className={`sticky top-0 z-40 transition-transform duration-300 ${chromeHidden ? '-translate-y-full' : ''}`}>
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
            value={chapterId}
            onChange={(e) => navigate(`/read/${anilistId}/${encodeURIComponent(e.target.value)}`)}
            className="max-w-[8rem] sm:max-w-[12rem] text-[11px] font-bold bg-crimson-950/60 border border-crimson-900/60 rounded-lg text-crimson-200 px-2 py-1.5 focus:outline-none focus:border-crimson-600 truncate"
            aria-label="Jump to chapter"
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>{chapterLabel(ch)}</option>
            ))}
          </select>
        )}

        {mode === 'paged' && (
          <button onClick={toggleRtl} title={rtl ? 'Right-to-left (manga)' : 'Left-to-right'} className={`p-2 rounded-lg border transition-all shrink-0 ${rtl ? 'bg-crimson-600/20 border-crimson-500/50 text-crimson-300' : 'border-crimson-900/60 text-crimson-500 hover:text-white'}`} aria-label="Toggle reading direction">
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        )}
        <button onClick={toggleMode} title={mode === 'vertical' ? 'Vertical (webtoon)' : 'Paged'} className="p-2 rounded-lg border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 transition-all shrink-0" aria-label="Toggle reading mode">
          {mode === 'vertical' ? <Rows3 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      </div>

      {/* Slim page-progress bar */}
      {total > 0 && (
        <div className="h-0.5 bg-crimson-950">
          <div className="h-full bg-crimson-500 transition-all" style={{ width: `${(page / total) * 100}%` }} />
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-crimson-950">
        {header}
        <div className="max-w-md mx-auto my-32 p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-crimson-500 mx-auto" />
          <p className="text-crimson-300 font-bold">This chapter's pages could not be conjured.</p>
          <div className="flex items-center justify-center gap-3">
            {prevChapter && <button onClick={() => goToChapter(prevChapter)} className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500 hover:text-crimson-400">Previous</button>}
            {nextChapter && <button onClick={() => goToChapter(nextChapter)} className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500 hover:text-crimson-400">Next</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-crimson-950">
      {header}

      {pagesLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-8 h-8 text-crimson-500 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-crimson-600">Summoning pages</p>
        </div>
      ) : mode === 'vertical' ? (
        // --- Webtoon long-strip ---------------------------------------------
        <div className="max-w-3xl mx-auto pb-24" onClick={() => setChromeHidden((h) => !h)}>
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
        <div className="relative max-w-3xl mx-auto min-h-[70vh] flex items-center justify-center pb-24 select-none">
          {pages[page - 1] && (
            <img src={pages[page - 1]} alt={`Page ${page}`} className="max-h-[calc(100vh-8rem)] w-auto mx-auto" draggable={false} />
          )}

          {/* Tap zones: outer thirds flip pages (respecting RTL). */}
          <button className="absolute inset-y-0 left-0 w-1/3 cursor-pointer focus:outline-none" onClick={rtl ? flipNext : flipPrev} aria-label={rtl ? 'Next page' : 'Previous page'} />
          <button className="absolute inset-y-0 right-0 w-1/3 cursor-pointer focus:outline-none" onClick={rtl ? flipPrev : flipNext} aria-label={rtl ? 'Previous page' : 'Next page'} />

          {/* Explicit arrows (always LTR on screen; RTL only changes what they do) */}
          <button onClick={flipPrev} className="fixed left-2 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-crimson-950/70 border border-crimson-900/60 text-crimson-300 hover:text-white hover:border-crimson-600 transition-all" aria-label="Previous">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={flipNext} className="fixed right-2 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-crimson-950/70 border border-crimson-900/60 text-crimson-300 hover:text-white hover:border-crimson-600 transition-all" aria-label="Next">
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-crimson-950/80 border border-crimson-900/60 text-[11px] font-black tracking-widest text-crimson-300">
            {page} / {total}
          </div>
        </div>
      )}
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
