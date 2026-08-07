// Admin › Metrics, the history half (Phase 1).
//
// Everything below the History heading comes from a private Prometheus that
// scrapes every replica, so unlike the live snapshot underneath it these numbers
// are fleet-wide, survive restarts and are rates rather than totals since boot.
//
// The browser picks a panel id and a range id off the server's own list and sends
// them back; the PromQL each id stands for lives in the backend's
// core/prom_query.py and is never composed here. See deploy/prometheus/README.md.
//
// With no Prometheus deployed the panels endpoint answers `available: false`,
// which is the normal state of a fresh install rather than an error, so this
// renders a short setup note and the tab carries on with the snapshot.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock, LineChart, RefreshCw, Server } from 'lucide-react';

import { adminApi } from '../adminApi';
import TimeChart from './TimeChart';
import { parseDuration } from './chartFormat';

// Panels are fetched a few at a time rather than all at once. Each one is a
// query_range against Prometheus, and firing a whole group in parallel makes the
// slowest of them set the time before anything at all appears; in batches the
// charts fill in as they arrive.
const BATCH = 3;

const GroupPill = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active
        ? 'bg-crimson-600 text-white shadow-[0_8px_20px_rgba(255,0,60,0.2)]'
        : 'bg-crimson-950/40 border border-crimson-900/60 text-crimson-500 hover:text-white hover:border-crimson-600'
    }`}
  >
    {label}
  </button>
);

const PanelCard = ({ panel, payload }) => (
  <div className="bg-crimson-950/30 border border-crimson-900/40 rounded-3xl p-5 space-y-3">
    <div className="space-y-1">
      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-crimson-200">{panel.title}</h4>
      <p className="text-[10px] font-medium text-crimson-600/80 leading-relaxed">{panel.description}</p>
    </div>

    {!payload && (
      <div className="h-40 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.25em] text-crimson-700 animate-pulse">
        Consulting the archives…
      </div>
    )}

    {payload?.ok === false && (
      <div className="h-40 flex flex-col items-center justify-center gap-2 text-center px-4">
        <AlertTriangle className="w-5 h-5 text-amber-500/70" />
        <p className="text-[10px] font-bold text-amber-300/80">The archivist could not answer</p>
        <p className="text-[10px] font-mono text-crimson-700 break-all">{payload.error}</p>
      </div>
    )}

    {payload?.ok && (
      <>
        <TimeChart
          series={payload.series}
          unit={panel.unit}
          stacked={panel.stacked}
          start={payload.start}
          end={payload.end}
          step={payload.step}
        />
        {payload.truncated > 0 && (
          <p className="text-[9px] font-bold text-crimson-700 ml-16">
            {payload.truncated} quieter {payload.truncated === 1 ? 'line' : 'lines'} hidden to keep the chart readable
          </p>
        )}
      </>
    )}
  </div>
);

export default function MetricsHistory({ notify }) {
  const [meta, setMeta] = useState(null);
  const [targets, setTargets] = useState(null);
  const [rangeId, setRangeId] = useState(null);
  const [group, setGroup] = useState(null);
  const [payloads, setPayloads] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Bumped on every (re)load so a batch still in flight when the range changes
  // cannot write its stale results over the new ones.
  const runRef = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await adminApi.metricsPanels();
        if (!alive) return;
        setMeta(res);
        if (res?.available) {
          setRangeId(res.default_range || res.ranges?.[0]?.id || null);
          setGroup(res.panels?.[0]?.group || null);
          adminApi.metricsTargets().then((t) => { if (alive) setTargets(t); }).catch(() => {});
        }
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const groups = useMemo(() => {
    const seen = [];
    for (const panel of meta?.panels || []) {
      if (!seen.includes(panel.group)) seen.push(panel.group);
    }
    return seen;
  }, [meta]);

  const visible = useMemo(
    () => (meta?.panels || []).filter((p) => p.group === group),
    [meta, group],
  );

  const loadSeries = useCallback(async (panels, range) => {
    if (!panels.length || !range) return;
    const run = runRef.current + 1;
    runRef.current = run;
    setPayloads({});
    for (let i = 0; i < panels.length; i += BATCH) {
      const batch = panels.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((p) =>
          adminApi.metricsSeries(p.id, range).catch((e) => ({ ok: false, error: String(e?.message || e) })),
        ),
      );
      // The user switched range or group while this batch was in flight.
      if (runRef.current !== run) return;
      setPayloads((prev) => {
        const next = { ...prev };
        batch.forEach((p, j) => { next[p.id] = results[j]; });
        return next;
      });
    }
  }, []);

  useEffect(() => { loadSeries(visible, rangeId); }, [visible, rangeId, loadSeries]);

  const reload = useCallback(() => {
    loadSeries(visible, rangeId);
    adminApi.metricsTargets().then(setTargets).catch(() => notify?.('Could not reach the archivist', false));
  }, [loadSeries, visible, rangeId, notify]);

  if (loading) {
    return (
      <div className="py-10 text-center text-crimson-700 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">
        Asking whether anything was written down…
      </div>
    );
  }

  // No Prometheus (or the endpoint itself is unreachable). Both are stated
  // plainly rather than hidden: an operator who deployed one and sees this needs
  // to know it is not being reached.
  if (failed || !meta?.available) {
    return (
      <div className="bg-crimson-950/30 border border-crimson-900/40 rounded-3xl px-6 py-8 text-center space-y-3">
        <LineChart className="w-9 h-9 text-crimson-800 mx-auto" />
        <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-crimson-300">No history is being kept</h4>
        <p className="text-[11px] text-crimson-600/80 font-medium leading-relaxed max-w-lg mx-auto">
          {failed
            ? 'The history endpoints could not be reached. The live snapshot below is unaffected.'
            : meta?.reason || 'No Prometheus is configured.'}
          {' '}Stand one up with <span className="font-mono text-crimson-500">deploy/prometheus</span> and set
          {' '}<span className="font-mono text-crimson-500">PROMETHEUS_URL</span> to get charts over time. Everything
          below keeps working either way.
        </p>
      </div>
    );
  }

  const range = meta.ranges?.find((r) => r.id === rangeId);
  const retentionSeconds = parseDuration(meta.retention);
  const outOfRange = retentionSeconds && range && range.seconds > retentionSeconds;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        {(meta.ranges || []).map((r) => (
          <GroupPill key={r.id} active={r.id === rangeId} label={r.label} onClick={() => setRangeId(r.id)} />
        ))}
        <button
          onClick={reload}
          className="group ml-auto flex items-center gap-2 px-4 py-2 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-500 hover:text-white hover:border-crimson-500 transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" /> Redraw
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {groups.map((g) => (
          <GroupPill key={g} active={g === group} label={g} onClick={() => setGroup(g)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold">
        {/* An empty chart because nothing happened and an empty chart because the
            scraper lost the fleet look identical, so say which it is. */}
        {targets?.ok && (
          <span className={`flex items-center gap-1.5 ${targets.down ? 'text-amber-300' : 'text-crimson-600'}`}>
            <Server className="w-3.5 h-3.5" />
            Scraping {targets.up} {targets.up === 1 ? 'replica' : 'replicas'}
            {targets.down > 0 && `, ${targets.down} unreachable`}
          </span>
        )}
        {meta.retention && (
          <span className="flex items-center gap-1.5 text-crimson-600">
            <Clock className="w-3.5 h-3.5" /> Keeps {meta.retention}
          </span>
        )}
        {outOfRange && (
          <span className="text-amber-300">
            This range is longer than the archive keeps, so it starts partway across.
          </span>
        )}
      </div>

      {targets?.ok && targets.down > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl px-5 py-3.5 space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Replicas not being scraped</p>
          {targets.targets.filter((t) => t.health !== 'up').map((t) => (
            <p key={t.instance} className="text-[10px] font-mono text-amber-200/70 break-all">
              {t.instance} {t.last_error ? `· ${t.last_error}` : ''}
            </p>
          ))}
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-4">
        {visible.map((panel) => (
          <PanelCard key={panel.id} panel={panel} payload={payloads[panel.id]} />
        ))}
      </div>
    </div>
  );
}
