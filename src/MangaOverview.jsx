import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Star, Layers, PlayCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { useMangaOverview, useMangaResume, useTitle } from './hooks';
import { stripHtml } from './utils';
import WatchlistButton from './WatchlistButton';

// Manga overview page (/manga/:anilistId). The reading twin of ShowOverview, but
// with its own flat layout (a manga is one ordered run of chapters, no seasons),
// so it renders directly instead of reusing the video <OverviewView>. Chapters link
// into the reader (/read/:anilistId/:chapterId).
const STATUS_LABEL = {
  RELEASING: 'Ongoing', FINISHED: 'Completed', NOT_YET_RELEASED: 'Unreleased',
  CANCELLED: 'Cancelled', HIATUS: 'On Hiatus',
};

function ChapterRow({ anilistId, chapter, active }) {
  const number = chapter.chapter != null ? `Chapter ${chapter.chapter}` : 'Oneshot';
  const vol = chapter.volume != null ? `Vol. ${chapter.volume}` : null;
  return (
    <Link
      to={`/read/${anilistId}/${encodeURIComponent(chapter.id)}`}
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all group ${
        active
          ? 'bg-crimson-600/20 border-crimson-500/50'
          : 'bg-crimson-950/40 border-crimson-900/50 hover:border-crimson-600/60 hover:bg-crimson-900/30'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-black text-crimson-50 tracking-tight truncate">
          {number}
          {chapter.title ? <span className="text-crimson-400/70 font-bold"> · {chapter.title}</span> : null}
        </p>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600 mt-0.5">
          {vol ? `${vol} · ` : ''}{chapter.pages} pages
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-crimson-700 group-hover:text-crimson-400 group-hover:translate-x-1 transition-all shrink-0" />
    </Link>
  );
}

const MangaOverview = () => {
  const { anilistId } = useParams();
  const navigate = useNavigate();
  const { overview, loading, error } = useMangaOverview(anilistId);
  const resume = useMangaResume(anilistId);

  useTitle(overview?.title || 'Manga');

  const synopsis = useMemo(() => stripHtml(overview?.description || ''), [overview]);
  const chapters = overview?.chapters || [];

  // Resume points at a chapter ordinal (episode_number). Map it back to a chapter
  // id so "continue reading" jumps straight into the right chapter.
  const resumeChapter = resume && resume.episode_number
    ? chapters[resume.episode_number - 1] : null;
  const firstChapter = chapters[0];

  const watchlistItem = overview
    ? { anilist_id: Number(anilistId), media_type: 'manga', title: overview.title, poster: overview.poster }
    : undefined;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-5">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
          <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-crimson-600 animate-pulse">Unsealing the tome</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="max-w-md mx-auto my-32 p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-crimson-500 mx-auto" />
        <p className="text-crimson-300 font-bold">This tome could not be summoned from the archives.</p>
        <button onClick={() => navigate(-1)} className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500 hover:text-crimson-400">Go Back</button>
      </div>
    );
  }

  const rating = overview.average_score ? (overview.average_score / 10).toFixed(1) : null;

  return (
    <div className="relative min-h-screen animate-in fade-in duration-700">
      {/* Banner */}
      {overview.banner && (
        <div className="absolute inset-x-0 top-0 h-72 sm:h-96 overflow-hidden -z-0">
          <img src={overview.banner} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-crimson-950/40 via-crimson-950/80 to-crimson-950"></div>
        </div>
      )}

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-crimson-400 hover:text-crimson-200 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
          {/* Cover */}
          <div className="shrink-0 mx-auto sm:mx-0">
            {overview.poster ? (
              <img src={overview.poster} alt={`${overview.title} cover`} className="w-44 sm:w-52 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-crimson-900/50" />
            ) : (
              <div className="w-44 sm:w-52 h-64 sm:h-72 rounded-2xl bg-crimson-900/30 flex items-center justify-center text-crimson-600 text-xs font-black uppercase">No Cover</div>
            )}
          </div>

          {/* Meta */}
          <div className="min-w-0 flex-grow space-y-4">
            <div>
              <span className="inline-block text-[9px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-md bg-crimson-500/10 border border-crimson-500/25 text-crimson-400 mb-3">
                Manga
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-crimson-50 leading-tight">{overview.title}</h1>
              {overview.title_native && overview.title_native !== overview.title && (
                <p className="text-crimson-400/70 font-bold mt-1 text-sm">{overview.title_native}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-black uppercase tracking-widest">
              {STATUS_LABEL[overview.status] && (
                <span className="px-2.5 py-1 rounded-lg bg-crimson-950/50 border border-crimson-900/60 text-crimson-300">{STATUS_LABEL[overview.status]}</span>
              )}
              {overview.chapters_total && (
                <span className="px-2.5 py-1 rounded-lg bg-crimson-950/50 border border-crimson-900/60 text-crimson-300 inline-flex items-center gap-1.5">
                  <Layers className="w-3 h-3" /> {overview.chapters_total} ch
                </span>
              )}
              {overview.start_date?.year && (
                <span className="px-2.5 py-1 rounded-lg bg-crimson-950/50 border border-crimson-900/60 text-crimson-300">{overview.start_date.year}</span>
              )}
              {rating && (
                <span className="px-2.5 py-1 rounded-lg bg-crimson-950/50 border border-crimson-900/60 text-crimson-200 inline-flex items-center gap-1.5">
                  <Star className="w-3 h-3 fill-crimson-400 text-crimson-400" /> {rating}
                </span>
              )}
            </div>

            {overview.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {overview.genres.slice(0, 6).map(g => (
                  <span key={g} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-crimson-900/30 border border-crimson-800/40 text-crimson-400">{g}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {resumeChapter ? (
                <Link
                  to={`/read/${anilistId}/${encodeURIComponent(resumeChapter.id)}`}
                  className="inline-flex items-center gap-3 font-black uppercase tracking-[0.2em] text-xs px-7 py-4 rounded-2xl bg-crimson-600 border border-crimson-400 text-white shadow-[0_15px_30px_rgba(255,0,60,0.3)] hover:bg-crimson-500 transition-all active:scale-95"
                >
                  <PlayCircle className="w-4 h-4" />
                  Continue Ch. {resumeChapter.chapter ?? resume.episode_number}
                </Link>
              ) : firstChapter ? (
                <Link
                  to={`/read/${anilistId}/${encodeURIComponent(firstChapter.id)}`}
                  className="inline-flex items-center gap-3 font-black uppercase tracking-[0.2em] text-xs px-7 py-4 rounded-2xl bg-crimson-600 border border-crimson-400 text-white shadow-[0_15px_30px_rgba(255,0,60,0.3)] hover:bg-crimson-500 transition-all active:scale-95"
                >
                  <BookOpen className="w-4 h-4" /> Start Reading
                </Link>
              ) : null}
              <WatchlistButton item={watchlistItem} variant="overview" />
            </div>
          </div>
        </div>

        {/* Synopsis */}
        {synopsis && (
          <div className="mt-10 max-w-3xl">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-crimson-500 mb-3">Synopsis</h2>
            <p className="text-sm sm:text-base text-crimson-100/70 leading-relaxed font-medium">{synopsis}</p>
          </div>
        )}

        {/* Chapters */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black tracking-tighter text-crimson-50 uppercase flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-crimson-500" /> Chapters
            </h2>
            {chapters.length > 0 && (
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600">{chapters.length} available</span>
            )}
          </div>

          {chapters.length === 0 ? (
            <div className="p-8 rounded-2xl bg-crimson-950/40 border border-dashed border-crimson-900/60 text-center">
              <p className="text-sm text-crimson-400 font-bold">
                {overview.mapped
                  ? 'No readable chapters found in this language yet.'
                  : 'No reading source is bound to this tome yet, darling.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {chapters.map((ch, i) => (
                <ChapterRow
                  key={ch.id}
                  anilistId={anilistId}
                  chapter={ch}
                  active={resumeChapter ? String(ch.id) === String(resumeChapter.id) : i === 0 && !resume}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MangaOverview;
