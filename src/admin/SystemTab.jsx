// Admin › System tab — the runtime/capabilities/DB-pool/CORS-proxy snapshot plus
// the metadata resync + non-anime catalogue backfill controls (each with its own
// background-job poller). Lifted verbatim from Admin.jsx; RuntimeSection and
// ProxiesSection live here because only this tab renders them.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, Boxes, Clock, Cpu, Database, DownloadCloud, Film, Gauge, HardDrive,
  Power, Radio, RefreshCw, Shield, ShieldOff, Wifi, WifiOff, Zap,
} from 'lucide-react';

import { adminApi } from '../adminApi';
import { FlagBadge, StatCard } from './ui';
import { fmtDate, statusMeta } from './format';

const fmtPct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');

// The external CORS proxies (crimson-proxy on Netlify / Cloudflare) that Phase-1
// sources route their HLS segments through. Lists each configured host with a
// live up/down ping and which sources prefer them; falls back to a dormant note
// when CRIMSON_PROXY_BASE / PROXY_SECRET aren't set (sources self-proxy then).
function ProxiesSection({ proxies }) {
  const hosts = proxies?.hosts || [];
  const routed = proxies?.routed_sources || [];
  return (
    <section className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
        <Radio className="w-4 h-4" /> CORS Proxies <div className="h-px bg-crimson-900/30 flex-grow" />
      </h3>
      {!proxies?.enabled ? (
        <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest pl-1">
          {proxies && !proxies.secret_set
            ? 'Disabled — PROXY_SECRET not set. Sources proxy their own segments.'
            : 'Not configured — set CRIMSON_PROXY_BASE to offload segments. Sources proxy their own.'}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {hosts.map((h) => {
              const m = statusMeta(h.status);
              return (
                <div key={h.base} className={`flex items-center gap-3 rounded-lg border ${m.ring} bg-crimson-950/30 px-4 py-2.5`}>
                  {h.status === 'active'
                    ? <Wifi className={`w-4 h-4 ${m.text}`} />
                    : <WifiOff className={`w-4 h-4 ${m.text}`} />}
                  <span className="font-mono text-[11px] text-crimson-300 truncate flex-grow normal-case">{h.base}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${m.text}`}>{m.label}</span>
                  <span className="text-[10px] font-bold text-crimson-700 normal-case font-mono">{h.detail || (h.code ? `HTTP ${h.code}` : '')}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest pl-1">
            Routing: <span className="text-crimson-400 normal-case">{routed.length ? routed.join(', ') : '—'}</span>
            {hosts.length > 1 && <span className="text-crimson-600"> · round-robin across {hosts.length} hosts</span>}
          </p>
        </>
      )}
    </section>
  );
}

// The runtime snapshot (version/uptime/registry, capability flags, DB pool, proxies).
function RuntimeSection({ system }) {
  if (!system) {
    return <div className="py-10 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Reading the runes…</div>;
  }
  const f = system.flags || {};
  const p = system.db_pool || {};
  const reg = system.registry || {};
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
          <Cpu className="w-4 h-4" /> Runtime <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Version" value={`v${system.version}`} icon={Shield} accent="text-crimson-500" />
          <StatCard label="Uptime" value={system.uptime_human} sub={fmtDate(system.started_at)} icon={Clock} accent="text-green-400" />
          <StatCard label="Scrapers" value={reg.scrapers} sub={`${reg.resolvers ?? 0} resolvers`} icon={Boxes} />
          <StatCard label="Python" value={system.python_version} sub={system.hostname} icon={Cpu} />
        </div>
        <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest pl-1">
          Node: <span className="text-crimson-400 normal-case font-mono">{system.platform || '—'}</span>
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
          <Power className="w-4 h-4" /> Capabilities <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <FlagBadge on={f.cache_enabled} label="Video Cache" onIcon={DownloadCloud} offIcon={DownloadCloud} />
          <FlagBadge on={f.ffmpeg_available} label="ffmpeg" onIcon={Film} offIcon={Film} />
          <FlagBadge on={f.jellyfin_configured} label="Jellyfin" />
          <FlagBadge on={f.local_configured} label="Local Media" onIcon={HardDrive} offIcon={HardDrive} />
          <FlagBadge on={f.showbox_configured} label="ShowBox" />
          <FlagBadge on={f.tmdb_key_set} label="TMDB Key" onIcon={Database} offIcon={Database} />
          <FlagBadge on={f.github_token_set} label="Changelog" onIcon={Activity} offIcon={Activity} />
          <FlagBadge on={f.require_login} label="Login Wall" onIcon={Shield} offIcon={ShieldOff} />
          <FlagBadge on={f.crimson_proxy_enabled} label="CORS Proxy" onIcon={Radio} offIcon={Radio} />
        </div>
        <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest pl-1">
          Rate-limit store: <span className="text-crimson-400 normal-case font-mono">{f.rate_limit_storage || '—'}</span>
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
          <Gauge className="w-4 h-4" /> Database Pool <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>
        {p.available ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="In Use" value={p.in_use} sub={`of ${p.max_size} max · ${fmtPct(p.in_use, p.max_size)}`} icon={Activity} accent={p.in_use >= (p.max_size || 0) ? 'text-crimson-500' : 'text-green-400'} />
              <StatCard label="Idle" value={p.idle} sub={`${p.size ?? 0} open`} icon={Database} />
              <StatCard label="Waiting" value={p.waiting} sub="queued for a conn" icon={Clock} accent={p.waiting > 0 ? 'text-amber-400' : 'text-crimson-700'} />
              <StatCard label="Requests" value={p.requests_total} sub={`${p.requests_errors ?? 0} errors`} icon={Zap} accent={p.requests_errors > 0 ? 'text-crimson-500' : undefined} />
            </div>
            <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest pl-1">
              Bounds: <span className="text-crimson-400">{p.min_size} … {p.max_size}</span> · Total connections opened: <span className="text-crimson-400">{p.connections_total ?? '—'}</span>
            </p>
          </>
        ) : (
          <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest pl-1">Pool not yet open on this node.</p>
        )}
      </section>

      <ProxiesSection proxies={system.proxies} />
    </div>
  );
}

export default function SystemTab({ stats, system, notify, refreshStats }) {
  const [resync, setResync] = useState(stats?.resync || null);
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef(null);

  // Backfill (non-anime catalogue seed) — its own state + poller, same shape.
  const [backfill, setBackfill] = useState(null);
  const [backfillPages, setBackfillPages] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const backfillPollRef = useRef(null);

  useEffect(() => { setResync(stats?.resync || null); }, [stats]);

  const poll = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await adminApi.resyncStatus();
        if (res.success) {
          setResync(res.resync);
          if (!res.resync.running) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            notify(res.resync.ok === false ? `Resync failed: ${res.resync.error}` : 'Resync complete', res.resync.ok !== false);
            refreshStats();
          }
        }
      } catch { /* keep polling */ }
    }, 3000);
  }, [notify, refreshStats]);

  const pollBackfill = useCallback(() => {
    backfillPollRef.current = setInterval(async () => {
      try {
        const res = await adminApi.backfillStatus();
        if (res.success) {
          setBackfill(res.backfill);
          // Keep polling while queued (waiting for api-sync) or running; stop only
          // once the job reaches a terminal state.
          if (res.backfill && !res.backfill.running && !res.backfill.queued) {
            clearInterval(backfillPollRef.current);
            backfillPollRef.current = null;
            notify(
              res.backfill.ok === false
                ? `Backfill failed: ${res.backfill.error}`
                : `Backfill done — ${res.backfill.shows ?? 0} shows, ${res.backfill.movies ?? 0} movies seeded`,
              res.backfill.ok !== false,
            );
            refreshStats();
          }
        }
      } catch { /* keep polling */ }
    }, 3000);
  }, [notify, refreshStats]);

  // Pick up an in-progress backfill on mount (survives a tab switch / reload).
  useEffect(() => {
    let cancelled = false;
    adminApi.backfillStatus().then((res) => {
      if (!cancelled && res.success) {
        setBackfill(res.backfill);
        if ((res.backfill?.running || res.backfill?.queued) && !backfillPollRef.current) pollBackfill();
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (backfillPollRef.current) clearInterval(backfillPollRef.current);
  }, []);

  const trigger = async () => {
    setTriggering(true);
    try {
      const res = await adminApi.resync();
      setResync(res.resync);
      if (res.success) { notify('Resync started', true); if (!pollRef.current) poll(); }
      else notify(res.message || 'Could not start resync', false);
    } catch { notify('Could not start resync', false); }
    finally { setTriggering(false); }
  };

  const triggerBackfill = async () => {
    setBackfilling(true);
    try {
      const body = backfillPages ? { pages: Number(backfillPages) } : {};
      const res = await adminApi.backfill(body);
      if (res.backfill) setBackfill(res.backfill);
      // Poll on success (queued) and also when it reports an already-active job, so
      // the UI tracks the existing run instead of going stale.
      if ((res.backfill?.queued || res.backfill?.running) && !backfillPollRef.current) pollBackfill();
      notify(res.success ? 'Backfill queued' : (res.message || 'Could not queue backfill'), res.success);
    } catch { notify('Could not queue backfill', false); }
    finally { setBackfilling(false); }
  };

  const running = resync?.running;
  const backfillBusy = backfill?.running || backfill?.queued;
  const c = stats?.content || {};

  return (
    <div className="space-y-10">
      <RuntimeSection system={system} />

      <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-8 space-y-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-crimson-500/5 blur-3xl rounded-full" />
        <div className="flex items-center gap-3 relative z-10">
          <Database className="w-7 h-7 text-crimson-500" />
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Metadata Resync</h3>
            <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest">Forced AniList ↔ TMDB Fribb rebuild</p>
          </div>
        </div>

        <p className="text-xs text-crimson-300/70 font-medium leading-relaxed relative z-10 max-w-2xl">
          Rebuilds the entire mapping catalogue from the Fribb dataset, bypassing the up-to-date check. Runs in the background and serves the previous snapshot until it commits (no downtime). The full rebuild can take a few minutes.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10">
          <button
            onClick={trigger}
            disabled={triggering || running}
            className="px-7 py-4 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(255,0,60,0.2)]"
          >
            <RefreshCw className={`w-4 h-4 ${(triggering || running) ? 'animate-spin' : ''}`} />
            {running ? 'Resync running…' : 'Trigger Resync'}
          </button>

          {resync && (resync.started_at || resync.finished_at) && (
            <div className="text-[10px] font-bold text-crimson-600 uppercase tracking-wider space-y-0.5">
              {running ? (
                <p className="text-crimson-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-crimson-500 animate-pulse" /> Started {fmtDate(resync.started_at)}</p>
              ) : (
                <>
                  <p>Last run: {fmtDate(resync.finished_at)}</p>
                  <p className={resync.ok === false ? 'text-crimson-500' : 'text-green-500'}>
                    {resync.ok === false ? `Failed: ${resync.error}` : 'Completed successfully'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Non-anime catalogue backfill */}
      <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-8 space-y-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-crimson-500/5 blur-3xl rounded-full" />
        <div className="flex items-center gap-3 relative z-10">
          <DownloadCloud className="w-7 h-7 text-crimson-500" />
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Catalogue Backfill</h3>
            <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest">Pre-seed non-anime shows &amp; movies from TMDB</p>
          </div>
        </div>

        <p className="text-xs text-crimson-300/70 font-medium leading-relaxed relative z-10 max-w-2xl">
          The <span className="text-crimson-400 font-bold">{c.tmdb_shows ?? '—'}</span> shows and <span className="text-crimson-400 font-bold">{c.tmdb_movies ?? '—'}</span> movies in the metadata tables are normally filled lazily as titles get opened or surface in search. This pages TMDB's popularity-ranked discover lists (anime excluded) and caches each one ahead of time. The job is handed to the <span className="text-crimson-400 font-bold">sync node</span> (so only it churns the metadata) and paced to stay gentle on TMDB and the database — it can take a minute to start and runs in the background. Each page is ~20 titles.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 relative z-10">
          <div className="space-y-2 sm:w-56">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">Pages per kind (1–500)</label>
            <input
              type="number" min="1" max="500" value={backfillPages}
              onChange={(e) => setBackfillPages(e.target.value)}
              placeholder="Default (100)"
              className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold placeholder-crimson-700 focus:outline-none focus:border-crimson-500"
            />
          </div>
          <button
            onClick={triggerBackfill}
            disabled={backfilling || backfillBusy}
            className="px-7 py-4 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(255,0,60,0.2)] h-[52px]"
          >
            <DownloadCloud className={`w-4 h-4 ${(backfilling || backfillBusy) ? 'animate-pulse' : ''}`} />
            {backfill?.running ? 'Backfill running…' : backfill?.queued ? 'Queued on sync node…' : 'Start Backfill'}
          </button>

          {backfill && (backfill.requested_at || backfill.finished_at) && (
            <div className="text-[10px] font-bold text-crimson-600 uppercase tracking-wider space-y-0.5">
              {backfill.queued ? (
                <p className="text-amber-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Queued {fmtDate(backfill.requested_at)} · waiting for sync node</p>
              ) : backfill.running ? (
                <p className="text-crimson-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-crimson-500 animate-pulse" /> Started {fmtDate(backfill.started_at)} · {backfill.pages} pages</p>
              ) : (
                <>
                  <p>Last run: {fmtDate(backfill.finished_at)}</p>
                  <p className={backfill.ok === false ? 'text-crimson-500' : 'text-green-500'}>
                    {backfill.ok === false
                      ? `Failed: ${backfill.error}`
                      : `Seeded ${backfill.shows ?? 0} shows · ${backfill.movies ?? 0} movies`}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
          <Database className="w-4 h-4" /> Mapping Snapshot <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Anime Entries" value={c.anime_entries} icon={Database} accent="text-crimson-500" />
          <StatCard label="TMDB Seasons" value={c.tmdb_seasons} icon={Database} />
          <StatCard label="TMDB Extras" value={c.tmdb_extras} icon={Database} />
          <StatCard label="Cache Rows" value={c.api_cache} icon={Database} />
        </div>
        <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest pl-1">
          ETag: <span className="text-crimson-400 font-mono normal-case">{c.mapping_etag || '—'}</span> · Last sync: <span className="text-crimson-400">{fmtDate(c.last_synced)}</span>
        </p>
      </section>
    </div>
  );
}
