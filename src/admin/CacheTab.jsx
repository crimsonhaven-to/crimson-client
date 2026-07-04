// Admin › Cache tab — the video-cache master switch, cache targets (NAS dirs) and
// the cached-episodes ledger. Lifted verbatim from Admin.jsx.
import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Database, DownloadCloud, Film, FolderOpen,
  FolderSearch, HardDrive, Languages, Pencil, Plus, Power, PowerOff, RefreshCw, Trash2,
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

// Map a cache target's filesystem probe into a one-line status with a colour cue.
const cacheTargetStatus = (st) => {
  if (!st) return { text: 'Unknown', ok: false };
  if (!st.exists) return { text: 'Path not found in container', ok: false };
  if (!st.is_dir) return { text: 'Not a directory', ok: false };
  if (!st.writable) return { text: 'Not writable by backend', ok: false };
  const free = st.free_bytes != null ? `${formatBytes(st.free_bytes)} free` : 'writable';
  const n = st.file_count ?? 0;
  return { text: `${free} · ${n}${st.file_count_capped ? '+' : ''} file${n === 1 ? '' : 's'}`, ok: true };
};

const CACHE_STATUS_STYLES = {
  ready: 'bg-green-500/10 border-green-500/30 text-green-400',
  downloading: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  pending: 'bg-crimson-500/10 border-crimson-500/30 text-crimson-400',
  failed: 'bg-red-500/10 border-red-500/30 text-red-400',
};

