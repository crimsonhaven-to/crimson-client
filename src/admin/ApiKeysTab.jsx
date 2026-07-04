// Admin › Bridge Keys tab — forge/revoke movie-web bridge API keys, with the
// one-time raw-key reveal panel. Lifted verbatim from Admin.jsx.
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Copy, Eye, EyeOff, KeyRound, Plug, Plus, RefreshCw, Trash2, X } from 'lucide-react';

import { adminApi } from '../adminApi';
import { fmtDate } from './format';

export default function ApiKeysTab({ notify }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  // The raw key is returned by the backend exactly once, at creation. Hold it in
  // a one-time reveal panel until the keeper copies + dismisses it; it's never
  // recoverable afterwards (only its hash is stored).
  const [minted, setMinted] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listApiKeys({ include_revoked: true });
      if (res.success) setKeys(res.keys);
      else notify('Failed to load bridge keys', false);
    } catch { notify('Failed to load bridge keys', false); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await adminApi.createApiKey({ label: label.trim() || null });
      if (res.success) {
        setMinted(res);
        setRevealed(false);
        setCopiedRaw(false);
        setLabel('');
        notify('Bridge key forged — copy it now', true);
        await load();
      } else notify(res.detail || res.error || 'Failed to forge key', false);
    } catch { notify('Failed to forge key', false); }
    finally { setCreating(false); }
  };

  const copyRaw = () => {
    if (!minted?.key) return;
    navigator.clipboard.writeText(minted.key);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 1800);
  };

  const revoke = async (k) => {
    if (!window.confirm(`Revoke this bridge key${k.label ? ` ("${k.label}")` : ''}? Any movie-web vessel using it loses access to the bridge within ~a minute. This cannot be undone.`)) return;
    setBusyId(k.id);
    try {
      const res = await adminApi.revokeApiKey(k.id);
      if (res.success) { notify('Bridge key revoked', true); await load(); }
      else notify(res.detail || res.error || 'Could not revoke', false);
    } catch { notify('Could not revoke', false); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-8">
      {/* Mint form */}
      <form onSubmit={create} className="bg-crimson-950/40 border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 space-y-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-crimson-500/5 blur-3xl rounded-full" />
        <div className="flex items-center gap-3 relative z-10">
          <Plug className="w-7 h-7 text-crimson-500" />
          <div>
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Movie-Web Bridge Keys</h3>
            <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest">Machine sigils that let an outer vessel speak to the haven</p>
          </div>
        </div>
        <p className="text-xs text-crimson-300/70 font-medium leading-relaxed relative z-10 max-w-3xl">
          A bridge key lets a modified <span className="text-crimson-400 font-bold">movie-web</span> fork pull streams from the haven instead of scraping on its own. The key is baked into that fork's <span className="text-crimson-400 font-bold">cors-proxy</span> — never the browser — and is scoped to the <code className="font-mono text-crimson-400">/mw</code> bridge alone: it can summon streams and <span className="text-crimson-400 font-bold">nothing else</span> — no members, no sanctum, no catalogue.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
          <div className="space-y-2 flex-1">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
              placeholder="e.g. movie-web prod"
              className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold placeholder-crimson-700 focus:outline-none focus:border-crimson-500"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={creating} className="px-6 py-3 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 h-[46px]">
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Forge Key</>}
            </button>
          </div>
        </div>
      </form>

      {/* One-time reveal of the freshly minted raw key */}
      {minted && (
        <div className="bg-amber-950/20 border border-amber-700/40 rounded-[2rem] p-6 sm:p-7 space-y-4 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-start gap-3">
            <KeyRound className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-grow min-w-0">
              <h4 className="text-sm font-black text-amber-200 uppercase tracking-tighter">Your new bridge key</h4>
              <p className="text-[11px] font-bold text-amber-400/80 leading-relaxed mt-1">
                Copy it into the fork's proxy secret <span className="underline decoration-amber-500/50">now</span> — this sigil is shown but once. The haven keeps only its shadow (a hash); it can be revoked and replaced, never recovered.
              </p>
            </div>
            <button onClick={() => setMinted(null)} title="Dismiss" className="p-1.5 rounded-lg text-amber-500/70 hover:text-amber-300 hover:bg-amber-500/10 transition-all flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-grow min-w-0 px-4 py-3 bg-black/40 border border-amber-800/40 rounded-2xl text-amber-200 text-xs sm:text-sm font-mono break-all select-all">
              {revealed ? minted.key : minted.key.replace(/./g, '•')}
            </code>
            <button onClick={() => setRevealed((v) => !v)} title={revealed ? 'Hide' : 'Reveal'}
              className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-300 hover:border-amber-500/60 transition-all flex-shrink-0">
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={copyRaw} title="Copy"
              className="p-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-crimson-50 transition-all flex-shrink-0">
              {copiedRaw ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Ledger */}
      {loading ? (
        <div className="py-16 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Reading the keyring…</div>
      ) : keys.length === 0 ? (
        <p className="py-16 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">No bridge keys forged yet</p>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div key={k.id} className={`border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all ${k.revoked ? 'bg-crimson-950/20 border-crimson-900/30 opacity-60' : 'bg-crimson-950/40 border-crimson-900/50'}`}>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-crimson-50 truncate">{k.label || 'Unlabelled key'}</span>
                  {k.revoked
                    ? <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-900/40 border border-crimson-800/50 text-crimson-600">Revoked</span>
                    : <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-400">Active</span>}
                  <code className="text-[11px] font-mono text-crimson-400 bg-crimson-950/60 border border-crimson-900/60 rounded-md px-2 py-0.5 select-all">{k.key_prefix}…</code>
                </div>
                <p className="text-[10px] font-bold text-crimson-700 mt-1.5 tracking-wide truncate">
                  by {k.created_by || '—'} · forged {fmtDate(k.created_at)} · last seen {fmtDate(k.last_used_at)}
                  {k.revoked && k.revoked_at ? ` · revoked ${fmtDate(k.revoked_at)}` : ''}
                </p>
              </div>
              {!k.revoked && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => revoke(k)} disabled={busyId === k.id} title="Revoke key"
                    className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-500 hover:border-crimson-500 hover:bg-crimson-600/20 transition-all disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
