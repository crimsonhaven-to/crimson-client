// --- Live TV watch page ---------------------------------------------------------
// Plays one live channel from the iptv-org catalogue. Live broadcasts don't fit
// the /watch NDJSON pipeline (no episodes, no progress, no resume), so this page
// feeds CrimsonPlayer directly in its `live` mode: seek/resume/download hidden, a
// LIVE crest where the timestamps would be. Every feed the catalogue knows for
// the channel becomes a source tile.
//
// Playback climbs a ladder, cheapest-for-the-backend first, escalating on a fatal
// player error. The goal: keep the segment bytes off the backend whenever we can.
//
//   1. direct     — https + no header demands. hls.js plays straight off the
//                   broadcaster CDN. Zero backend, zero bridge. (~55-60% of feeds.)
//   2. ext-rules  — companion present: inject the feed's Referer/User-Agent and
//                   open CORS via declarative rules, then still play direct.
//                   Zero-copy — fixes CORS-walled / header-gated https feeds.
//   3. ext-fetch  — companion present: route every manifest/segment through the
//                   companion's privileged fetch. Handles plain-http (mixed
//                   content) and CORS-less sharded segments. Bytes flow through
//                   the viewer's browser, never the backend.
//   4. proxy      — last resort: the backend's signed /iptv_proxy (today's
//                   behaviour), reached only when the companion can't serve.
//
// A feed with the companion installed therefore never touches the backend; without
// it, direct feeds still play free and only the awkward ones fall to the proxy.
import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Tv, Radio, Globe2, AlertTriangle, SatelliteDish } from 'lucide-react';
import { API_BASE_URL, useLiveTvChannel, useTitle } from './hooks';
import {
  hasExtension, extensionEnabled, installLiveRules, clearLiveRules,
  makeExtensionLoader, resolveProxyUrl,
} from './liveTvExt';

const CrimsonPlayer = lazy(() => import('./CrimsonPlayer'));

// One catalogue feed → the ordered list of playback attempts for it. `ext` is
// whether the companion is present AND switched on (its tiers are skipped when
// not). Every consecutive pair differs in either src or loader, so escalating
// always re-inits hls.js.
function buildLadder(stream, ext) {
  const isHttps = (stream.url || '').startsWith('https://');
  const steps = [];
  if (stream.direct_ok) steps.push('direct');
  if (ext && isHttps) steps.push('ext-rules');
  if (ext) steps.push('ext-fetch');
  steps.push('proxy');
  return steps;
}

// Realise one ladder step into { src, loader } for the player — installing or
// clearing the companion's media rules / minting the signed proxy link as needed.
// Throws when the step can't be prepared (e.g. the backend won't sign a proxy).
async function prepareAttempt(step, stream, channelId) {
  switch (step) {
    case 'ext-rules':
      await installLiveRules(stream);
      return { src: stream.url, loader: null };
    case 'ext-fetch':
      await clearLiveRules();
      return {
        src: stream.url,
        loader: makeExtensionLoader({ referrer: stream.referrer, userAgent: stream.user_agent }),
      };
    case 'proxy': {
      await clearLiveRules();
      // Backend-sourced feeds (the catalogue fallback path) already carry a signed
      // proxy_path; client-catalogue feeds mint one lazily from the untouched
      // /iptv/channel endpoint.
      const proxied = stream.proxy_path
        ? `${API_BASE_URL}${stream.proxy_path}`
        : await resolveProxyUrl(channelId, stream.url);
      if (!proxied) throw new Error('no proxy link');
      return { src: proxied, loader: null };
    }
    case 'direct':
    default:
      await clearLiveRules();
      return { src: stream.url, loader: null };
  }
}

// One catalogue feed → one player source tile label. Follows the sidebar's
// "Provider · variant" language so the player cog groups it naturally.
function toSource(stream, channelName) {
  const variant = [stream.quality, stream.label].filter(Boolean).join(' · ') || 'Broadcast';
  return { source: `${channelName} · ${variant}`, type: 'hls' };
}

