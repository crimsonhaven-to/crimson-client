// Admin › Metrics tab. Reads the backend's Prometheus exposition (GET /metrics,
// see core/observability.py) with the admin bearer the dashboard already holds,
// parses it in the browser and renders the current values.
//
// Phase 0 of the metrics story: no Prometheus server is involved, so there is no
// history and no rate-over-time. Two consequences the operator has to be told
// about rather than left to discover, both surfaced in the banner below:
//
//   1. Counters here are TOTALS SINCE THAT REPLICA STARTED, not "per minute".
//   2. With several replicas behind a load balancer, each refresh lands on
//      whichever one answered, so the numbers move around. Gauges (pool, queues)
//      read correctly either way; counters look like they jump.
//
// Phase 1 replaces both caveats with a real scrape behind an /admin/metrics proxy.
import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Boxes, Clock, Cpu, Database, Gauge, HardDrive,
  Layers, LineChart, RefreshCw, Route, Zap,
} from 'lucide-react';

import { adminApi } from '../adminApi';
import { StatCard } from './ui';
import {
  parseMetrics, samplesOf, sumOf, valueOf, infoLabel, groupSum,
  histogramQuantile, histogramCount, outcomeRatio,
} from './promParse';

// Local formatters, matching the per-tab convention already used by CacheTab,
// DownloadsTab and SourcesTab.
const formatBytes = (n) => {
  if (!n || n < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const fmtInt = (n) => (n == null ? null : Math.round(n).toLocaleString());

// null means "no observations", Infinity means the quantile landed in the
// open-ended top bucket (see histogramQuantile) and interpolating would be a lie.
const fmtSeconds = (s) => {
  if (s == null) return null;
  if (!Number.isFinite(s)) return 'off the scale';
  if (s < 1) return `${Math.round(s * 1000)} ms`;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

const fmtPct = (r) => (r == null ? null : `${(r * 100).toFixed(r >= 0.995 || r === 0 ? 0 : 1)}%`);

const fmtUptime = (startedUnix) => {
  if (!startedUnix) return null;
  const secs = Math.max(0, Date.now() / 1000 - startedUnix);
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}m`;
  return `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h`;
};

// Colour a ratio the way the Health tab colours a status: green good, amber
// wobbling, crimson dead.
const ratioTone = (r) => {
  if (r == null) return 'text-crimson-600';
  if (r >= 0.9) return 'text-green-300';
  if (r >= 0.6) return 'text-amber-300';
  return 'text-crimson-400';
};

const barTone = (r) => {
  if (r == null) return 'bg-crimson-900';
  if (r >= 0.9) return 'bg-green-500';
  if (r >= 0.6) return 'bg-amber-500';
  return 'bg-crimson-500';
};

// ---------- small presentational pieces ----------

const Section = ({ icon: Icon, title, note, children }) => (
  <div className="space-y-4">
    <div className="flex items-baseline gap-2.5 flex-wrap">
      {Icon && <Icon className="w-4 h-4 text-crimson-500 self-center" />}
      <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-crimson-300">{title}</h3>
      {note && <span className="text-[10px] font-bold text-crimson-600/80">{note}</span>}
    </div>
    {children}
  </div>
);

const Empty = ({ children }) => (
  <div className="bg-crimson-950/30 border border-crimson-900/40 rounded-2xl px-5 py-6 text-[11px] font-bold text-crimson-600/80">
    {children}
  </div>
);

// A labelled proportion bar. `ratio` null renders an inert track, which is how a
// source nobody has attempted yet is distinguished from one failing every time.
const RatioRow = ({ label, ratio, right, sub }) => (
  <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-2xl px-4 py-3 hover:border-crimson-500/30 transition-all">
    <div className="flex items-center justify-between gap-3 mb-2">
      <span className="text-[11px] font-black text-crimson-100 tracking-tight truncate">{label}</span>
      <span className={`text-[11px] font-black tabular-nums shrink-0 ${ratioTone(ratio)}`}>
        {right ?? fmtPct(ratio) ?? 'untried'}
      </span>
    </div>
    <div className="h-1.5 rounded-full bg-crimson-950 border border-crimson-900/60 overflow-hidden">
      <div className={`h-full ${barTone(ratio)} transition-all`} style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }} />
    </div>
    {sub && <p className="text-[10px] font-bold text-crimson-600/80 mt-1.5">{sub}</p>}
  </div>
);

// A compact key/value strip for the flat gauges (pool, workers, process).
const Facts = ({ rows }) => (
  <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-2xl divide-y divide-crimson-900/40">
    {rows.map(([label, value]) => (
      <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-crimson-600">{label}</span>
        <span className="text-[11px] font-black tabular-nums text-crimson-100">{value ?? 'n/a'}</span>
      </div>
    ))}
  </div>
);

// ---------- the tab ----------

export default function MetricsTab({ notify }) {
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.metrics();
      if (res.unavailable) {
        setUnavailable(true);
        setParsed(null);
      } else if (res.ok) {
        setUnavailable(false);
        setParsed(parseMetrics(res.text));
        setFetchedAt(new Date());
      } else {
        notify('The empress declined to share her ledgers', false);
      }
    } catch {
      notify('Could not read the metrics ledger', false);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  if (loading && !parsed && !unavailable) {
    return <div className="py-24 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Counting the empress's ledgers…</div>;
  }

  if (unavailable) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <LineChart className="w-12 h-12 text-crimson-700 mx-auto" />
        <h3 className="text-lg font-black text-crimson-100 uppercase tracking-tighter">No ledgers kept</h3>
        <p className="text-[11px] text-crimson-500/80 font-medium leading-relaxed">
          This build has no <span className="font-mono text-crimson-400">prometheus-client</span>, so the
          backend keeps no counters and <span className="font-mono text-crimson-400">/metrics</span> answers 503.
          Add it to <span className="font-mono text-crimson-400">requirements.txt</span> and rebuild the image.
        </p>
      </div>
    );
  }

  if (!parsed) return <Empty>Nothing came back from the metrics endpoint.</Empty>;

  // --- HTTP -----------------------------------------------------------------
  const httpTotal = sumOf(parsed, 'crimson_http_requests_total');
  const inFlight = sumOf(parsed, 'crimson_http_requests_in_progress');
  const byStatus = groupSum(parsed, 'crimson_http_requests_total', 'status');
  const errorTotal = byStatus
    .filter((r) => r.key.startsWith('5') || r.key === '499')
    .reduce((a, r) => a + r.value, 0);

  const routes = groupSum(parsed, 'crimson_http_requests_total', 'route')
    .slice(0, 12)
    .map((r) => ({
      ...r,
      p95: histogramQuantile(parsed, 'crimson_http_request_duration_seconds', 0.95, { route: r.key }),
    }));

  // --- watch pipeline -------------------------------------------------------
  const watchOutcomes = groupSum(parsed, 'crimson_watch_requests_total', 'outcome');
  const watchTotal = watchOutcomes.reduce((a, r) => a + r.value, 0);
  const watchStreams = sumOf(parsed, 'crimson_watch_streams_total');
  const firstStreamP50 = histogramQuantile(parsed, 'crimson_watch_first_stream_seconds', 0.5);
  const firstStreamP95 = histogramQuantile(parsed, 'crimson_watch_first_stream_seconds', 0.95);
  const firstStreamN = histogramCount(parsed, 'crimson_watch_first_stream_seconds');
  const streamsPerWatch = watchTotal ? watchStreams / watchTotal : null;

  // --- sources --------------------------------------------------------------
  // Two independent views of the same question. resolve/scraper counters are what
  // THIS replica did since boot; source_success_ratio is the 14-day client beacon
  // aggregate out of the database, so it survives restarts and covers the
  // client-side resolves the backend never sees.
  const resolveSources = groupSum(parsed, 'crimson_resolve_total', 'source').map((r) => ({
    ...r,
    ratio: outcomeRatio(parsed, 'crimson_resolve_total', 'source', r.key, ['ok']),
    p95: histogramQuantile(parsed, 'crimson_resolve_duration_seconds', 0.95, { source: r.key }),
  }));
  const scrapers = groupSum(parsed, 'crimson_scraper_runs_total', 'scraper').map((r) => ({
    ...r,
    ratio: outcomeRatio(parsed, 'crimson_scraper_runs_total', 'scraper', r.key, ['embeds']),
  }));
  const beacons = samplesOf(parsed, 'crimson_source_success_ratio')
    .map((s) => ({
      key: s.labels.source,
      ratio: s.value,
      events: sumOf(parsed, 'crimson_source_resolve_events_total', { source: s.labels.source }),
    }))
    .sort((a, b) => b.events - a.events);

  // --- infrastructure -------------------------------------------------------
  const poolSize = valueOf(parsed, 'crimson_db_pool_size');
  const poolMax = valueOf(parsed, 'crimson_db_pool_max_size');
  const poolInUse = valueOf(parsed, 'crimson_db_pool_in_use');
  const poolWaiting = valueOf(parsed, 'crimson_db_pool_waiting');
  const poolSaturation = poolMax ? (poolInUse ?? 0) / poolMax : null;

  const cacheQueue = valueOf(parsed, 'crimson_cache_worker_queue_depth');
  const cacheInflight = valueOf(parsed, 'crimson_cache_worker_inflight');
  const downloadJobs = groupSum(parsed, 'crimson_download_jobs', 'status');

  const l1Hit = outcomeCacheRatio(parsed, 'l1');
  const l2Hit = outcomeCacheRatio(parsed, 'l2');

  const version = infoLabel(parsed, 'crimson_build_info', 'version');
  const schemaVersion = valueOf(parsed, 'crimson_schema_version');
  const schemaDrift = valueOf(parsed, 'crimson_schema_drift');

  // process_* comes from prometheus_client's ProcessCollector, which reads /proc.
  // Present in the Linux container, absent on a non-Linux dev host, so every one
  // of these has to render as "n/a" without complaint.
  const rss = valueOf(parsed, 'process_resident_memory_bytes');
  const cpu = valueOf(parsed, 'process_cpu_seconds_total');
  const fds = valueOf(parsed, 'process_open_fds');
  const uptime = fmtUptime(valueOf(parsed, 'process_start_time_seconds'));

  return (
    <div className="space-y-10">
      {/* The two caveats that make Phase 0 numbers easy to misread. */}
      <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl px-5 py-4 flex gap-3.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">Live snapshot, one replica</p>
          <p className="text-[11px] font-medium text-amber-200/70 leading-relaxed">
            These are totals since <span className="font-black">one replica</span> started, read straight from
            its <span className="font-mono">/metrics</span>. Each refresh may land on a different replica, so
            counters can jump around and drop to zero after a deploy. Gauges (pool, queues, in flight) are
            always truthful for the replica that answered.
            {fetchedAt && <> Last read {fetchedAt.toLocaleTimeString()}.</>}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={load}
          className="group flex items-center gap-2.5 px-5 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-400 hover:text-white hover:border-crimson-500 transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-90 transition-transform'}`} /> Re-read
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Requests served" value={fmtInt(httpTotal)} sub={`${fmtInt(errorTotal) || 0} failed`} icon={Activity} accent="text-crimson-400" />
        <StatCard label="In flight" value={fmtInt(inFlight)} sub="right now" icon={Zap} accent="text-amber-400" />
        <StatCard label="Watch fan-outs" value={fmtInt(watchTotal)} sub={streamsPerWatch != null ? `${streamsPerWatch.toFixed(1)} streams each` : null} icon={Layers} accent="text-crimson-400" />
        <StatCard label="First stream (p50)" value={fmtSeconds(firstStreamP50) ?? 'no data'} sub={firstStreamN ? `over ${fmtInt(firstStreamN)} fan-outs` : 'nothing observed yet'} icon={Clock} accent="text-green-400" />
      </div>

      <Section icon={Route} title="Busiest routes" note="p95 is time to response headers, not to last byte">
        {routes.length ? (
          <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-2xl divide-y divide-crimson-900/40 overflow-hidden">
            {routes.map((r) => (
              <div key={r.key} className="flex items-center gap-4 px-4 py-2.5">
                <span className="text-[11px] font-mono text-crimson-200 truncate flex-grow" title={r.key}>
                  {r.key === '__unmatched__' ? 'unmatched (404s and probes)' : r.key}
                </span>
                <span className="text-[11px] font-black tabular-nums text-crimson-400 shrink-0 w-20 text-right">{fmtInt(r.value)}</span>
                <span className="text-[11px] font-black tabular-nums text-crimson-600 shrink-0 w-24 text-right">{fmtSeconds(r.p95) ?? 'n/a'}</span>
              </div>
            ))}
          </div>
        ) : <Empty>No requests recorded on this replica yet.</Empty>}
      </Section>

      <Section icon={Gauge} title="Responses by status">
        {byStatus.length ? (
          <div className="flex flex-wrap gap-2.5">
            {byStatus.map((s) => (
              <div key={s.key} className={`px-3.5 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${
                s.key.startsWith('2') ? 'bg-green-950/30 border-green-800/40 text-green-300'
                  : s.key.startsWith('4') ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                    : 'bg-crimson-950/40 border-crimson-700/50 text-crimson-300'
              }`}>
                {s.key} <span className="tabular-nums opacity-70">{fmtInt(s.value)}</span>
              </div>
            ))}
          </div>
        ) : <Empty>Nothing recorded yet.</Empty>}
      </Section>

      <Section icon={Layers} title="Watch pipeline" note={firstStreamP95 != null ? `p95 first stream ${fmtSeconds(firstStreamP95)}` : null}>
        {watchOutcomes.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {watchOutcomes.map((o) => (
              <RatioRow
                key={o.key}
                label={OUTCOME_LABELS[o.key] || o.key}
                ratio={watchTotal ? o.value / watchTotal : null}
                right={`${fmtInt(o.value)} (${fmtPct(watchTotal ? o.value / watchTotal : 0)})`}
              />
            ))}
          </div>
        ) : <Empty>No playback has been requested from this replica yet.</Empty>}
      </Section>

      <Section icon={HardDrive} title="Resolvers on this replica" note="since boot">
        {resolveSources.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {resolveSources.map((s) => (
              <RatioRow
                key={s.key}
                label={s.key}
                ratio={s.ratio}
                sub={`${fmtInt(s.value)} attempts${s.p95 != null ? ` · p95 ${fmtSeconds(s.p95)}` : ''}`}
              />
            ))}
          </div>
        ) : <Empty>No embeds have been resolved on this replica yet.</Empty>}
      </Section>

      <Section icon={Boxes} title="Scrapers on this replica" note="share of runs that found embeds">
        {scrapers.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {scrapers.map((s) => (
              <RatioRow key={s.key} label={s.key} ratio={s.ratio} sub={`${fmtInt(s.value)} runs`} />
            ))}
          </div>
        ) : <Empty>No scraper has run on this replica yet.</Empty>}
      </Section>

      <Section icon={Activity} title="Client beacons" note="14 days, from the database, survives restarts">
        {beacons.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {beacons.map((b) => (
              <RatioRow key={b.key} label={b.key} ratio={b.ratio} sub={`${fmtInt(b.events)} reported outcomes`} />
            ))}
          </div>
        ) : <Empty>No client has reported a resolve outcome in the last 14 days.</Empty>}
      </Section>

      <Section icon={Database} title="Infrastructure">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Facts rows={[
              ['Pool in use', poolInUse != null ? `${fmtInt(poolInUse)} / ${fmtInt(poolMax) ?? '?'}` : null],
              ['Pool size', fmtInt(poolSize)],
              ['Waiting on a connection', fmtInt(poolWaiting)],
              ['Response cache L1', fmtPct(l1Hit) ?? 'no lookups'],
              ['Response cache L2', fmtPct(l2Hit) ?? 'no lookups'],
            ]} />
            {poolSaturation != null && (
              <RatioRow label="Pool saturation" ratio={1 - poolSaturation} right={fmtPct(poolSaturation)} sub="green means headroom" />
            )}
          </div>
          <Facts rows={[
            ['Cache worker queued', fmtInt(cacheQueue)],
            ['Cache worker running', fmtInt(cacheInflight)],
            ...downloadJobs.map((d) => [`Downloads ${d.key}`, fmtInt(d.value)]),
            ['Backend version', version],
            ['Schema version', schemaVersion != null ? fmtInt(schemaVersion) : null],
            ['Schema drift', schemaDrift != null ? fmtInt(schemaDrift) : null],
          ]} />
        </div>
      </Section>

      <Section icon={Cpu} title="Replica process" note="from /proc, so absent outside Linux">
        <Facts rows={[
          ['Uptime', uptime],
          ['Resident memory', rss != null ? formatBytes(rss) : null],
          ['CPU seconds', cpu != null ? cpu.toFixed(1) : null],
          ['Open file descriptors', fmtInt(fds)],
        ]} />
      </Section>
    </div>
  );
}

// Hit ratio for one tier of the two-tier response cache.
function outcomeCacheRatio(parsed, tier) {
  const hit = sumOf(parsed, 'crimson_response_cache_total', { tier, result: 'hit' });
  const miss = sumOf(parsed, 'crimson_response_cache_total', { tier, result: 'miss' });
  return hit + miss ? hit / (hit + miss) : null;
}

const OUTCOME_LABELS = {
  streams: 'Found streams',
  empty: 'Found nothing',
  unaired: 'Not yet aired',
  abandoned: 'Viewer left early',
  error: 'Errored',
};
