import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, ChevronDown, ArrowLeft, CalendarClock, Layers, Puzzle, X, RefreshCw, Film, Calendar, Play, ListVideo } from 'lucide-react';
import { API_BASE_URL, apiFetch, fetchSubtitles, fetchSkipTimes, usePlaybackPrefs, groupStreams, streamVariantLabel } from './hooks';
import { setWatchActivity, clearWatchActivity } from './discordPresence';
import { stripHtml } from './utils';
import WatchlistButton from './WatchlistButton';

const CrimsonPlayer = lazy(() => import('./CrimsonPlayer'));

// How many seconds of playback before we tell the backend "the viewer actually
// watched this source" so it may cache it. Keeps the fastest-resolving source
// from being cached over the one the viewer settled on (quality / language).
const CACHE_CONFIRM_SECONDS = 10;

// Format a TMDB air date ('YYYY-MM-DD') as a readable day, e.g. "Jul 1, 2026".
// Falls back to the raw string if it can't be parsed.
const formatAirDate = (iso) => {
  if (!iso) return '';
  const t = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// A single selectable source button (one resolved stream). `label` is what shows
// as the name — the full source for a standalone tile, or the in-group variant
// ("MovieBox (1080p)") when rendered inside an expanded group (`nested`).
const StreamTile = ({ stream, label, active, nested = false, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
      nested ? 'p-3' : 'p-4'
    } ${
      active
        ? 'bg-crimson-600 text-white font-black border-crimson-400 shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
        : 'bg-crimson-950/60 text-crimson-300 border-crimson-900/60 hover:bg-crimson-900/20 hover:border-crimson-600'
    }`}
  >
    <div className="flex flex-col min-w-0 pr-4">
      <div className="flex items-center gap-2 mb-1.5 leading-none">
        <span className={`text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md border ${
          active ? 'bg-white/20 border-white/20 text-crimson-50' : 'bg-crimson-500/10 border-crimson-500/20 text-crimson-500'
        }`}>
          {stream.type}
        </span>
        {stream.language && (
          <span className={`text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md ${
            active ? 'bg-crimson-950/40 text-crimson-50' : 'bg-crimson-900 text-crimson-400'
          }`}>
            {stream.language}
          </span>
        )}
      </div>
      <span className={`font-black tracking-wide text-crimson-50 truncate ${nested ? 'text-[11px]' : 'text-xs'}`}>
        {label}
      </span>
    </div>
    <ChevronRight className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${active ? 'text-crimson-50' : 'text-crimson-800'}`} />
  </button>
);

