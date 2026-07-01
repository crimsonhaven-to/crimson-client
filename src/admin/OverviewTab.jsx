// Admin › Overview tab — the at-a-glance stat grids (runtime, members, catalogue)
// plus the raw node-health dump. Lifted verbatim from Admin.jsx.
import {
  Activity, Boxes, CheckCircle2, Crown, Database, DownloadCloud,
  Film, Gauge, Mail, Server, Shield, Ticket, Users, Zap,
} from 'lucide-react';

import { StatCard } from './ui';
import { fmtDate } from './format';

export default function OverviewTab({ stats, health, system }) {
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