export default function CacheTab({ notify }) {
  const [overview, setOverview] = useState(null);
  const [targets, setTargets] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [mounts, setMounts] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [epFilter, setEpFilter] = useState('');
  const [busyEpId, setBusyEpId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tg, eps] = await Promise.all([
        adminApi.cacheOverview(),
        adminApi.listCacheTargets(),
        adminApi.listCachedEpisodes({ limit: 200, status: epFilter || undefined }),
      ]);
      if (ov.success) setOverview(ov);
      if (tg.success) setTargets(tg.targets);
      if (eps.success) setEpisodes(eps.episodes);
    } catch { notify('Failed to load cache info', false); }
    finally { setLoading(false); }
  }, [notify, epFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleGlobal = async () => {
    if (!overview) return;
    setTogglingGlobal(true);
    try {
      const res = await adminApi.setCacheEnabled(!overview.enabled);
      if (res.success) { notify(res.enabled ? 'Caching enabled' : 'Caching disabled', true); await load(); }
      else notify(res.detail || 'Could not update setting', false);
    } catch { notify('Could not update setting', false); }
    finally { setTogglingGlobal(false); }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    setAdding(true);
    try {
      const res = await adminApi.addCacheTarget({ name: name.trim(), path: path.trim() });
      if (res.success) { notify('Cache target added', true); setName(''); setPath(''); await load(); }
      else notify(res.detail || res.error || 'Could not add target', false);
    } catch { notify('Could not add target', false); }
    finally { setAdding(false); }
  };

  const toggleTarget = async (t) => {
    setBusyId(t.id);
    try {
      const res = await adminApi.updateCacheTarget(t.id, { enabled: !t.enabled });
      if (res.success) { notify(t.enabled ? 'Target disabled' : 'Target enabled', true); await load(); }
      else notify(res.detail || 'Could not update target', false);
    } catch { notify('Could not update target', false); }
    finally { setBusyId(null); }
  };

  const renameTarget = async (t) => {
    const next = window.prompt('New name (shown to viewers as the source label):', t.name);
    if (!next || !next.trim() || next.trim() === t.name) return;
    setBusyId(t.id);
    try {
      const res = await adminApi.updateCacheTarget(t.id, { name: next.trim() });
      if (res.success) { notify('Target renamed', true); await load(); }
      else notify(res.detail || 'Could not rename target', false);
    } catch { notify('Could not rename target', false); }
    finally { setBusyId(null); }
  };

  const removeTarget = async (t) => {
    if (!window.confirm(`Remove cache target "${t.name}"? Its cache index is cleared, but the files on the NAS stay put (delete them on the share to reclaim space).`)) return;
    setBusyId(t.id);
    try {
      const res = await adminApi.deleteCacheTarget(t.id);
      if (res.success) { notify('Target removed', true); await load(); }
      else notify(res.detail || 'Could not remove target', false);
    } catch { notify('Could not remove target', false); }
    finally { setBusyId(null); }
  };

  const removeEpisode = async (ep) => {
    if (!window.confirm('Delete this cached file from the NAS? It will be re-cached the next time the episode is played (if caching is on).')) return;
    setBusyEpId(ep.id);
    try {
      const res = await adminApi.deleteCachedEpisode(ep.id);
      if (res.success) { notify('Cache entry deleted', true); await load(); }
      else notify(res.detail || 'Could not delete entry', false);
    } catch { notify('Could not delete entry', false); }
    finally { setBusyEpId(null); }
  };

  const discover = async () => {
    setDiscovering(true);
    try {
      const res = await adminApi.discoverCacheTargets();
      if (res.success) setMounts(res.mounts);
      else notify('Discovery failed', false);
    } catch { notify('Discovery failed', false); }
    finally { setDiscovering(false); }
  };

  const applyMount = (m) => {
    setPath(m.path);
    if (!name.trim()) {
      const parts = m.path.split('/').filter(Boolean);
      setName(parts[parts.length - 1] || m.path);
    }
  };

  const stats = overview?.stats || {};

  return (
    <div className="space-y-8">
      {/* master switch + status */}
      <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 space-y-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-crimson-500/5 blur-3xl rounded-full" />
        <div className="flex items-center gap-3 relative z-10">
          <DownloadCloud className="w-7 h-7 text-crimson-500" />
          <div className="flex-grow">
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Video Cache</h3>
            <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest">Download played episodes to a NAS &amp; replay from disk</p>
          </div>
          <button
            onClick={toggleGlobal}
            disabled={togglingGlobal || !overview}
            className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${overview?.enabled ? 'bg-green-500/10 border-green-500/40 text-green-400 hover:bg-green-500/20' : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-500 hover:border-crimson-600'}`}
          >
            {togglingGlobal ? <RefreshCw className="w-4 h-4 animate-spin" /> : (overview?.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />)}
            {overview?.enabled ? 'Caching On' : 'Caching Off'}
          </button>
        </div>
        <p className="text-xs text-crimson-300/70 font-medium leading-relaxed relative z-10 max-w-3xl">
          With caching on, the first time an episode is played the backend downloads the whole stream (remuxed to mp4) to the first enabled, writable target below — tagged with its audio/subtitle language. On the next play it surfaces as a source named after that target, served straight off the NAS. The path is the one <span className="text-crimson-400 font-bold">inside the backend container</span>: bind-mount your NAS share (e.g. <code className="font-mono text-crimson-400">- /nas/cache:/crimson/cache</code>) and register <code className="font-mono text-crimson-400">/crimson/cache</code>.
        </p>
        {overview && !overview.ffmpeg_available && (
          <div className="relative z-10 flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> ffmpeg is not available on the backend — downloads will fail until it's installed in the image.
          </div>
        )}
        {overview && (
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Ready" value={stats.ready ?? 0} icon={CheckCircle2} accent="text-green-500" />
            <StatCard label="Downloading" value={stats.downloading ?? 0} icon={DownloadCloud} accent="text-amber-500" />
            <StatCard label="Pending" value={stats.pending ?? 0} icon={RefreshCw} accent="text-crimson-500" />
            <StatCard label="Failed" value={stats.failed ?? 0} icon={AlertCircle} accent="text-red-500" />
            <StatCard label="On disk" value={formatBytes(stats.total_bytes)} icon={Database} accent="text-crimson-400" />
          </div>
        )}
      </div>

      {/* add target */}
      <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 space-y-5 relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <HardDrive className="w-6 h-6 text-crimson-500" />
          <h3 className="text-base font-black text-crimson-50 uppercase tracking-tighter">Cache Targets</h3>
        </div>
        <form onSubmit={add} className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2 sm:w-64">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">Name (shown as source)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crimson Vault" className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">In-container path</label>
              <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/crimson/cache" className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold font-mono placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={adding} className="px-6 py-3 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 h-[46px]">
                {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add</>}
              </button>
            </div>
          </div>
          <button type="button" onClick={discover} disabled={discovering} className="flex items-center gap-2 px-4 py-2.5 bg-crimson-950/60 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
            <FolderSearch className={`w-4 h-4 ${discovering ? 'animate-pulse' : ''}`} /> {discovering ? 'Scanning…' : 'Discover mounts'}
          </button>
        </form>

        {mounts && (
          <div className="relative z-10 space-y-2">
            {mounts.length === 0 ? (
              <p className="text-[11px] text-crimson-700 font-bold italic">No candidate mounts detected. Type the in-container path above.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mounts.map((m) => {
                  const st = cacheTargetStatus(m);
                  return (
                    <button key={m.path} type="button" onClick={() => applyMount(m)} disabled={m.already_added}
                      className="text-left p-3 rounded-xl bg-crimson-950/40 border border-crimson-900/60 hover:border-crimson-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3">
                      <FolderOpen className="w-4 h-4 text-crimson-500 flex-shrink-0" />
                      <span className="min-w-0 flex-grow">
                        <span className="block font-mono text-xs text-crimson-200 truncate">{m.path}</span>
                        <span className={`block text-[9px] font-black uppercase tracking-widest ${st.ok ? 'text-green-500/80' : 'text-crimson-600'}`}>
                          {m.fstype} · {st.text}{m.already_added ? ' · added' : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Loading…</div>
        ) : targets.length === 0 ? (
          <p className="py-10 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">No cache targets registered yet</p>
        ) : (
          <div className="space-y-3 relative z-10">
            {targets.map((t) => {
              const st = cacheTargetStatus(t.status);
              return (
                <div key={t.id} className={`border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all ${t.enabled ? 'bg-crimson-950/40 border-crimson-900/50' : 'bg-crimson-950/20 border-crimson-900/30 opacity-60'}`}>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-crimson-50 truncate">{t.name}</span>
                      {t.enabled
                        ? <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-400">Enabled</span>
                        : <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-900/40 border border-crimson-800/50 text-crimson-600">Disabled</span>}
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${st.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-crimson-500/10 border-crimson-500/30 text-crimson-500'}`}>{st.text}</span>
                    </div>
                    <p className="text-[11px] font-mono text-crimson-500/80 mt-1.5 truncate">{t.path}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button title="Rename" disabled={busyId === t.id} onClick={() => renameTarget(t)}
                      className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-400 hover:border-crimson-500/50 hover:bg-crimson-500/10 transition-all disabled:opacity-40">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button title={t.enabled ? 'Disable' : 'Enable'} disabled={busyId === t.id} onClick={() => toggleTarget(t)}
                      className={`p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 transition-all disabled:opacity-40 ${t.enabled ? 'text-green-400 hover:border-green-500/50 hover:bg-green-500/10' : 'text-crimson-500 hover:border-crimson-500/50 hover:bg-crimson-500/10'}`}>
                      {t.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                    <button title="Remove target" disabled={busyId === t.id} onClick={() => removeTarget(t)}
                      className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-500 hover:border-crimson-500 hover:bg-crimson-600/20 transition-all disabled:opacity-30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* cached episodes ledger */}
      <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 space-y-5 relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <Film className="w-6 h-6 text-crimson-500" />
          <h3 className="text-base font-black text-crimson-50 uppercase tracking-tighter flex-grow">Cached Episodes</h3>
          <div className="flex items-center gap-1.5">
            {['', 'ready', 'downloading', 'pending', 'failed'].map((s) => (
              <button key={s || 'all'} onClick={() => setEpFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${epFilter === s ? 'bg-crimson-600 border-crimson-500 text-white' : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-500 hover:border-crimson-600'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="py-10 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Loading…</div>
        ) : episodes.length === 0 ? (
          <p className="py-10 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">Nothing cached yet</p>
        ) : (
          <div className="space-y-2 relative z-10">
            {episodes.map((ep) => (
              <div key={ep.id} className="border border-crimson-900/40 rounded-2xl p-3.5 flex items-center gap-3 bg-crimson-950/30">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-crimson-50">TMDB {ep.tmdb_id} · {ep.media_type === 'movie' ? 'Movie' : `S${ep.season_number}E${ep.episode_number}`}</span>
                    {ep.language && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 flex items-center gap-1">
                        <Languages className="w-3 h-3" /> {ep.language}
                      </span>
                    )}
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${CACHE_STATUS_STYLES[ep.status] || 'bg-crimson-900/40 border-crimson-800/50 text-crimson-600'}`}>{ep.status}</span>
                  </div>
                  <p className="text-[10px] font-medium text-crimson-600 mt-1 truncate">
                    {ep.target_name ? `${ep.target_name} · ` : ''}{ep.source_origin || '—'}
                    {ep.file_size ? ` · ${formatBytes(ep.file_size)}` : ''}
                    {ep.status === 'failed' && ep.error ? ` · ${ep.error}` : ''}
                  </p>
                </div>
                <button title="Delete cached file" disabled={busyEpId === ep.id} onClick={() => removeEpisode(ep)}
                  className="p-2 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-500 hover:border-crimson-500 hover:bg-crimson-600/20 transition-all disabled:opacity-30 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
