// Admin › Invites tab — mint single-use invite codes + the ledger of existing
// ones (copy / revoke). Lifted verbatim from Admin.jsx.
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Copy, Plus, RefreshCw, Ticket, Trash2 } from 'lucide-react';

import { adminApi } from '../adminApi';
import { fmtDate } from './format';

export default function InvitesTab({ notify }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(1);
  const [ttl, setTtl] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listInvites({ include_used: true, limit: 200 });
      if (res.success) setInvites(res.invites);
    } catch { notify('Failed to load invites', false); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body = { count: Number(count) };
      if (ttl) body.ttl_hours = Number(ttl);
      const res = await adminApi.createInvites(body);
      if (res.success) { notify(`Minted ${res.count} invite${res.count === 1 ? '' : 's'}`, true); await load(); }
      else notify(res.error || res.detail || 'Failed to mint', false);
    } catch { notify('Failed to mint invites', false); }
    finally { setCreating(false); }
  };

  const copy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const revoke = async (code) => {
    try {
      const res = await adminApi.revokeInvite(code);
      if (res.success) { notify('Invite revoked', true); await load(); }
      else notify(res.error || res.detail || 'Could not revoke', false);
    } catch { notify('Could not revoke', false); }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="bg-crimson-950/40 border border-crimson-900/50 rounded-3xl p-6 space-y-5">
        <h3 className="text-sm font-black text-crimson-50 uppercase tracking-tighter flex items-center gap-2"><Ticket className="w-5 h-5 text-crimson-500" /> Mint Invite Codes</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-2 flex-1">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">How many (1–50)</label>
            <input type="number" min="1" max="50" value={count} onChange={(e) => setCount(e.target.value)} className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold focus:outline-none focus:border-crimson-500" />
          </div>
          <div className="space-y-2 flex-1">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-crimson-600 ml-1">Expires after (hours, optional)</label>
            <input type="number" min="1" value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="Never" className="w-full px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold placeholder-crimson-700 focus:outline-none focus:border-crimson-500" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={creating} className="px-6 py-3 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 h-[46px]">
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Mint</>}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-crimson-700 font-bold leading-relaxed">Single-use codes — recipients paste them into the signup form's invite field. Same contract as the Discord bot.</p>
      </form>

      {loading ? (
        <div className="py-16 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Loading ledger…</div>
      ) : (
        <div className="space-y-3">
          {invites.map((inv) => (
            <div key={inv.code} className={`border rounded-2xl p-4 flex items-center gap-4 transition-all ${inv.used_at ? 'bg-crimson-950/20 border-crimson-900/30 opacity-60' : 'bg-crimson-950/40 border-crimson-900/50'}`}>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm font-black text-crimson-300 tracking-wider font-mono select-all">{inv.code}</code>
                  {inv.used_at
                    ? <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-900/40 border border-crimson-800/50 text-crimson-600">Used</span>
                    : <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-400">Unused</span>}
                </div>
                <p className="text-[10px] font-bold text-crimson-700 mt-1 tracking-wide truncate">
                  by {inv.created_by || '—'} · {fmtDate(inv.created_at)}
                  {inv.expires_at ? ` · expires ${fmtDate(inv.expires_at)}` : ''}
                  {inv.used_by ? ` · used by ${inv.used_by}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!inv.used_at && (
                  <>
                    <button onClick={() => copy(inv.code)} title="Copy" className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-300 hover:border-crimson-500/50 transition-all">
                      {copied === inv.code ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button onClick={() => revoke(inv.code)} title="Revoke" className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-500 hover:border-crimson-500 hover:bg-crimson-600/20 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {invites.length === 0 && (
            <p className="py-16 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">No invites minted yet</p>
          )}
        </div>
      )}
    </div>
  );
}
