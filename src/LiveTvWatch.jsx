// --- Live TV watch page ---------------------------------------------------------
// Plays one live channel from the iptv-org catalogue. Live broadcasts don't fit
// the /watch NDJSON pipeline (no episodes, no progress, no resume), so this page
// feeds CrimsonPlayer directly in its `live` mode: seek/resume/download hidden, a
// LIVE crest where the timestamps would be. Every feed the catalogue knows for
// the channel becomes a source tile.
//
// Playback is DIRECT-FIRST: a `direct_ok` feed (https, no header demands —
// measured ~55-60% of the live catalogue) plays straight off the broadcaster's
// CDN, costing the backend zero bandwidth. Whether the CDN serves CORS can only
// be discovered by trying — so a fatal player error on a direct attempt silently
// falls that feed back to the signed /iptv_proxy (which also carries the
// plain-http and Referer/UA-gated feeds that can never play direct).
import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Tv, Radio, Globe2, AlertTriangle, SatelliteDish } from 'lucide-react';
import { API_BASE_URL, useLiveTvChannel, useTitle } from './hooks';

const CrimsonPlayer = lazy(() => import('./CrimsonPlayer'));

// One catalogue feed → one player source. The label follows the sidebar's
// "Provider · variant" language so the player cog groups it naturally.
// `fallbackUrl` is set only when there's somewhere to fall back TO (a direct
// attempt that might hit a CORS wall); proxy-only feeds start on the proxy.
function toSource(stream, channelName) {
  const variant = [stream.quality, stream.label].filter(Boolean).join(' · ') || 'Broadcast';
  const proxied = `${API_BASE_URL}${stream.proxy_path}`;
  return {
    source: `${channelName} · ${variant}`,
    type: 'hls',
    url: stream.direct_ok ? stream.direct_url : proxied,
    fallbackUrl: stream.direct_ok ? proxied : null,
  };
}

export default function LiveTvWatch() {
  const { channelId } = useParams();
  const { channel, loading, error } = useLiveTvChannel(channelId);
  const [activeIdx, setActiveIdx] = useState(0);
  // Feed indexes whose direct attempt failed and now ride the proxy. Reset per
  // channel — a fresh channel gets fresh direct attempts.
  const [fellBack, setFellBack] = useState(() => new Set());
  useEffect(() => { setActiveIdx(0); setFellBack(new Set()); }, [channelId]);
  useTitle(channel?.name || 'Live TV');

  const sources = useMemo(
    () => (channel?.streams || []).map((s) => toSource(s, channel.name)),
    [channel],
  );
  const active = sources[activeIdx] || sources[0] || null;
  const activeUrl = active
    ? (fellBack.has(activeIdx) && active.fallbackUrl ? active.fallbackUrl : active.url)
    : null;

  // The player's fatal-error interceptor: a direct feed that won't play (CORS
  // wall, dead CDN) silently retunes through the proxy — returning true keeps
  // the player's error screen down while the src swap remounts the stream. A
  // feed that fails ON the proxy too is genuinely dead: show the error.
  const handleFatalError = useCallback(() => {
    if (active?.fallbackUrl && !fellBack.has(activeIdx)) {
      setFellBack((prev) => new Set(prev).add(activeIdx));
      return true;
    }
    return false;
  }, [active, activeIdx, fellBack]);

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
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 p-6 text-center backdrop-blur-md">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20" />
              <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 blur-xl bg-crimson-500/20 rounded-full animate-pulse" />
            </div>
            <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Tuning the crimson airwaves...</p>
          </div>
        ) : error || !active ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/95 p-8 text-center backdrop-blur-md">
            <div className="p-5 rounded-full bg-crimson-500/10 border border-crimson-500/20 mb-6">
              <AlertTriangle className="w-12 h-12 text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.5)]" />
            </div>
            <p className="text-crimson-50 font-black text-lg sm:text-2xl mb-2 uppercase tracking-tighter">Broadcast Link Severed</p>
            <p className="text-crimson-400/80 text-xs sm:text-sm max-w-sm font-medium leading-relaxed">
              {error || 'This channel eludes even Lumi’s gaze tonight. Try another.'}
            </p>
          </div>
        ) : (
          <Suspense fallback={null}>
            <CrimsonPlayer
              src={activeUrl}
              type="hls"
              title={channel.name}
              live
              sources={sources}
              activeSourceIdx={activeIdx}
              onSelectSource={setActiveIdx}
              onFatalError={handleFatalError}
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

          {sources.length > 1 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-700">
                <SatelliteDish className="w-3.5 h-3.5" /> Broadcast Feeds
              </p>
              <div className="flex flex-wrap gap-2">
                {(channel.streams || []).map((s, i) => (
                  <button
                    key={`${s.direct_url}-${i}`}
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
