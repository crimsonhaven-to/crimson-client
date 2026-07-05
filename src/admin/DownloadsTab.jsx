// Admin › Downloads tab — the aria2-backed background downloader: submit an
// http/https URL or a magnet link, watch it download, and pause/resume/retry/cancel
// jobs. Finished media lands under a download-enabled Local source's
// crimson-downloads/ dir and then surfaces in the Local library on its own. Mirrors
// the shape of CacheTab.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Download, HardDrive, Link2, Magnet, Pause, Play,
  Plus, RefreshCw, Trash2,
} from 'lucide-react';

import { adminApi } from '../adminApi';
import { StatCard } from './ui';

const formatBytes = (n) => {
  if (n == null) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const STATUS_STYLES = {
  active: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  pending: 'bg-crimson-500/10 border-crimson-500/30 text-crimson-400',
  paused: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
  complete: 'bg-green-500/10 border-green-500/30 text-green-400',
  failed: 'bg-red-500/10 border-red-500/30 text-red-400',
};

// A job that's still moving should refresh often; a quiet ledger can idle.
const isLive = (jobs) => jobs.some((j) => j.status === 'active' || j.status === 'pending');

export default function DownloadsTab({ notify }) {
  const [overview, setOverview] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('');
  const pollRef = useRef(null);

  const load = useCallback(async (spin = true) => {
    if (spin) setLoading(true);
    try {
      const [ov, jb] = await Promise.all([
        adminApi.downloadsOverview(),
        adminApi.listDownloadJobs({ limit: 200, status: filter || undefined }),
      ]);
      if (ov.success) setOverview(ov);
      if (jb.success) setJobs(jb.jobs);
    } catch { notify('Failed to load downloads', false); }
    finally { if (spin) setLoading(false); }
  }, [notify, filter]);

  useEffect(() => { load(); }, [load]);

  // Light auto-refresh while anything is in flight, so progress bars move without a
  // manual reload. Cleared when idle to avoid needless polling.
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (isLive(jobs)) {
      pollRef.current = setInterval(() => load(false), 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs, load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    try {
      const res = await adminApi.createDownload({ url: url.trim(), name: name.trim() || undefined });
      if (res.success) { notify('Download queued', true); setUrl(''); setName(''); await load(false); }
      else notify(res.detail || res.error || 'Could not queue download', false);
    } catch { notify('Could not queue download', false); }
    finally { setAdding(false); }
  };

  const act = async (job, fn, okMsg) => {
    setBusyId(job.id);
    try {
      const res = await fn(job.id);
      if (res.success) { notify(okMsg, true); await load(false); }
      else notify(res.detail || 'Action failed', false);
    } catch { notify('Action failed', false); }
    finally { setBusyId(null); }
  };

  const cancel = async (job) => {
    const done = job.status === 'complete';
    const msg = done
      ? 'Remove this finished download from the list? The published file stays in the Local library.'
      : 'Cancel this download? Any partial file is deleted.';
    if (!window.confirm(msg)) return;
    await act(job, adminApi.deleteDownload, done ? 'Removed' : 'Download cancelled');
  };

  const stats = overview?.stats || {};
  const targets = overview?.download_targets || [];

  return (
    <div className="space-y-8">
      {/* header + submit */}
      <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 space-y-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-crimson-500/5 blur-3xl rounded-full" />
        <div className="flex items-center gap-3 relative z-10">
          <Download className="w-7 h-7 text-crimson-500" />
          <div className="flex-grow">
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Downloader</h3>
            <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest">Fetch http / magnet links straight into your Local library</p>
          </div>
        </div>
        <p className="text-xs text-crimson-300/70 font-medium leading-relaxed relative z-10 max-w-3xl">
          Paste a direct <span className="text-crimson-400 font-bold">http(s)</span> file URL or a <span className="text-crimson-400 font-bold">magnet</span> link. It downloads in the background to the first <span className="text-crimson-400 font-bold">download-enabled</span> Local source with free space (turn a source on under <span className="text-crimson-400 font-bold">Sources</span>), landing under its <code className="font-mono text-crimson-400">/crimson-downloads</code> folder — where the Local library then surfaces it automatically. An optional name becomes the destination folder and helps identify the title.
        </p>

        {overview && !overview.aria2_available && (
          <div className="relative z-10 flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> The aria2 sidecar is unreachable — downloads stay pending until it's up. Check the <code className="font-mono">aria2</code> service and <code className="font-mono">ARIA2_RPC_SECRET</code>.
          </div>
        )}
        {overview && targets.length === 0 && (
          <div className="relative z-10 flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> No Local source is download-enabled. Enable one under the Sources tab first, or downloads have nowhere to land.
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2 flex-1">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">URL or magnet link</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…  or  magnet:?xt=urn:btih:…" className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold font-mono placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
            </div>
            <div className="space-y-2 sm:w-56">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">Name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dune (2021)" className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={adding} className="px-6 py-3 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 h-[46px]">
                {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Fetch</>}
              </button>
            </div>
          </div>
        </form>

        {overview && (
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Active" value={stats.active ?? 0} icon={Download} accent="text-amber-500" />
            <StatCard label="Pending" value={stats.pending ?? 0} icon={RefreshCw} accent="text-crimson-500" />
            <StatCard label="Paused" value={stats.paused ?? 0} icon={Pause} accent="text-sky-500" />
            <StatCard label="Complete" value={stats.complete ?? 0} icon={CheckCircle2} accent="text-green-500" />
            <StatCard label="Downloaded" value={formatBytes(stats.total_bytes)} icon={HardDrive} accent="text-crimson-400" />
          </div>
        )}
      </div>

      {/* download targets (informational) */}
      {targets.length > 0 && (
        <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 space-y-4 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <HardDrive className="w-6 h-6 text-crimson-500" />
            <h3 className="text-base font-black text-crimson-50 uppercase tracking-tighter">Download Targets</h3>
            <span className="text-[9px] font-bold text-crimson-700 uppercase tracking-widest">tried top-to-bottom</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative z-10">
            {targets.map((t, i) => (
              <div key={t.id} className="p-3 rounded-xl bg-crimson-950/40 border border-crimson-900/60 flex items-center gap-3">
                <span className="text-[10px] font-black text-crimson-600 w-5">{i + 1}</span>
                <span className="min-w-0 flex-grow">
                  <span className="block text-xs font-bold text-crimson-100 truncate">{t.label}</span>
                  <span className="block font-mono text-[10px] text-crimson-500/80 truncate">{t.path}</span>
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-green-500/80 flex-shrink-0">{formatBytes(t.free_bytes)} free</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* jobs ledger */}
      <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 space-y-5 relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <Download className="w-6 h-6 text-crimson-500" />
          <h3 className="text-base font-black text-crimson-50 uppercase tracking-tighter flex-grow">Downloads</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {['', 'active', 'pending', 'paused', 'complete', 'failed'].map((s) => (
              <button key={s || 'all'} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${filter === s ? 'bg-crimson-600 border-crimson-500 text-white' : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-500 hover:border-crimson-600'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Loading…</div>
        ) : jobs.length === 0 ? (
          <p className="py-10 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">No downloads yet</p>
        ) : (
          <div className="space-y-2 relative z-10">
            {jobs.map((j) => {
              const pct = j.progress != null ? Math.round(j.progress * 100) : null;
              const isTorrent = j.kind === 'torrent';
              return (
                <div key={j.id} className="border border-crimson-900/40 rounded-2xl p-3.5 bg-crimson-950/30 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isTorrent ? <Magnet className="w-3.5 h-3.5 text-crimson-500 flex-shrink-0" /> : <Link2 className="w-3.5 h-3.5 text-crimson-500 flex-shrink-0" />}
                        <span className="text-xs font-bold text-crimson-50 truncate max-w-[16rem] sm:max-w-md">{j.name || j.source_url}</span>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${STATUS_STYLES[j.status] || 'bg-crimson-900/40 border-crimson-800/50 text-crimson-600'}`}>{j.status}</span>
                      </div>
                      <p className="text-[10px] font-medium text-crimson-600 mt-1 truncate">
                        {formatBytes(j.bytes_done)}{j.bytes_total ? ` / ${formatBytes(j.bytes_total)}` : ''}
                        {j.status === 'active' && j.download_speed ? ` · ${formatBytes(j.download_speed)}/s` : ''}
                        {pct != null ? ` · ${pct}%` : ''}
                        {j.status === 'complete' && j.final_path ? ` · ${j.final_path}` : ''}
                        {j.status === 'failed' && j.error ? ` · ${j.error}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(j.status === 'active' || j.status === 'pending') && (
                        <button title="Pause" disabled={busyId === j.id} onClick={() => act(j, adminApi.pauseDownload, 'Paused')}
                          className="p-2 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-sky-400 hover:border-sky-500/50 hover:bg-sky-500/10 transition-all disabled:opacity-30">
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {j.status === 'paused' && (
                        <button title="Resume" disabled={busyId === j.id} onClick={() => act(j, adminApi.resumeDownload, 'Resumed')}
                          className="p-2 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-green-400 hover:border-green-500/50 hover:bg-green-500/10 transition-all disabled:opacity-30">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {j.status === 'failed' && (
                        <button title="Retry" disabled={busyId === j.id} onClick={() => act(j, adminApi.retryDownload, 'Re-queued')}
                          className="p-2 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-300 hover:border-crimson-500/50 hover:bg-crimson-500/10 transition-all disabled:opacity-30">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      <button title={j.status === 'complete' ? 'Remove from list' : 'Cancel + delete'} disabled={busyId === j.id} onClick={() => cancel(j)}
                        className="p-2 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-500 hover:border-crimson-500 hover:bg-crimson-600/20 transition-all disabled:opacity-30">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* progress bar for anything in flight */}
                  {(j.status === 'active' || j.status === 'paused') && (
                    <div className="h-1.5 rounded-full bg-crimson-950/80 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${j.status === 'paused' ? 'bg-sky-500/60' : 'bg-crimson-500'}`}
                        style={{ width: pct != null ? `${pct}%` : '10%' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
