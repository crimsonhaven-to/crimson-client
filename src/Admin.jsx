import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Users, Ticket, Server, RefreshCw, Search, Trash2, LogOut,
  Copy, CheckCircle2, AlertCircle, Plus, Activity, Database, Crown,
  ShieldCheck, ShieldOff, Mail, Zap, X,
  HardDrive, FolderOpen, FolderSearch, Power, PowerOff,
  Film, Languages, DownloadCloud, Pencil,
  HeartPulse, Cpu, Clock, Gauge, Boxes, Radio, Wifi, WifiOff, ExternalLink,
  KeyRound, Plug, Eye, EyeOff,
} from 'lucide-react';
import { useTitle, useProfile, adminApi } from './hooks';

// ---------- status vocabulary (shared by the health views) ----------
// One palette + label per status string the backend emits, so colours stay
// consistent across the summary strip, the source rows and the overview teaser.
const STATUS_META = {
  ok:        { label: 'Healthy',  dot: 'bg-green-400',  text: 'text-green-300',  ring: 'border-green-700/40',  glow: 'shadow-[0_0_10px_rgba(74,222,128,0.5)]' },
  active:    { label: 'Active',   dot: 'bg-green-400',  text: 'text-green-300',  ring: 'border-green-700/40',  glow: 'shadow-[0_0_10px_rgba(74,222,128,0.5)]' },
  empty:     { label: 'Empty',    dot: 'bg-amber-400',  text: 'text-amber-300',  ring: 'border-amber-700/40',  glow: 'shadow-[0_0_10px_rgba(251,191,36,0.5)]' },
  idle:      { label: 'Idle',     dot: 'bg-amber-400',  text: 'text-amber-300',  ring: 'border-amber-700/40',  glow: 'shadow-[0_0_10px_rgba(251,191,36,0.5)]' },
  error:     { label: 'Down',     dot: 'bg-crimson-500', text: 'text-crimson-400', ring: 'border-crimson-600/50', glow: 'shadow-[0_0_10px_rgba(255,0,60,0.5)]' },
  disabled:  { label: 'Dormant',  dot: 'bg-crimson-900', text: 'text-crimson-600', ring: 'border-crimson-900/50', glow: '' },
};
const statusMeta = (s) => STATUS_META[s] || { label: s || '—', dot: 'bg-crimson-700', text: 'text-crimson-500', ring: 'border-crimson-900/50', glow: '' };

const StatusDot = ({ status }) => {
  const m = statusMeta(status);
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${m.dot} ${m.glow} ${status === 'active' || status === 'ok' ? 'animate-pulse' : ''}`} />;
};

// A small on/off capability badge (used in the System flags grid).
const FlagBadge = ({ on, label, onIcon: OnIcon = Wifi, offIcon: OffIcon = WifiOff }) => (
  <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${
    on ? 'bg-green-950/30 border-green-800/40 text-green-300' : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-700'
  }`}>
    {on ? <OnIcon className="w-3.5 h-3.5" /> : <OffIcon className="w-3.5 h-3.5" />}
    <span className="truncate">{label}</span>
  </div>
);

// ---------- small presentational helpers ----------
const StatCard = ({ label, value, sub, icon: Icon, accent }) => (
  <div className="bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/50 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-crimson-500/30 transition-all">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-crimson-500/5 blur-3xl rounded-full" />
    <div className="flex items-center justify-between mb-3 relative z-10">
      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-crimson-600 group-hover:text-crimson-500 transition-colors">{label}</p>
      {Icon && <Icon className={`w-4 h-4 ${accent || 'text-crimson-700'}`} />}
    </div>
    <p className="text-3xl sm:text-4xl font-black text-white tracking-tighter relative z-10">{value ?? '—'}</p>
    {sub && <p className="text-[10px] font-bold text-crimson-500/70 mt-1.5 relative z-10">{sub}</p>}
  </div>
);

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active
        ? 'bg-crimson-600 text-white shadow-[0_10px_25px_rgba(255,0,60,0.25)]'
        : 'bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600'
    }`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  const ok = toast.type === 'ok';
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-bottom-4 duration-300 ${
      ok ? 'bg-green-950/80 border-green-700/50 text-green-200' : 'bg-crimson-950/90 border-crimson-600/50 text-crimson-200'
    }`}>
      {ok ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-crimson-500" />}
      <span className="text-xs font-bold max-w-xs">{toast.msg}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
    </div>
  );
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

