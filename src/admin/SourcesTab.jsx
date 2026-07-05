// Admin › Sources tab — register / toggle / transcode-toggle / remove local media
// directories, with a mount discovery helper. Lifted verbatim from Admin.jsx.
import { useCallback, useEffect, useState } from 'react';
import { Download, Film, FolderOpen, FolderSearch, HardDrive, Plus, Power, PowerOff, RefreshCw, Trash2 } from 'lucide-react';

import { adminApi } from '../adminApi';

const formatBytes = (n) => {
  if (n == null) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// Map a source's filesystem-probe into a one-line status with a colour cue.
const localStatus = (st) => {
  if (!st) return { text: 'Unknown', ok: false };
  if (!st.exists) return { text: 'Path not found in container', ok: false };
  if (!st.is_dir) return { text: 'Not a directory', ok: false };
  if (!st.readable) return { text: 'Not readable by backend', ok: false };
  const n = st.video_count ?? 0;
  const t = st.transcodable_count ?? 0;
  const cap = st.video_count_capped ? '+' : '';
  let text = `${n}${cap} direct-play file${n === 1 ? '' : 's'}`;
  // Surface how many files only become playable with encoding on, so the toggle's
  // payoff is visible before flipping it.
  if (t > 0) text += ` · ${t}${cap} need encoding`;
  return { text, ok: true };
};

export default function SourcesTab({ notify }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [path, setPath] = useState('');
  const [encoding, setEncoding] = useState(false);
  const [downloadEnabled, setDownloadEnabled] = useState(false);
  const [encodingSupported, setEncodingSupported] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [mounts, setMounts] = useState(null);
  const [discovering, setDiscovering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listLocalSources();
      if (res.success) {
        setSources(res.sources);
        setEncodingSupported(res.encoding_supported !== false);
      }
      else notify('Failed to load local sources', false);
    } catch { notify('Failed to load local sources', false); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!label.trim() || !path.trim()) return;
    setAdding(true);
    try {
      const res = await adminApi.addLocalSource({ label: label.trim(), path: path.trim(), encoding, download_enabled: downloadEnabled });
      if (res.success) { notify('Local source added', true); setLabel(''); setPath(''); setEncoding(false); setDownloadEnabled(false); await load(); }
      else notify(res.detail || res.error || 'Could not add source', false);
    } catch { notify('Could not add source', false); }
    finally { setAdding(false); }
  };

  const toggle = async (s) => {
    setBusyId(s.id);
    try {
      const res = await adminApi.updateLocalSource(s.id, { enabled: !s.enabled });
      if (res.success) { notify(s.enabled ? 'Source disabled' : 'Source enabled', true); await load(); }
      else notify(res.detail || 'Could not update source', false);
    } catch { notify('Could not update source', false); }
    finally { setBusyId(null); }
  };

  const toggleEncoding = async (s) => {
    setBusyId(s.id);
    try {
      const res = await adminApi.updateLocalSource(s.id, { encoding: !s.encoding });
      if (res.success) { notify(s.encoding ? 'Transcoding disabled' : 'Transcoding enabled', true); await load(); }
      else notify(res.detail || 'Could not update source', false);
    } catch { notify('Could not update source', false); }
    finally { setBusyId(null); }
  };

  const toggleDownloads = async (s) => {
    setBusyId(s.id);
    try {
      const res = await adminApi.updateLocalSource(s.id, { download_enabled: !s.download_enabled });
      if (res.success) { notify(s.download_enabled ? 'Downloads disabled for source' : 'Downloads enabled for source', true); await load(); }
      else notify(res.detail || 'Could not update source', false);
    } catch { notify('Could not update source', false); }
    finally { setBusyId(null); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Remove local source "${s.label}"? The files stay on disk — they just stop being offered as a streaming source.`)) return;
    setBusyId(s.id);
    try {
      const res = await adminApi.deleteLocalSource(s.id);
      if (res.success) { notify('Source removed', true); await load(); }
      else notify(res.detail || 'Could not remove source', false);
    } catch { notify('Could not remove source', false); }
    finally { setBusyId(null); }
  };

  const discover = async () => {
    setDiscovering(true);
    try {
      const res = await adminApi.discoverLocalSources();
      if (res.success) setMounts(res.mounts);
      else notify('Discovery failed', false);
    } catch { notify('Discovery failed', false); }
    finally { setDiscovering(false); }
  };

  const applyMount = (m) => {
    setPath(m.path);
    if (!label.trim()) {
      const parts = m.path.split('/').filter(Boolean);
      setLabel(parts[parts.length - 1] || m.path);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 space-y-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-crimson-500/5 blur-3xl rounded-full" />
        <div className="flex items-center gap-3 relative z-10">
          <HardDrive className="w-7 h-7 text-crimson-500" />
          <div>
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Local Media Sources</h3>
            <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest">Direct-play streaming from a NAS / mounted directory</p>
          </div>
        </div>
        <p className="text-xs text-crimson-300/70 font-medium leading-relaxed relative z-10 max-w-3xl">
          Register a directory the backend can read and the haven will match shows against the files inside it and stream them directly — no third-party scraper involved.
          The path is the one <span className="text-crimson-400 font-bold">inside the backend container</span>: bind-mount your library in <code className="font-mono text-crimson-400">docker-compose</code> (e.g. <code className="font-mono text-crimson-400">- /movies:/crimson/movies1</code>) and register <code className="font-mono text-crimson-400">/crimson/movies1</code> here.
          Browser-playable files (mp4 / m4v / mov / webm) always direct-play. Turn on <span className="text-crimson-400 font-bold">transcoding</span> to also serve other containers (MKV, HEVC, AC-3…) — they're re-encoded to a seekable HLS stream on the fly by ffmpeg.
          Turn on <span className="text-crimson-400 font-bold">downloads</span> to let the background downloader (Downloads tab) write finished media into this source under <code className="font-mono text-crimson-400">/crimson-downloads</code> — it picks the first download-enabled source with enough free space.
        </p>

        <form onSubmit={add} className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2 sm:w-64">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Movies NAS" className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">In-container path</label>
              <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/crimson/movies1" className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold font-mono placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={adding} className="px-6 py-3 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 h-[46px]">
                {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add</>}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={discover} disabled={discovering} className="flex items-center gap-2 px-4 py-2.5 bg-crimson-950/60 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
              <FolderSearch className={`w-4 h-4 ${discovering ? 'animate-pulse' : ''}`} /> {discovering ? 'Scanning…' : 'Discover mounts'}
            </button>
            {encodingSupported ? (
              <button
                type="button"
                onClick={() => setEncoding((v) => !v)}
                title="When on, this source will transcode non-web containers (MKV, HEVC…) to HLS on the fly"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${encoding ? 'bg-crimson-600/20 border-crimson-500/50 text-crimson-300' : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-600 hover:text-crimson-400 hover:border-crimson-600'}`}
              >
                <Film className="w-4 h-4" /> Transcoding {encoding ? 'on' : 'off'}
              </button>
            ) : (
              <span title="ffmpeg/ffprobe not found in the backend image" className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border bg-crimson-950/30 border-crimson-900/40 text-crimson-700/70 cursor-not-allowed">
                <Film className="w-4 h-4" /> Transcoding unavailable
              </span>
            )}
            <button
              type="button"
              onClick={() => setDownloadEnabled((v) => !v)}
              title="When on, the background downloader may write finished media into this source under /crimson-downloads"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${downloadEnabled ? 'bg-crimson-600/20 border-crimson-500/50 text-crimson-300' : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-600 hover:text-crimson-400 hover:border-crimson-600'}`}
            >
              <Download className="w-4 h-4" /> Downloads {downloadEnabled ? 'on' : 'off'}
            </button>
          </div>
        </form>

        {mounts && (
          <div className="relative z-10 space-y-2">
            {mounts.length === 0 ? (
              <p className="text-[11px] text-crimson-700 font-bold italic">No candidate mounts detected. Type the in-container path above.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mounts.map((m) => {
                  const st = localStatus(m);
                  return (
                    <button
                      key={m.path}
                      type="button"
                      onClick={() => applyMount(m)}
                      disabled={m.already_added}
                      className="text-left p-3 rounded-xl bg-crimson-950/40 border border-crimson-900/60 hover:border-crimson-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3"
                    >
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
      </div>

      {loading ? (
        <div className="py-16 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Loading sources…</div>
      ) : sources.length === 0 ? (
        <p className="py-16 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">No local sources registered yet</p>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => {
            const st = localStatus(s.status);
            return (
              <div key={s.id} className={`border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all ${s.enabled ? 'bg-crimson-950/40 border-crimson-900/50' : 'bg-crimson-950/20 border-crimson-900/30 opacity-60'}`}>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-crimson-50 truncate">{s.label}</span>
                    {s.enabled
                      ? <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-400">Enabled</span>
                      : <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-900/40 border border-crimson-800/50 text-crimson-600">Disabled</span>}
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${st.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-crimson-500/10 border-crimson-500/30 text-crimson-500'}`}>{st.text}</span>
                    {s.encoding && (
                      <span title="Transcoding non-web containers to HLS on the fly" className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-500/10 border border-crimson-500/30 text-crimson-300 flex items-center gap-1">
                        <Film className="w-2.5 h-2.5" /> Transcoding
                      </span>
                    )}
                    {s.download_enabled && (
                      <span title={s.downloads?.free_bytes != null ? `${formatBytes(s.downloads.free_bytes)} free · ${s.downloads.titles ?? 0} downloaded title(s)` : 'Downloads land here under /crimson-downloads'} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-500/10 border border-crimson-500/30 text-crimson-300 flex items-center gap-1">
                        <Download className="w-2.5 h-2.5" /> Downloads{s.downloads?.free_bytes != null ? ` · ${formatBytes(s.downloads.free_bytes)} free` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-crimson-500/80 mt-1.5 truncate">{s.path}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    title={!encodingSupported ? 'ffmpeg/ffprobe not found in the backend image' : (s.encoding ? 'Disable transcoding' : 'Enable transcoding (MKV, HEVC…)')}
                    disabled={busyId === s.id || !encodingSupported}
                    onClick={() => toggleEncoding(s)}
                    className={`p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${s.encoding ? 'text-crimson-300 hover:border-crimson-500/50 hover:bg-crimson-500/10' : 'text-crimson-600 hover:border-crimson-500/50 hover:bg-crimson-500/10'}`}
                  >
                    <Film className="w-4 h-4" />
                  </button>
                  <button
                    title={s.download_enabled ? 'Disable downloads into this source' : 'Enable downloads into this source (crimson-downloads/)'}
                    disabled={busyId === s.id}
                    onClick={() => toggleDownloads(s)}
                    className={`p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${s.download_enabled ? 'text-crimson-300 hover:border-crimson-500/50 hover:bg-crimson-500/10' : 'text-crimson-600 hover:border-crimson-500/50 hover:bg-crimson-500/10'}`}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    title={s.enabled ? 'Disable' : 'Enable'}
                    disabled={busyId === s.id}
                    onClick={() => toggle(s)}
                    className={`p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 transition-all disabled:opacity-40 ${s.enabled ? 'text-green-400 hover:border-green-500/50 hover:bg-green-500/10' : 'text-crimson-500 hover:border-crimson-500/50 hover:bg-crimson-500/10'}`}
                  >
                    {s.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button
                    title="Remove source"
                    disabled={busyId === s.id}
                    onClick={() => remove(s)}
                    className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-500 hover:border-crimson-500 hover:bg-crimson-600/20 transition-all disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
