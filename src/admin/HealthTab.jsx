// Admin › Health tab — the source-vitals probe sweep (library + streaming sources)
// plus the anonymous client-resolve success-rate table. Lifted verbatim from
// Admin.jsx; SourceRow lives here as its only consumer.
import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ExternalLink, Gauge, HardDrive, HeartPulse,
  PowerOff, Radio, WifiOff,
} from 'lucide-react';

import { adminApi } from '../adminApi';
import { StatCard, StatusDot } from './ui';
import { fmtDate, statusMeta } from './format';

const SourceRow = ({ s }) => {
  const m = statusMeta(s.status);
  return (
    <div className={`bg-crimson-950/40 backdrop-blur-xl border ${m.ring} rounded-2xl p-4 sm:p-5 flex items-center gap-4 hover:border-crimson-500/30 transition-all`}>
      <StatusDot status={s.status} />
      <div className="min-w-0 flex-grow">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-black text-white tracking-tight">{s.label}</span>
          <span className={`text-[9px] font-black uppercase tracking-widest ${m.text}`}>{m.label}</span>
          {s.supports_movies && <span className="text-[8px] font-black uppercase tracking-widest text-crimson-600 border border-crimson-900/60 rounded-full px-2 py-0.5">Movies</span>}
        </div>
        {s.note && <p className="text-[10px] font-bold text-crimson-600 uppercase tracking-wider mt-0.5">{s.note}</p>}
        <p className="text-[11px] text-crimson-300/70 font-medium mt-1">{s.detail}</p>
        {s.base_url && (
          <a href={s.base_url} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-crimson-700 hover:text-crimson-400 transition-colors inline-flex items-center gap-1 mt-1">
            {s.base_url.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <div className="text-right shrink-0 space-y-1">
        {s.latency_ms != null && (
          <p className={`text-[11px] font-black tabular-nums ${s.latency_ms > 4000 ? 'text-amber-400' : 'text-crimson-300'}`}>{s.latency_ms} ms</p>
        )}
        {s.category === 'scrape' && s.status !== 'disabled' && (
          <p className="text-[9px] font-black uppercase tracking-widest text-crimson-600">{s.embeds ?? 0} embeds</p>
        )}
        {s.metrics && typeof s.metrics.ready === 'number' && (
          <p className="text-[9px] font-black uppercase tracking-widest text-crimson-600">{s.metrics.ready} ready</p>
        )}
      </div>
    </div>
  );
};

export default function HealthTab({ notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [resolveStats, setResolveStats] = useState(null);

  const load = useCallback(async (force = false) => {
    force ? setProbing(true) : setLoading(true);
    try {
      const res = await adminApi.sourceHealth(force);
      if (res.success) setData(res);
      else notify('Could not probe sources', false);
    } catch { notify('Could not probe sources', false); }
    finally { setLoading(false); setProbing(false); }
  }, [notify]);

  useEffect(() => { load(false); }, [load]);

  // Real client-side resolve success rates (anonymous beacons). Best-effort: an
  // empty table just means no client/extension resolves have been reported yet.
  useEffect(() => {
    let alive = true;
    adminApi.sourceStats(14)
      .then((r) => { if (alive && r?.success) setResolveStats(r.sources || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (loading && !data) {
    return <div className="py-24 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Listening for the heartbeat of the network…</div>;
  }

  const sources = data?.sources || [];
  const summary = data?.summary || {};
  const library = sources.filter((s) => s.category === 'library');
  const scrape = sources.filter((s) => s.category === 'scrape');

  return (
    <div className="space-y-10">
      {/* Summary + re-probe */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2.5">
            <HeartPulse className="w-5 h-5 text-crimson-500" /> Source Vitals
          </h3>
          <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest">
            Probed against <span className="text-crimson-400 normal-case">{data?.canary?.title}</span> · {data?.cached ? 'cached' : 'fresh'} · {fmtDate(data?.probed_at)}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={probing}
          className="px-6 py-3.5 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 shadow-[0_10px_25px_rgba(255,0,60,0.2)] self-start"
        >
          <Radio className={`w-4 h-4 ${probing ? 'animate-pulse' : ''}`} /> {probing ? 'Probing the dark…' : 'Re-probe Sources'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Healthy" value={(summary.ok || 0) + (summary.active || 0)} icon={CheckCircle2} accent="text-green-400" />
        <StatCard label="Empty / Idle" value={(summary.empty || 0) + (summary.idle || 0)} icon={AlertCircle} accent="text-amber-400" />
        <StatCard label="Down" value={summary.error || 0} icon={WifiOff} accent="text-crimson-500" />
        <StatCard label="Dormant" value={summary.disabled || 0} icon={PowerOff} accent="text-crimson-700" />
        <StatCard label="Avg Latency" value={summary.avg_latency_ms != null ? `${summary.avg_latency_ms} ms` : '—'} sub={summary.slowest_ms != null ? `slowest ${summary.slowest_ms} ms` : null} icon={Gauge} />
      </div>

      {library.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
            <HardDrive className="w-4 h-4" /> Library Sources <div className="h-px bg-crimson-900/30 flex-grow" />
          </h3>
          <div className="grid gap-3">{library.map((s) => <SourceRow key={s.id} s={s} />)}</div>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
          <Radio className="w-4 h-4" /> Streaming Sources <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>
        <div className="grid gap-3">{scrape.map((s) => <SourceRow key={s.id} s={s} />)}</div>
      </section>

      {resolveStats && resolveStats.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
            <Gauge className="w-4 h-4" /> Client Resolve Stats <span className="text-crimson-700 normal-case tracking-normal">(last 14 days, anonymous)</span> <div className="h-px bg-crimson-900/30 flex-grow" />
          </h3>
          <div className="grid gap-2">
            {resolveStats.map((s) => {
              const rate = s.success_rate == null ? null : Math.round(s.success_rate * 100);
              const accent = rate == null ? 'text-crimson-700' : rate >= 70 ? 'text-green-400' : rate >= 30 ? 'text-amber-300' : 'text-crimson-500';
              return (
                <div key={s.source} className="flex items-center gap-4 bg-crimson-950/30 border border-crimson-900/40 rounded-2xl px-5 py-3">
                  <span className="text-xs font-black text-white truncate flex-1 min-w-0">{s.source}</span>
                  <div className="hidden sm:block w-40 h-1.5 bg-crimson-950 rounded-full overflow-hidden">
                    <div className={`h-full ${rate == null ? '' : rate >= 70 ? 'bg-green-400' : rate >= 30 ? 'bg-amber-300' : 'bg-crimson-500'}`} style={{ width: `${rate ?? 0}%` }} />
                  </div>
                  <span className={`text-sm font-black tabular-nums w-12 text-right ${accent}`}>{rate == null ? '—' : `${rate}%`}</span>
                  <span className="text-[10px] font-bold text-crimson-700 tabular-nums w-24 text-right">{s.ok}✓ / {s.fail}✗</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] font-medium text-crimson-700 leading-relaxed max-w-3xl">
            These are real success rates from viewers resolving sources client-side (extension/proxy), which the canary probe above can't see. A source that drops here is failing for actual users even if its probe is green.
          </p>
        </section>
      )}

      <p className="text-[10px] font-medium text-crimson-700 leading-relaxed max-w-3xl">
        A <span className="text-green-400 font-bold">Healthy</span> streaming source resolved real embeds for the canary, so it would play right now. <span className="text-amber-300 font-bold">Empty</span> means the site answered but surfaced nothing (markup may have shifted). <span className="text-crimson-400 font-bold">Down</span> means it errored or was blocked. <span className="text-crimson-600 font-bold">Dormant</span> sources await their env keys. Library sources report what the haven itself holds.
      </p>
    </div>
  );
}
