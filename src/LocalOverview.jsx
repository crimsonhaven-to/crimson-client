import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Play, Film, Tv, HardDrive, Calendar, Hash, ListVideo, AlertTriangle } from 'lucide-react';
import { useLocalOverview, useTitle, API_BASE_URL } from './hooks';
import { stripHtml } from './utils';

// Absolutize a poster path: local artwork comes back as a relative, signed
// /local_art path (served by the backend); a TMDB-enriched poster is already
// absolute. Everything else (null) falls through to a placeholder.
const posterSrc = (poster) =>
  poster ? (poster.startsWith('/') ? `${API_BASE_URL}${poster}` : poster) : null;

// Local media overview page (/local/:token). Renders one on-disk title from the
// backend's filesystem index: a movie (single Play) or a show (its episodes,
// grouped by season). Each playable file carries its own token, which the watch
// page (/watch-local/:fileToken) plays through the shared player. Unlike the anime/
// show overviews there is no TMDB waterfall — the whole payload arrives at once.
function LocalOverview() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { overview, loading, error } = useLocalOverview(token);
  useTitle(overview?.title || 'Local Media');

  const seasons = overview?.seasons || [];
  const [activeSeason, setActiveSeason] = useState(null);
  const currentSeason = activeSeason ?? seasons[0]?.season_number ?? null;
  const seasonData = useMemo(
    () => seasons.find((s) => s.season_number === currentSeason) || seasons[0],
    [seasons, currentSeason],
  );

  const backUrl = `/local/${token}`;
  const poster = posterSrc(overview?.poster);

  // Build a watch link for a file token, carrying the display title + a back link.
  const watchLink = (fileToken, label) =>
    `/watch-local/${fileToken}?title=${encodeURIComponent(label)}&back=${encodeURIComponent(backUrl)}` +
    (poster ? `&poster=${encodeURIComponent(poster)}` : '');

  if (loading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-24 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-xs">Reading the local vault…</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-24 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-crimson-50 uppercase">Vault Sealed</h2>
          <p className="text-crimson-300 mt-2">This local title could not be summoned{error ? `: ${error}` : '.'}</p>
          <Link to="/catalogue" className="inline-block mt-6 px-6 py-2 bg-crimson-500 hover:bg-crimson-400 text-white font-bold rounded-xl transition-all">
            Back to the Catalogue
          </Link>
        </div>
      </div>
    );
  }

  const isMovie = overview.media_kind === 'movie';
  const description = stripHtml(overview.description) || 'No summary recorded for this local title.';

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10 animate-in fade-in duration-700">
      <button
        onClick={() => navigate(-1)}
        className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 hover:bg-crimson-900/30 transition-all text-[11px] font-black uppercase tracking-widest backdrop-blur-sm"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-8">
        <div className="w-40 sm:w-56 shrink-0 mx-auto sm:mx-0">
          <div className="aspect-[2/3] rounded-3xl overflow-hidden bg-crimson-900/20 border border-crimson-900/50 shadow-2xl">
            {poster ? (
              <img src={poster} alt={`${overview.title} poster`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-crimson-800">
                {isMovie ? <Film className="w-10 h-10" /> : <Tv className="w-10 h-10" />}
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">No Sigil</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-grow space-y-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border bg-emerald-500/15 border-emerald-400/40 text-emerald-300">
              Local
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border bg-crimson-500/10 border-crimson-500/30 text-crimson-400 flex items-center gap-1.5">
              {isMovie ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />} {isMovie ? 'Movie' : 'Show'}
            </span>
            {overview.source_label && (
              <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border bg-crimson-950/60 border-crimson-900/60 text-crimson-500 flex items-center gap-1.5">
                <HardDrive className="w-3 h-3" /> {overview.source_label}
              </span>
            )}
            {!overview.has_metadata && (
              <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border bg-crimson-900/10 border-crimson-900/40 text-crimson-700" title="Identified from the filename (no on-disk metadata)">
                Filename-matched
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-crimson-50 leading-[1.05]">
            {overview.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-black uppercase tracking-widest text-crimson-600">
            {overview.year && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-crimson-500" /> {overview.year}</span>}
            {!isMovie && seasons.length > 0 && (
              <span className="flex items-center gap-1.5"><ListVideo className="w-3.5 h-3.5 text-crimson-500" /> {seasons.reduce((n, s) => n + (s.episodes?.length || 0), 0)} files</span>
            )}
            {overview.tmdb_id && <span className="flex items-center gap-1.5 opacity-70"><Hash className="w-3.5 h-3.5" /> TMDB {overview.tmdb_id}</span>}
          </div>

          {(overview.genres || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {overview.genres.map((g) => (
                <span key={g} className="px-3 py-1 rounded-lg bg-crimson-500/5 border border-crimson-500/20 text-[9px] font-black uppercase tracking-widest text-crimson-500/80">
                  {g}
                </span>
              ))}
            </div>
          )}

          <p className="text-sm sm:text-base text-crimson-100/60 leading-relaxed max-w-3xl font-medium">
            {description}
          </p>

          {isMovie && overview.play && (
            <Link
              to={watchLink(overview.play.id, overview.title)}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-crimson-600 hover:bg-crimson-500 text-white font-black uppercase tracking-widest text-sm transition-all shadow-[0_10px_30px_rgba(255,0,60,0.3)] active:scale-95"
            >
              <Play className="w-5 h-5 fill-white" /> Play
            </Link>
          )}
        </div>
      </div>

      {/* Episodes (shows) */}
      {!isMovie && seasons.length > 0 && (
        <div className="space-y-6">
          {seasons.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar p-4 bg-crimson-950/30 border border-crimson-900/30 rounded-3xl">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-crimson-700 pl-2 whitespace-nowrap">Seasons</span>
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  onClick={() => setActiveSeason(s.season_number)}
                  className={`px-5 py-2.5 rounded-xl text-[11px] font-black border transition-all whitespace-nowrap uppercase tracking-widest ${
                    (seasonData?.season_number === s.season_number)
                      ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.2)]'
                      : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-400 hover:border-crimson-600 hover:bg-crimson-900/30'
                  }`}
                >
                  Season {s.season_number}
                </button>
              ))}
            </div>
          )}

          <div className="p-6 sm:p-8 bg-crimson-950/30 border border-crimson-900/30 rounded-[2.5rem] space-y-6">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-black text-crimson-50 flex items-center gap-3 uppercase tracking-tighter">
                <ListVideo className="w-6 h-6 text-crimson-500" /> Episodes
              </h3>
              <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
              <span className="text-[10px] font-black uppercase tracking-widest text-crimson-600 whitespace-nowrap opacity-80">
                {seasonData?.episodes?.length || 0} files
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(seasonData?.episodes || []).map((ep) => (
                <Link
                  key={ep.id}
                  to={watchLink(
                    ep.id,
                    `${overview.title} · S${ep.season_number}E${ep.episode_number}${ep.title ? ` · ${ep.title}` : ''}`,
                  )}
                  className="group flex items-center gap-4 p-3.5 rounded-2xl border border-crimson-900/40 bg-crimson-950/30 hover:bg-crimson-900/20 hover:border-crimson-500/50 transition-all"
                >
                  <span className="shrink-0 grid place-items-center w-12 h-12 rounded-xl bg-crimson-900/40 text-crimson-400 font-black text-sm border border-crimson-800/50 group-hover:bg-crimson-600 group-hover:text-white transition-all">
                    {ep.episode_number}
                  </span>
                  <div className="flex flex-col min-w-0 flex-grow">
                    <span className="text-sm font-bold text-crimson-50 group-hover:text-crimson-400 transition-colors truncate">
                      {ep.title || `Episode ${ep.episode_number}`}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-crimson-700">
                      S{ep.season_number} · E{ep.episode_number}
                    </span>
                  </div>
                  <div className="p-2 rounded-full bg-crimson-900/30 group-hover:bg-crimson-500 transition-all shrink-0">
                    <Play className="w-4 h-4 text-crimson-800 group-hover:text-white fill-current transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isMovie && seasons.length === 0 && (
        <div className="py-16 text-center text-crimson-700 font-black uppercase tracking-widest text-xs">
          No playable files found in this title.
        </div>
      )}
    </div>
  );
}

export default LocalOverview;