// ---------- tabs ----------
function OverviewTab({ stats, health, system }) {
  const a = stats?.accounts || {};
  const c = stats?.content || {};
  const p = system?.db_pool || {};
  return (
    <div className="space-y-10">
      {system && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
            <Activity className="w-4 h-4" /> At a Glance <div className="h-px bg-crimson-900/30 flex-grow" />
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Version" value={`v${system.version}`} sub={`up ${system.uptime_human}`} icon={Shield} accent="text-crimson-500" />
            <StatCard label="Sources" value={system.registry?.scrapers} sub={`${system.registry?.resolvers ?? 0} resolvers`} icon={Boxes} accent="text-green-400" />
            <StatCard label="DB Pool" value={p.available ? `${p.in_use}/${p.max_size}` : '—'} sub={p.available ? `${p.idle ?? 0} idle · ${p.waiting ?? 0} waiting` : 'pool closed'} icon={Gauge} accent={p.waiting > 0 ? 'text-amber-400' : undefined} />
            <StatCard label="Video Cache" value={system.cache?.enabled ? (system.cache?.ready ?? 0) : 'Off'} sub={system.cache?.enabled ? `${system.cache?.pending ?? 0} pending · ${system.cache?.targets_enabled ?? 0} targets` : 'caching disabled'} icon={DownloadCloud} accent={system.cache?.enabled ? 'text-green-400' : 'text-crimson-700'} />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
          <Users className="w-4 h-4" /> Members <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={a.users_total} icon={Users} accent="text-crimson-500" />
          <StatCard label="Verified" value={a.users_verified} sub={`${a.users_email ?? 0} email · ${a.users_mnemonic ?? 0} mnemonic`} icon={Mail} />
          <StatCard label="Admins" value={a.users_admin} icon={Crown} accent="text-amber-400" />
          <StatCard label="Active Sessions" value={a.sessions_active} icon={Activity} accent="text-green-400" />
          <StatCard label="New (24h)" value={a.users_new_24h} icon={Zap} />
          <StatCard label="New (7d)" value={a.users_new_7d} icon={Zap} />
          <StatCard label="Invites Unused" value={a.invites_unused} sub={`${a.invites_used ?? 0} used · ${a.invites_total ?? 0} total`} icon={Ticket} />
          <StatCard label="Favorites" value={a.favorites_total} sub={`${a.progress_total ?? 0} progress rows`} icon={CheckCircle2} />
          <StatCard label="Watching" value={a.progress_in_progress} sub={`${a.progress_completed ?? 0} completed`} icon={Film} accent="text-green-400" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
          <Database className="w-4 h-4" /> Content Catalogue <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Anime Entries" value={c.anime_entries} icon={Database} accent="text-crimson-500" />
          <StatCard label="TMDB Seasons" value={c.tmdb_seasons} icon={Database} />
          <StatCard label="TMDB Extras" value={c.tmdb_extras} icon={Database} />
          <StatCard label="Cached Shows" value={c.tmdb_shows} sub={`${c.tmdb_movies ?? 0} movies · ${c.api_cache ?? 0} cache rows`} icon={Database} />
        </div>
        <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest pl-1">
          Last mapping sync: <span className="text-crimson-400">{fmtDate(c.last_synced)}</span>
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
          <Server className="w-4 h-4" /> Node Health <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>
        <div className="bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 p-6 rounded-3xl font-mono text-[11px] space-y-2 shadow-inner">
          {health ? Object.entries(health).map(([k, v]) => (
            <p key={k} className="text-crimson-400/80 group">
              <span className="text-crimson-600 font-black mr-2">/</span>
              <span className="font-black uppercase tracking-wider text-crimson-700">{k}:</span>{' '}
              <span className="text-crimson-100">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
            </p>
          )) : <p className="text-crimson-600 animate-pulse">Probing node…</p>}
        </div>
      </section>
    </div>
  );
}

function UsersTab({ notify }) {
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

function InvitesTab({ notify }) {
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
        <h3 className="text-sm font-black text-white uppercase tracking-tighter flex items-center gap-2"><Ticket className="w-5 h-5 text-crimson-500" /> Mint Invite Codes</h3>
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

function ApiKeysTab({ notify }) {
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
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Movie-Web Bridge Keys</h3>
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
              className="p-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white transition-all flex-shrink-0">
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

function SystemTab({ stats, system, notify, refreshStats }) {
  const [resync, setResync] = useState(stats?.resync || null);
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef(null);

  // Backfill (non-anime catalogue seed) — its own state + poller, same shape.
  const [backfill, setBackfill] = useState(null);
  const [backfillPages, setBackfillPages] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const backfillPollRef = useRef(null);

  useEffect(() => { setResync(stats?.resync || null); }, [stats]);

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

// Map a source's filesystem-probe into a one-line status with a colour cue.
const localStatus = (st) => {
  if (!st) return { text: 'Unknown', ok: false };
  if (!st.exists) return { text: 'Path not found in container', ok: false };
  if (!st.is_dir) return { text: 'Not a directory', ok: false };
  if (!st.readable) return { text: 'Not readable by backend', ok: false };
  const n = st.video_count ?? 0;
  return { text: `${n}${st.video_count_capped ? '+' : ''} playable file${n === 1 ? '' : 's'}`, ok: true };
};

function SourcesTab({ notify }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [path, setPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [mounts, setMounts] = useState(null);
  const [discovering, setDiscovering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listLocalSources();
      if (res.success) setSources(res.sources);
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
      const res = await adminApi.addLocalSource({ label: label.trim(), path: path.trim() });
      if (res.success) { notify('Local source added', true); setLabel(''); setPath(''); await load(); }
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
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Local Media Sources</h3>
            <p className="text-[10px] font-bold text-crimson-700 uppercase tracking-widest">Direct-play streaming from a NAS / mounted directory</p>
          </div>
        </div>
        <p className="text-xs text-crimson-300/70 font-medium leading-relaxed relative z-10 max-w-3xl">
          Register a directory the backend can read and the haven will match shows against the files inside it and stream them directly — no third-party scraper involved.
          The path is the one <span className="text-crimson-400 font-bold">inside the backend container</span>: bind-mount your library in <code className="font-mono text-crimson-400">docker-compose</code> (e.g. <code className="font-mono text-crimson-400">- /movies:/crimson/movies1</code>) and register <code className="font-mono text-crimson-400">/crimson/movies1</code> here.
          MVP is <span className="text-crimson-400 font-bold">direct play only</span>: browser-playable files (mp4 / m4v / mov / webm). Other containers (MKV, HEVC…) are skipped — they'd need transcoding.
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
                  </div>
                  <p className="text-[11px] font-mono text-crimson-500/80 mt-1.5 truncate">{s.path}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
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

// ---------- cache tab ----------
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

function CacheTab({ notify }) {
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
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Video Cache</h3>
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
          <h3 className="text-base font-black text-white uppercase tracking-tighter">Cache Targets</h3>
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
          <h3 className="text-base font-black text-white uppercase tracking-tighter flex-grow">Cached Episodes</h3>
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

// ---------- runtime section (reused by Overview + System) ----------
const fmtPct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');

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
    </div>
  );
}

// ---------- source health tab ----------
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

function HealthTab({ notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);

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

      <p className="text-[10px] font-medium text-crimson-700 leading-relaxed max-w-3xl">
        A <span className="text-green-400 font-bold">Healthy</span> streaming source resolved real embeds for the canary, so it would play right now. <span className="text-amber-300 font-bold">Empty</span> means the site answered but surfaced nothing (markup may have shifted). <span className="text-crimson-400 font-bold">Down</span> means it errored or was blocked. <span className="text-crimson-600 font-bold">Dormant</span> sources await their env keys. Library sources report what the haven itself holds.
      </p>
    </div>
  );
}

// ---------- page ----------
const AdminPage = () => {
  useTitle('Admin Sanctum');
  const profile = useProfile();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((msg, ok = true) => {
    setToast({ msg, type: ok ? 'ok' : 'err' });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      // Source health is deliberately left out — it probes 11 upstreams, so it
      // loads lazily inside its own tab rather than on every dashboard refresh.
      const [s, h, sys] = await Promise.all([adminApi.stats(), adminApi.health(), adminApi.system()]);
      if (s.success) setStats(s);
      setHealth(h);
      if (sys.success) setSystem(sys.system);
    } catch { /* surfaced as empty dashboard */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Access guard. profile === undefined/null while loading; once resolved, a
  // non-admin sees a refusal (the API would 403 anyway, this is just nicer).
  if (profile && !profile.is_admin) {
    return (
      <div className="max-w-md w-full mx-auto px-6 py-32 text-center space-y-6 animate-in fade-in duration-700">
        <ShieldOff className="w-14 h-14 text-crimson-600 mx-auto" />
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Access <span className="text-crimson-500">Denied</span></h2>
        <p className="text-xs text-crimson-400/60 font-medium leading-relaxed">This sanctum is reserved for the haven's keepers. Your vessel lacks the crimson seal.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-16 sm:py-20 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-crimson-500 drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" />
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter">Admin <span className="text-crimson-500">Sanctum</span></h2>
          </div>
          <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80 ml-1">Keeper controls for the dark network</p>
        </div>
        <button onClick={() => { setLoading(true); loadStats(); }} className="group flex items-center gap-2.5 px-5 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-400 hover:text-white hover:border-crimson-500 transition-all text-[10px] font-black uppercase tracking-widest self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-90 transition-transform'}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={Activity} label="Overview" />
        <TabButton active={tab === 'health'} onClick={() => setTab('health')} icon={HeartPulse} label="Health" />
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Users" />
        <TabButton active={tab === 'invites'} onClick={() => setTab('invites')} icon={Ticket} label="Invites" />
        <TabButton active={tab === 'sources'} onClick={() => setTab('sources')} icon={HardDrive} label="Sources" />
        <TabButton active={tab === 'cache'} onClick={() => setTab('cache')} icon={DownloadCloud} label="Cache" />
        <TabButton active={tab === 'keys'} onClick={() => setTab('keys')} icon={KeyRound} label="Bridge Keys" />
        <TabButton active={tab === 'system'} onClick={() => setTab('system')} icon={Server} label="System" />
      </div>

      <div>
        {tab === 'overview' && (loading && !stats
          ? <div className="py-24 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Gathering diagnostics…</div>
          : <OverviewTab stats={stats} health={health} system={system} />)}
        {tab === 'health' && <HealthTab notify={notify} />}
        {tab === 'users' && <UsersTab notify={notify} />}
        {tab === 'invites' && <InvitesTab notify={notify} />}
        {tab === 'sources' && <SourcesTab notify={notify} />}
        {tab === 'cache' && <CacheTab notify={notify} />}
        {tab === 'keys' && <ApiKeysTab notify={notify} />}
        {tab === 'system' && <SystemTab stats={stats} system={system} notify={notify} refreshStats={loadStats} />}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default AdminPage;
