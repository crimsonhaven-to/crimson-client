// Admin › Users tab — member search + per-user actions (grant/revoke admin, mark
// verified, revoke sessions, delete). Lifted verbatim from Admin.jsx.
import { useCallback, useEffect, useState } from 'react';
import { LogOut, Mail, Search, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';

import { useProfile } from '../hooks';
import { adminApi } from '../adminApi';
import { fmtDate } from './format';

export default function UsersTab({ notify }) {
  const profile = useProfile();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ search: query, limit: 100 });
      if (res.success) setData({ users: res.users, total: res.total });
      else notify('Failed to load users', false);
    } catch { notify('Failed to load users', false); }
    finally { setLoading(false); }
  }, [query, notify]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, fn, okMsg) => {
    setBusyId(id);
    try {
      const res = await fn();
      if (res.success) { notify(okMsg, true); await load(); }
      else notify(res.error || res.detail || 'Action failed', false);
    } catch { notify('Action failed', false); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => { e.preventDefault(); setQuery(search); }}
        className="flex items-center gap-3"
      >
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, name, label, or id…"
            className="w-full pl-11 pr-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-700 text-sm font-bold focus:outline-none focus:border-crimson-500 transition-all"
          />
        </div>
        <button type="submit" className="px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Search</button>
      </form>

      <p className="text-[10px] font-black uppercase tracking-widest text-crimson-700">{data.total} member{data.total === 1 ? '' : 's'} total</p>

      {loading ? (
        <div className="py-16 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Summoning members…</div>
      ) : (
        <div className="space-y-3">
          {data.users.map((u) => {
            const isSelf = profile?.user_id ? profile.user_id === u.user_id : (profile?.email && profile.email === u.email);
            return (
              <div key={u.user_id} className="bg-crimson-950/30 border border-crimson-900/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-crimson-900/80 transition-all">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-crimson-50 truncate">{u.email || u.label || `User #${u.user_id}`}</span>
                    {(u.username || u.display_name) && (
                      <span className="text-xs font-bold text-crimson-400 italic truncate max-w-[12rem]">“{u.username || u.display_name}”</span>
                    )}
                    {u.is_admin && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400">Admin</span>}
                    {u.email_verified
                      ? <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-400">Verified</span>
                      : u.email ? <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-500/10 border border-crimson-500/30 text-crimson-500">Unverified</span> : null}
                    {u.has_mnemonic && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-crimson-900/30 border border-crimson-800/50 text-crimson-400">Mnemonic</span>}
                  </div>
                  <p className="text-[10px] font-bold text-crimson-700 mt-1.5 tracking-wide">
                    #{u.user_id} · {u.favorites_count} favs · {u.progress_count} watched · {u.sessions_count} session{u.sessions_count === 1 ? '' : 's'} · joined {fmtDate(u.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    title={u.is_admin ? 'Revoke admin' : 'Grant admin'}
                    disabled={busyId === u.user_id}
                    onClick={() => act(u.user_id, () => adminApi.updateUser(u.user_id, { is_admin: !u.is_admin }), u.is_admin ? 'Admin revoked' : 'Admin granted')}
                    className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all disabled:opacity-40"
                  >
                    {u.is_admin ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </button>
                  {u.email && !u.email_verified && (
                    <button
                      title="Mark verified"
                      disabled={busyId === u.user_id}
                      onClick={() => act(u.user_id, () => adminApi.updateUser(u.user_id, { email_verified: true }), 'Marked verified')}
                      className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-green-400 hover:border-green-500/50 hover:bg-green-500/10 transition-all disabled:opacity-40"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    title="Revoke all sessions"
                    disabled={busyId === u.user_id || u.sessions_count === 0}
                    onClick={() => act(u.user_id, () => adminApi.revokeUserSessions(u.user_id), 'Sessions revoked')}
                    className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-400 hover:border-crimson-500/50 hover:bg-crimson-500/10 transition-all disabled:opacity-40"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                  <button
                    title={isSelf ? "You can't delete yourself" : 'Delete account'}
                    disabled={busyId === u.user_id || isSelf}
                    onClick={() => {
                      if (window.confirm(`Delete ${u.email || `user #${u.user_id}`}? This removes all their favorites, progress and sessions. This cannot be undone.`)) {
                        act(u.user_id, () => adminApi.deleteUser(u.user_id), 'Account deleted');
                      }
                    }}
                    className="p-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-500 hover:border-crimson-500 hover:bg-crimson-600/20 transition-all disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {data.users.length === 0 && (
            <p className="py-16 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">No members found</p>
          )}
        </div>
      )}
    </div>
  );
}