// A grouped provider (ScreenScape, Cinema.bz, …) rendered as a literally-stacked
// card: two offset "ghost" cards peek out behind the header so it reads as a deck
// of sources collapsed into one. Click expands the deck into its member tiles.
// `containsActive` keeps the deck looking selected when the playing source is one
// of its members; `open` reveals the members.
const SourceGroup = ({ group, activeStreamIdx, onSelectStream, open, onToggle }) => {
  const containsActive = group.items.some((it) => it.idx === activeStreamIdx);
  const count = group.items.length;
  return (
    <div className={`relative ${!open ? 'mb-2' : ''}`}>
      {/* Stacked "deck" ghosts behind the header — only while collapsed. */}
      {!open && (
        <>
          <div className="absolute -bottom-1.5 inset-x-3 h-full rounded-2xl bg-crimson-950/40 border border-crimson-900/40" />
          <div className="absolute -bottom-3 inset-x-6 h-full rounded-2xl bg-crimson-950/25 border border-crimson-900/30" />
        </>
      )}
      <button
        onClick={onToggle}
        className={`relative w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
          containsActive
            ? 'bg-crimson-600/90 text-crimson-50 border-crimson-400 shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
            : 'bg-crimson-950/70 text-crimson-300 border-crimson-900/60 hover:bg-crimson-900/20 hover:border-crimson-600'
        }`}
      >
        <div className="flex flex-col min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1.5 leading-none">
            <span className={`flex items-center gap-1 text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md border ${
              containsActive ? 'bg-white/20 border-white/20 text-crimson-50' : 'bg-crimson-500/10 border-crimson-500/20 text-crimson-500'
            }`}>
              <Layers className="w-2.5 h-2.5" /> {count} sources
            </span>
          </div>
          <span className="text-xs font-black tracking-wide text-crimson-50 truncate">{group.label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''} ${containsActive ? 'text-crimson-50' : 'text-crimson-700'}`} />
      </button>
      {open && (
        <div className="mt-2 pl-3 ml-1.5 border-l border-crimson-900/50 space-y-2 animate-in slide-in-from-top-1 fade-in duration-300">
          {group.items.map(({ stream, idx }) => (
            <StreamTile
              key={idx}
              stream={stream}
              label={streamVariantLabel(stream)}
              active={activeStreamIdx === idx}
              nested
              onClick={() => onSelectStream(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// One rich episode card for the below-player picker — TMDB still, name, air date
// and summary, mirroring the overview's EpisodeCard so the two surfaces read as
// one system. `active` marks the episode currently on screen (a pulsing "Now"
// crest + a crimson-lit frame) so the viewer never loses their place.
const PickerEpisodeCard = ({ ep, active, onSelect }) => {
  const hasTitle = ep.title && ep.title !== `Episode ${ep.episode_number}`;
  return (
    <button
      onClick={onSelect}
      className={`group flex gap-3 sm:gap-4 text-left p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 ${
        active
          ? 'bg-crimson-600/15 border-crimson-500/60 shadow-[0_0_25px_rgba(255,0,60,0.15)]'
          : 'bg-crimson-950/30 border-crimson-900/40 hover:bg-crimson-900/20 hover:border-crimson-500/50 hover:shadow-[0_0_20px_rgba(255,0,60,0.1)]'
      }`}
    >
      <div className="relative w-32 sm:w-44 aspect-video flex-shrink-0 rounded-xl overflow-hidden bg-crimson-900/40 shadow-inner">
        {ep.thumbnail ? (
          <img src={ep.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-crimson-800"><Film className="w-8 h-8 opacity-20" /></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-crimson-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="bg-crimson-500 p-2.5 rounded-full shadow-[0_0_15px_rgba(255,0,60,0.5)] transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
        <span className="absolute top-2 left-2 bg-crimson-950/90 text-crimson-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-crimson-800/50 backdrop-blur-md">
          E{ep.episode_number}
        </span>
        {active && (
          <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-crimson-600 text-[8px] font-black uppercase tracking-widest text-white shadow-[0_0_10px_rgba(255,0,60,0.6)]">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> Now
          </span>
        )}
      </div>
      <div className="flex flex-col min-w-0 py-1">
        <h4 className={`text-sm sm:text-base font-bold transition-colors line-clamp-1 tracking-tight ${active ? 'text-crimson-300' : 'text-crimson-50 group-hover:text-crimson-400'}`}>
          {hasTitle ? ep.title : `Episode ${ep.episode_number}`}
        </h4>
        {ep.air_date && (
          <span className="flex items-center gap-1 text-[10px] text-crimson-600 font-black uppercase tracking-widest mt-1 opacity-80">
            <Calendar className="w-3 h-3" /> {ep.air_date}
          </span>
        )}
        {ep.overview && (
          <p className="text-xs text-crimson-200/50 leading-relaxed line-clamp-2 mt-2 font-medium">{ep.overview}</p>
        )}
      </div>
    </button>
  );
};

// Presentational watch UI shared by the anime watch page (/watch/:anilistId/...)
// and the non-anime show watch page (/watch-show/:tmdbId/...). Both feed it the
// same prop shape; only the data source (useAnimeStreamer vs useShowStreamer) and
// the navigation targets (back link, season/episode handlers) differ in the thin
// wrappers. Extracted from the original WatchPage so anime renders unchanged.
const WatchView = ({
  // playback / sources
  streams = [], streamLoading, activeStreamIdx, onSelectStream, onReload,
  unaired,
  poster, playerStartAt, onPlayerProgress,
  // header / info
  metadata, displayTitle, totalSeasons,
  currentSeason, currentEpisode, refLabel,
  // selectors
  availableSeasons = [], onEpisodeChange,
  // Cross-season episode jump: navigate straight to {season, episode} in one hop
  // (onEpisodeChange only moves within the current season). The season chips and
  // both pickers browse via this + onEpisodeChange; onSeasonChange is no longer
  // needed here (the wrappers still pass it — harmlessly ignored).
  onSelectEpisode,
  // account
  isAuthenticated, watchlistItem,
  // nav
  backUrl,
  // Movie mode (additive): hide the season/episode stat boxes + selectors and
  // drop the SxEx from the download name. TV/anime render unchanged (default false).
  isMovie = false,
}) => {
  // Memoized so its identity is stable across renders — it feeds a useEffect dep
  // array (the picker's season seed), which would otherwise re-run every render.
  const episodesList = useMemo(() => metadata?.episodes_list || [], [metadata]);
  const currentEpisodeData = episodesList.find(e => e.episode_number === currentEpisode);
  const episodeTitle = currentEpisodeData?.title && currentEpisodeData.title !== `Episode ${currentEpisode}`
    ? currentEpisodeData.title
    : null;

  // Auto-Next wiring: the episode that follows the current one (same season), used
  // to drive the player's opt-in "play next when this ends" feature. Movies and a
  // missing/last episode leave this null, so the player simply won't offer it.
  const currentEpisodeIdx = episodesList.findIndex(e => e.episode_number === currentEpisode);
  const nextEpisodeData = !isMovie && currentEpisodeIdx >= 0 ? episodesList[currentEpisodeIdx + 1] : null;
  const goToNextEpisode = useCallback(() => {
    if (nextEpisodeData) onEpisodeChange(nextEpisodeData.episode_number);
  }, [nextEpisodeData, onEpisodeChange]);
  const nextEpisodeLabel = nextEpisodeData
    ? (nextEpisodeData.title && nextEpisodeData.title !== `Episode ${nextEpisodeData.episode_number}`
        ? `E${nextEpisodeData.episode_number} · ${nextEpisodeData.title}`
        : `Episode ${nextEpisodeData.episode_number}`)
    : '';
  const episodeDescription = currentEpisodeData?.overview
    || metadata?.summary
    || stripHtml(metadata?.description)
    || 'No summary asset provided.';

  const activeStream = !streamLoading ? streams[activeStreamIdx] : null;

  // --- In-player Season / Episode picker -----------------------------------
  // The player embeds a full season→episode browser (with TMDB stills) so the
  // viewer can hop episodes without leaving the video — crucially, it works in
  // fullscreen, unlike the selectors rendered below the player. Browsing a
  // season the viewer isn't watching needs that season's episode list, so we
  // fetch it lazily the first time the season is expanded and cache it. The
  // reused endpoint (/info/{tmdb_id}?season={tmdb_season}) is the exact call the
  // overview pages already make, and both surfaces carry {tmdb_id, tmdb_season}
  // per season, so this works for anime and shows alike. The playing season is
  // seeded straight from the metadata already loaded — no extra request.
  const [pickerSeason, setPickerSeason] = useState(currentSeason);
  const [seasonEpisodes, setSeasonEpisodes] = useState({}); // season_number -> episodes[]
  const [pickerLoading, setPickerLoading] = useState(false);

  // Follow whatever's playing: when the season changes, expand it in the picker.
  useEffect(() => { setPickerSeason(currentSeason); }, [currentSeason]);

  // Seed the playing season from the episode list we already have in metadata.
  useEffect(() => {
    if (episodesList.length) setSeasonEpisodes((m) => ({ ...m, [currentSeason]: episodesList }));
  }, [currentSeason, episodesList]);

  // Lazily resolve the expanded season's episodes the first time it's opened.
  useEffect(() => {
    if (isMovie || pickerSeason == null || seasonEpisodes[pickerSeason]) return undefined;
    const season = availableSeasons.find((s) => s.season_number === pickerSeason);
    if (!season?.tmdb_id) return undefined;
    let cancelled = false;
    setPickerLoading(true);
    apiFetch(`/info/${season.tmdb_id}?season=${season.tmdb_season}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = Array.isArray(data.episodes_list) ? data.episodes_list : [];
        setSeasonEpisodes((m) => ({ ...m, [pickerSeason]: list }));
      })
      .catch(() => { /* best-effort — the panel shows an empty state on failure */ })
      .finally(() => { if (!cancelled) setPickerLoading(false); });
    return () => { cancelled = true; };
  }, [isMovie, pickerSeason, availableSeasons, seasonEpisodes]);

  // Jump to an episode from the picker: stay in-season via onEpisodeChange, or
  // hop seasons via onSelectEpisode when the wrapper provides it (falls back to
  // an in-season change so a missing prop never dead-ends a click).
  const handlePickEpisode = useCallback((seasonNumber, episodeNumber) => {
    if (seasonNumber === currentSeason) onEpisodeChange?.(episodeNumber);
    else if (onSelectEpisode) onSelectEpisode(seasonNumber, episodeNumber);
    else onEpisodeChange?.(episodeNumber);
  }, [currentSeason, onEpisodeChange, onSelectEpisode]);

  // The bundle handed to the player. Null for movies (single feature) and when
  // there's nothing to browse, so the player simply won't render the button.
  const episodePicker = !isMovie && (availableSeasons.length > 0 || episodesList.length > 0)
    ? {
        seasons: availableSeasons,
        currentSeason,
        currentEpisode,
        expandedSeason: pickerSeason,
        onExpandSeason: setPickerSeason,
        episodes: seasonEpisodes[pickerSeason] || [],
        episodesLoading: pickerLoading && !seasonEpisodes[pickerSeason],
        onSelectEpisode: handlePickEpisode,
      }
    : null;

  // TMDB id of the title — the key several things below hang off of (sticky source
  // pref, OpenSubtitles fetch, cache scoping). Declared up here so the sticky-source
  // block can use it without tripping a temporal-dead-zone ReferenceError.
  const tmdbId = metadata?.tmdb_id;

  // --- source selection + report-broken ------------------------------------
  // Manual selection just forwards to the streamer hook, which pins the pick for
  // the current episode (its userPicked guard stops the preference auto-select
  // from switching the stream out under the viewer). The pick is intentionally
  // NOT persisted across episodes/reloads — every fresh load re-ranks purely on
  // the viewer's language/dub-sub preference (see streamRank), which is the whole
  // point of auto-select. So this is now a thin passthrough.
  const handleSelectStream = useCallback((idx) => {
    onSelectStream?.(idx);
  }, [onSelectStream]);

  // Report a source as broken: anonymously beacon the failure (feeds the admin
  // Client Resolve Stats) and fail over to the next source if there is one.
  const handleReportBroken = useCallback((idx) => {
    const s = streams[idx];
    if (s?.source) {
      try {
        apiFetch('/telemetry/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: [{ source: s.source, ok: false, env: 'report' }] }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* never let a report affect playback */ }
    }
    if (streams.length > 1) handleSelectStream((idx + 1) % streams.length);
  }, [streams, handleSelectStream]);

  // Contextual companion nudge: shown in the sources panel once scanning finishes
  // and the companion isn't active — the moment of need (more sources resolve
  // locally with it). Mirrors the home banner's detection + shares its dismiss key
  // so dismissing in either place hides both; never shown for an unaired episode.
  const EXT_DISMISS_KEY = 'crimson:extBanner:dismissed';
  const [companionActive, setCompanionActive] = useState(() => {
    try { return !!window.CrimsonExtension?.available; } catch { return false; }
  });
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return localStorage.getItem(EXT_DISMISS_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (companionActive) return undefined;
    const onReady = () => setCompanionActive(true);
    window.addEventListener('crimson-extension-ready', onReady, { once: true });
    const t = setTimeout(() => {
      try { if (window.CrimsonExtension?.available) setCompanionActive(true); } catch { /* ignore */ }
    }, 500);
    return () => { window.removeEventListener('crimson-extension-ready', onReady); clearTimeout(t); };
  }, [companionActive]);
  const dismissNudge = useCallback(() => {
    try { localStorage.setItem(EXT_DISMISS_KEY, '1'); } catch { /* ignore */ }
    setNudgeDismissed(true);
  }, []);
  const showCompanionNudge = !unaired && !streamLoading && !companionActive && !nudgeDismissed;

  // Provider-grouped view of the sources for the "Scraped Targets" sidebar (and
  // the in-player cog). `openGroups` holds explicit expand/collapse choices; a
  // group with no explicit choice defaults to open iff it holds the active source.
  const sourceGroups = useMemo(() => groupStreams(streams), [streams]);
  const [openGroups, setOpenGroups] = useState({});

  // External OpenSubtitles tracks (additive). These are title-level — keyed off the
  // TMDB id + season/episode, independent of which source plays — so they're
  // fetched here and merged into whatever subtitles the active source already
  // ships (ShowBox/Febbox). Off entirely unless the viewer has picked subtitle
  // languages in their preferences. `metadata.current_season` is the real TMDB
  // season /info resolved (anime season groups aren't 1:1 with TMDB seasons).
  const [prefs] = usePlaybackPrefs();
  const subLangs = prefs.subtitleLanguages || [];
  const subLangKey = subLangs.join(',');
  const tmdbSeason = metadata?.current_season ?? currentSeason;
  const [openSubs, setOpenSubs] = useState([]);

  useEffect(() => {
    setOpenSubs([]);
    if (!tmdbId || !subLangs.length) return undefined;
    let cancelled = false;
    fetchSubtitles({
      tmdbId,
      season: isMovie ? null : tmdbSeason,
      episode: isMovie ? null : currentEpisode,
      isMovie,
      languages: subLangs,
    }).then((tracks) => { if (!cancelled) setOpenSubs(tracks); });
    return () => { cancelled = true; };
    // subLangKey stands in for the array identity so we don't refetch each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, tmdbSeason, currentEpisode, isMovie, subLangKey]);

  // AniSkip intro/outro timestamps (additive, anime-only). Keyed off the AniList id
  // /info resolved, so non-anime shows (no `anilist_id`) and movies simply skip the
  // fetch and the player shows no skip affordances.
  //
  // Re-fetched per episode AND per active source, feeding AniSkip the *measured*
  // file duration. AniSkip stores each submission against the episode length it was
  // timed on and returns the window for the closest length — so the SAME episode has
  // different OP/ED offsets across encodes (e.g. a source with a recap or trimmed
  // intro shifts the intro by tens of seconds). Fetching with length 0 pins us to
  // one arbitrary submission, which only lines up with whichever encode it came from
  // — the reason skip worked for backend-proxied sources but missed for the client
  // engine's extension/proxy sources (different providers, different lengths). Giving
  // AniSkip the real duration makes it return the window for the encode on screen.
  const anilistId = metadata?.anilist_id;
  const [skipTimes, setSkipTimes] = useState(null);
  // Duration of the file actually playing, reported by the player. Reset per
  // episode/source so each is re-measured (0 = not measured yet → a best-effort
  // first fetch that gets refined the moment the player reports its duration).
  const [playerDuration, setPlayerDuration] = useState(0);
  const activeStreamUrl = activeStream?.url;
  useEffect(() => {
    setSkipTimes(null);
    setPlayerDuration(0);
  }, [anilistId, activeStreamUrl, currentEpisode]);
  // Round so sub-second `timeupdate` jitter doesn't re-fire the fetch.
  const roundedDuration = Math.round(playerDuration) || 0;
  useEffect(() => {
    if (isMovie || !anilistId || !currentEpisode) return undefined;
    let cancelled = false;
    fetchSkipTimes({ anilistId, episode: currentEpisode, episodeLength: roundedDuration })
      .then((st) => { if (!cancelled) setSkipTimes(st); });
    return () => { cancelled = true; };
  }, [anilistId, currentEpisode, isMovie, roundedDuration]);

  // Merge source-supplied tracks with the OpenSubtitles ones, de-duping by URL so a
  // source that already provides a language doesn't double up.
  const mergedSubtitles = useMemo(() => {
    const base = Array.isArray(activeStream?.subtitles) ? activeStream.subtitles : [];
    const seen = new Set(base.map((s) => s?.url));
    return [...base, ...openSubs.filter((s) => s && !seen.has(s.url))];
  }, [activeStream, openSubs]);

  // Broadcast a Discord Rich Presence for whatever's on screen (opt-in; see
  // discordPresence.js). Covers anime, shows and movies since all three render
  // through this view. Re-runs per episode/season so the "elapsed" timer resets,
  // and clears on unmount so leaving the page drops back to the browsing presence.
  useEffect(() => {
    if (!displayTitle) return undefined;
    setWatchActivity({
      title: displayTitle,
      isMovie,
      season: currentSeason,
      episode: currentEpisode,
      totalSeasons,
      startedAt: Date.now(),
    });
    return () => clearWatchActivity();
  }, [displayTitle, isMovie, currentSeason, currentEpisode, totalSeasons]);

  // Server-side cache trigger: once the viewer has watched the *active* source for
  // CACHE_CONFIRM_SECONDS, redeem its signed cacheTicket exactly once so the
  // backend caches that source (not whichever resolved first). Tickets already
  // confirmed are remembered so source-switching / re-renders don't re-POST.
  const confirmedTicketsRef = useRef(new Set());
  const handlePlayerProgress = useCallback((position, duration) => {
    if (onPlayerProgress) onPlayerProgress(position, duration);
    // Feed the real file duration to the AniSkip fetch above (only when the rounded
    // value actually changes, so this doesn't thrash on every timeupdate). This is
    // what lets the skip windows align to the source that's actually playing.
    if (duration && Number.isFinite(duration)) {
      setPlayerDuration((prev) => (Math.round(prev) === Math.round(duration) ? prev : duration));
    }
    const ticket = activeStream?.cacheTicket;
    if (!ticket || position < CACHE_CONFIRM_SECONDS) return;
    if (confirmedTicketsRef.current.has(ticket)) return;
    confirmedTicketsRef.current.add(ticket);
    // Fire-and-forget; on failure drop it so a later progress tick can retry.
    apiFetch('/cache/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    }).catch(() => confirmedTicketsRef.current.delete(ticket));
  }, [onPlayerProgress, activeStream]);

  // Filename for the in-player Download button, e.g.
  // "Frieren - S1E04 - The Land Where Souls Rest". Season is only stamped when
  // the title actually has more than one.
  const downloadName = isMovie
    ? (displayTitle || 'video')
    : [
        displayTitle || 'video',
        totalSeasons > 1 ? `S${currentSeason}E${currentEpisode}` : `E${currentEpisode}`,
        episodeTitle,
      ].filter(Boolean).join(' - ');

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-4 gap-8 sm:gap-10 animate-in fade-in duration-1000">
      {/* Main Video Area */}
      <div className="lg:col-span-3 space-y-8">
        {/* Back to the title's overview page */}
        <Link
          to={backUrl}
          className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 hover:bg-crimson-900/30 transition-all duration-300 text-[11px] font-black uppercase tracking-widest active:scale-95 backdrop-blur-sm shadow-xl"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
          Back to Overview
        </Link>
        <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-crimson-900/60 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
          {streamLoading && !unaired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 z-20 p-6 text-center backdrop-blur-md">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
                <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 blur-xl bg-crimson-500/20 rounded-full animate-pulse"></div>
              </div>
              <p className="text-crimson-400 font-black tracking-[0.3em] animate-pulse text-xs uppercase">Resolving manifest vectors</p>
            </div>
          )}
          {unaired ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-crimson-950/70 backdrop-blur-sm">
              <CalendarClock className="w-16 h-16 text-crimson-500 mb-5 opacity-70" />
              <p className="text-crimson-50 font-black uppercase tracking-[0.2em] text-base sm:text-lg">Not Yet Manifested</p>
              <p className="text-crimson-300/80 mt-3 max-w-md font-medium text-sm leading-relaxed">
                This segment hasn't crossed into our dimension yet.
                {unaired.airDate && (
                  <> It materialises <span className="text-crimson-400 font-black">{formatAirDate(unaired.airDate)}</span>.</>
                )}
              </p>
            </div>
          ) : activeStream ? (
            activeStream.type === 'iframe' ? (
              (() => {
                const url = activeStream.url;
                // Sandbox iframes we host ourselves (the backend player page, or
                // anything served from our own origin) — those are trusted, so we
                // grant the looser sandbox; third-party embeds get none.
                const sandboxed = typeof url === 'string'
                  && (url.startsWith(API_BASE_URL) || url.startsWith(window.location.origin));
                return (
                  <iframe
                    src={url}
                    title="Stream"
                    className="w-full h-full"
                    sandbox={sandboxed ? "allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock" : undefined}
                    allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                    referrerPolicy="no-referrer"
                    allowFullScreen
                    scrolling="no"
                  />
                );
              })()
            ) : (
              <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
                <CrimsonPlayer
                  key={activeStream.url}
                  src={activeStream.url}
                  type={activeStream.type}
                  subtitles={mergedSubtitles}
                  poster={poster}
                  title={displayTitle}
                  downloadName={downloadName}
                  startAt={playerStartAt}
                  onProgress={handlePlayerProgress}
                  onNext={isMovie ? undefined : goToNextEpisode}
                  hasNext={!!nextEpisodeData}
                  nextLabel={nextEpisodeLabel}
                  skipTimes={skipTimes}
                  sources={streams}
                  activeSourceIdx={activeStreamIdx}
                  onSelectSource={handleSelectStream}
                  onReportBroken={handleReportBroken}
                  episodePicker={episodePicker}
                />
              </Suspense>
            )
          ) : (
            !streamLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-crimson-950/50 backdrop-blur-sm">
                <AlertTriangle className="w-16 h-16 text-crimson-500 mb-4 opacity-50" />
                <p className="text-crimson-50 font-black uppercase tracking-widest text-sm">No transport nodes active</p>
              </div>
            )
          )}
        </div>

        {/* Info Panel */}
        <div className="p-6 sm:p-10 bg-crimson-950/40 border border-crimson-900/40 rounded-[2.5rem] backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 relative z-10">
            <div className="space-y-6 w-full">
              <div className="flex flex-wrap gap-3 items-center">
                {metadata?.status && (
                  <span className="bg-crimson-500/10 text-crimson-400 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-crimson-500/30 backdrop-blur-md">
                    {metadata.status}
                  </span>
                )}
                <span className="text-[10px] text-crimson-600 font-black tracking-widest uppercase opacity-70">
                  REF: {refLabel || 'UNK'}
                </span>
                {isAuthenticated && watchlistItem && (
                  <div className="ml-auto">
                    <WatchlistButton item={watchlistItem} variant="watch" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-crimson-50 leading-[1.1]">
                  {displayTitle || 'Unknown Cluster'}
                  {totalSeasons > 1 && (
                    <span className="text-xl text-crimson-500 ml-3 opacity-80">S{currentSeason}</span>
                  )}
                </h1>
                {episodeTitle && (
                  <p className="text-base sm:text-xl font-bold text-crimson-400 tracking-tight leading-snug">
                    <span className="text-crimson-600 font-black uppercase text-sm mr-2 opacity-60">E{currentEpisode}</span> {episodeTitle}
                  </p>
                )}
              </div>
              <p className="text-sm sm:text-base text-crimson-100/60 leading-relaxed text-justify line-clamp-4 sm:line-clamp-none font-medium">
                {episodeDescription}
              </p>
            </div>
            {!isMovie && (
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:flex-none bg-crimson-950/80 border border-crimson-900/60 px-6 py-4 rounded-2xl text-center min-w-[90px] shadow-xl">
                  <p className="text-[10px] uppercase text-crimson-500 font-black tracking-[0.3em] mb-1">SN</p>
                  <p className="text-2xl font-black text-crimson-50">{currentSeason}</p>
                </div>
                <div className="flex-1 sm:flex-none bg-crimson-900/20 border border-crimson-800/40 px-6 py-4 rounded-2xl text-center min-w-[90px] shadow-xl">
                  <p className="text-[10px] uppercase text-crimson-400 font-black tracking-[0.3em] mb-1">EP</p>
                  <p className="text-2xl font-black text-crimson-50">{currentEpisode}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Season & Episode picker (hidden for movies — single feature). Browse
            any season's episodes in-place — TMDB stills, names, air dates and
            summaries — mirroring the in-player overlay, so both read as one
            system. Season chips BROWSE (not navigate); the episode card is what
            commits, jumping across seasons in a single hop when needed. */}
        {!isMovie && episodePicker && (
        <div className="space-y-6">
          {episodePicker.seasons.length > 1 && (
            <div className="p-4 sm:p-5 bg-crimson-950/30 border border-crimson-900/30 rounded-3xl flex items-center gap-4 overflow-x-auto no-scrollbar backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase text-crimson-700 tracking-[0.3em] whitespace-nowrap pl-2">Archives</span>
              <div className="flex gap-2">
                {episodePicker.seasons.map((season) => {
                  const active = episodePicker.expandedSeason === season.season_number;
                  const playing = episodePicker.currentSeason === season.season_number;
                  return (
                    <button
                      key={season.season_number}
                      onClick={() => episodePicker.onExpandSeason(season.season_number)}
                      className={`px-5 py-2.5 rounded-xl text-[11px] font-black border transition-all duration-300 whitespace-nowrap uppercase tracking-widest ${
                        active
                          ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.2)]'
                          : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-400 hover:border-crimson-600 hover:bg-crimson-900/30'
                      }`}
                    >
                      Season {season.season_number}
                      {playing && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-crimson-300 shadow-[0_0_6px_#ff003c] align-middle" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-6 sm:p-10 bg-crimson-950/30 border border-crimson-900/30 rounded-[2.5rem] space-y-8 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-black text-crimson-50 flex items-center gap-3 uppercase tracking-tighter whitespace-nowrap">
                <ListVideo className="w-6 h-6 text-crimson-500" /> Manifest Segments
                {episodePicker.seasons.length > 1 && (
                  <span className="text-[11px] font-black uppercase tracking-widest text-crimson-600 opacity-80">· Season {episodePicker.expandedSeason}</span>
                )}
              </h3>
              <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
              {!episodePicker.episodesLoading && episodePicker.episodes.length > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-crimson-600 whitespace-nowrap opacity-80">
                  <Film className="w-3 h-3" /> {episodePicker.episodes.length} segments
                </span>
              )}
            </div>

            {episodePicker.episodesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-28 bg-crimson-950/40 animate-pulse rounded-2xl border border-crimson-900/30" />
                ))}
              </div>
            ) : episodePicker.episodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {episodePicker.episodes.map((ep) => (
                  <PickerEpisodeCard
                    key={ep.episode_number}
                    ep={ep}
                    active={episodePicker.expandedSeason === episodePicker.currentSeason && ep.episode_number === episodePicker.currentEpisode}
                    onSelect={() => episodePicker.onSelectEpisode(episodePicker.expandedSeason, ep.episode_number)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center space-y-4">
                <div className="w-12 h-12 mx-auto grid place-items-center rounded-full border-2 border-dashed border-crimson-900/50">
                  <Film className="w-6 h-6 text-crimson-900" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-crimson-700 italic">No segment data recorded for this season.</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Stream Sources Sidebar */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-crimson-950/40 border border-crimson-900/40 p-6 sm:p-8 rounded-[2rem] sticky top-28 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

          <h3 className="text-lg font-black text-crimson-50 mb-8 flex items-center gap-3 uppercase tracking-tighter relative z-10">
            <div className="relative">
               {streamLoading && <div className="w-2.5 h-2.5 rounded-full bg-crimson-500 animate-ping absolute inset-0"></div>}
               <div className="w-2.5 h-2.5 rounded-full bg-crimson-600 relative"></div>
            </div>
            Scraped Targets
            {!unaired && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 normal-nums">
                  {streamLoading
                    ? `Scanning${streams.length ? ` · ${streams.length}` : '…'}`
                    : streams.length
                      ? `${streams.length} found`
                      : 'none'}
                </span>
                {onReload && !streamLoading && (
                  <button
                    onClick={onReload}
                    title="Rescan — re-resolve sources from scratch"
                    aria-label="Rescan sources"
                    className="text-crimson-700 hover:text-crimson-400 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 gap-3 relative z-10">
            {unaired ? (
              <div className="col-span-full p-8 bg-crimson-950/80 rounded-2xl text-center border border-dashed border-crimson-900/40 space-y-2">
                <CalendarClock className="w-6 h-6 text-crimson-700 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 italic">
                  Awaiting transmission{unaired.airDate ? ` · ${formatAirDate(unaired.airDate)}` : ''}
                </p>
              </div>
            ) : streamLoading && !streams.length ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-crimson-950/40 animate-pulse rounded-2xl border border-crimson-900/30"></div>
              ))
            ) : streams.length > 0 ? (
              sourceGroups.map((group) => {
                // Non-stacked groups (cache targets, lone providers) stay flat.
                if (!group.stacked) {
                  const { stream, idx } = group.items[0];
                  return (
                    <StreamTile
                      key={group.key}
                      stream={stream}
                      label={stream.source}
                      active={activeStreamIdx === idx}
                      onClick={() => handleSelectStream(idx)}
                    />
                  );
                }
                const containsActive = group.items.some((it) => it.idx === activeStreamIdx);
                const open = group.key in openGroups ? openGroups[group.key] : containsActive;
                return (
                  <SourceGroup
                    key={group.key}
                    group={group}
                    activeStreamIdx={activeStreamIdx}
                    onSelectStream={handleSelectStream}
                    open={open}
                    onToggle={() => setOpenGroups((m) => ({ ...m, [group.key]: !open }))}
                  />
                );
              })
            ) : (
              <div className="col-span-full p-8 bg-crimson-950/80 rounded-2xl text-center border border-dashed border-crimson-900/40 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-800 italic">Zero transport nodes active</p>
                {onReload && (
                  <button
                    onClick={onReload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_10px_25px_rgba(255,0,60,0.2)]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Rescan sources
                  </button>
                )}
              </div>
            )}
          </div>

          {streamLoading && streams.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-2 animate-pulse">
               <div className="w-1.5 h-1.5 bg-crimson-500 rounded-full"></div>
               <span className="text-[8px] font-black uppercase tracking-[0.3em] text-crimson-600">Probing more nodes</span>
            </div>
          )}

          {showCompanionNudge && (
            <div className="mt-6 relative z-10 flex items-start gap-3 p-4 rounded-2xl bg-crimson-500/[0.07] border border-crimson-500/25">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-crimson-500/15 border border-crimson-500/30 text-crimson-400 shrink-0">
                <Puzzle className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-grow">
                <Link to="/extension" className="block text-[11px] font-black text-crimson-50 leading-snug hover:text-crimson-300 transition-colors">
                  Want more transport nodes? Claim the Companion. 🦇
                </Link>
                <p className="text-[10px] text-crimson-100/50 font-medium leading-snug mt-0.5">
                  It resolves &amp; plays extra sources locally, straight from your browser.
                </p>
              </div>
              <button
                onClick={dismissNudge}
                aria-label="Dismiss"
                className="shrink-0 text-crimson-700 hover:text-crimson-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchView;