export default function LiveTvWatch() {
  const { channelId } = useParams();
  const { channel, loading, error } = useLiveTvChannel(channelId);
  const [activeIdx, setActiveIdx] = useState(0);
  // How far up the ladder the active feed has climbed, the realised attempt, and
  // a terminal prep failure (the backend refused to sign the proxy, etc.).
  const [attemptIdx, setAttemptIdx] = useState(0);
  const [prepared, setPrepared] = useState(null);
  const [prepError, setPrepError] = useState(null);
  // Companion availability: null = still probing, then true/false. We hold the
  // first attempt until it's known so a non-direct feed doesn't fall to the proxy
  // before we learn the companion could have served it for free.
  const [ext, setExt] = useState(null);

  useTitle(channel?.name || 'Live TV');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const on = hasExtension() ? await extensionEnabled() : false;
      if (!cancelled) setExt(on);
    })();
    return () => { cancelled = true; };
  }, []);

  // Fresh channel / feed → back to the bottom of the ladder.
  useEffect(() => { setActiveIdx(0); }, [channelId]);
  useEffect(() => { setAttemptIdx(0); setPrepared(null); setPrepError(null); }, [channelId, activeIdx]);
  // Tear the companion's media rules down when we leave the page.
  useEffect(() => () => { clearLiveRules(); }, []);

  const streams = channel?.streams || [];
  const activeStream = streams[activeIdx] || streams[0] || null;

  const sources = useMemo(
    () => streams.map((s) => toSource(s, channel?.name || 'Live')),
    [streams, channel],
  );

  const ladder = useMemo(
    () => (activeStream ? buildLadder(activeStream, !!ext) : []),
    [activeStream, ext],
  );

  // Realise the current attempt (async: rule install / proxy signing). Re-runs on
  // escalation. A prep failure escalates too, or surfaces once the ladder's spent.
  useEffect(() => {
    if (!activeStream || ext === null || !ladder.length) return undefined;
    let cancelled = false;
    setPrepared(null);
    const step = ladder[Math.min(attemptIdx, ladder.length - 1)];
    (async () => {
      try {
        const next = await prepareAttempt(step, activeStream, channelId);
        if (!cancelled) setPrepared(next);
      } catch {
        if (cancelled) return;
        if (attemptIdx + 1 < ladder.length) setAttemptIdx((i) => i + 1);
        else setPrepError('This channel eludes even Lumi’s gaze tonight. Try another.');
      }
    })();
    return () => { cancelled = true; };
  }, [activeStream, ext, ladder, attemptIdx, channelId]);

  // The player's fatal-error interceptor: climb to the next ladder step if one
  // remains (returning true keeps the error screen down while we re-tune), else
  // let the player show its "couldn't play" screen.
  const handleFatalError = useCallback(() => {
    if (attemptIdx + 1 < ladder.length) {
      setAttemptIdx((i) => i + 1);
      return true;
    }
    return false;
  }, [attemptIdx, ladder.length]);

  const preparing = activeStream && !prepared && !prepError;

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-6 my-auto animate-in fade-in duration-700">
      <Link
        to="/live"
        className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 hover:bg-crimson-900/30 transition-all duration-300 text-[11px] font-black uppercase tracking-widest active:scale-95 backdrop-blur-sm shadow-xl"
      >
        <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
        Back to the Airwaves
      </Link>

      {/* The screen */}
      <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-crimson-900/60 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
        {loading || preparing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 p-6 text-center backdrop-blur-md">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20" />
              <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 blur-xl bg-crimson-500/20 rounded-full animate-pulse" />
            </div>
            <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Tuning the crimson airwaves...</p>
          </div>
        ) : error || prepError || !activeStream ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 p-8 text-center backdrop-blur-md">
            <div className="p-5 rounded-full bg-crimson-500/10 border border-crimson-500/20 mb-6">
              <AlertTriangle className="w-12 h-12 text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.5)]" />
            </div>
            <p className="text-crimson-50 font-black text-lg sm:text-2xl mb-2 uppercase tracking-tighter">Broadcast Link Severed</p>
            <p className="text-crimson-400/80 text-xs sm:text-sm max-w-sm font-medium leading-relaxed">
              {error || prepError || 'This channel eludes even Lumi’s gaze tonight. Try another.'}
            </p>
          </div>
        ) : (
          <Suspense fallback={null}>
            <CrimsonPlayer
              src={prepared.src}
              type="hls"
              title={channel.name}
              live
              sources={sources}
              activeSourceIdx={activeIdx}
              onSelectSource={setActiveIdx}
              onFatalError={handleFatalError}
              hlsLoader={prepared.loader}
            />
          </Suspense>
        )}
      </div>

      {/* Channel sigil + feed tiles */}
      {channel && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="grid place-items-center w-14 h-14 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 overflow-hidden shrink-0">
              {channel.logo ? (
                <img src={channel.logo} alt="" className="w-full h-full object-contain p-2" />
              ) : (
                <Tv className="w-6 h-6 text-crimson-700" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-black text-crimson-50 uppercase tracking-tighter leading-none truncate">
                {channel.name}
              </h1>
              <p className="text-crimson-400 font-black tracking-[0.2em] text-[10px] uppercase opacity-80 mt-1.5 flex items-center gap-2 flex-wrap">
                <Globe2 className="w-3.5 h-3.5" /> {channel.country || 'Unknown Realm'}
                {channel.network && <span className="text-crimson-600">· {channel.network}</span>}
                {(channel.categories || []).map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded-md bg-crimson-950/40 border border-crimson-900/50 text-crimson-500">{c}</span>
                ))}
              </p>
            </div>
          </div>

          {streams.length > 1 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-700">
                <SatelliteDish className="w-3.5 h-3.5" /> Broadcast Feeds
              </p>
              <div className="flex flex-wrap gap-2">
                {streams.map((s, i) => (
                  <button
                    key={`${s.url}-${i}`}
                    onClick={() => setActiveIdx(i)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
                      i === activeIdx
                        ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.3)]'
                        : 'bg-crimson-950/40 border-crimson-900/40 text-crimson-400 hover:border-crimson-700 hover:bg-crimson-900/20'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {s.quality || 'Auto'}
                    {s.label && <span className="opacity-50">· {s.label}</span>}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-crimson-700 font-bold tracking-wide">
                A feed refuses to manifest? Free-to-air broadcasts flicker — invoke another and Lumi shall re-tune. 🦇
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
