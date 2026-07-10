// Admin › Security tab — the gatekeeper's ledger. Consumes the backend's
// security-event log (/admin/security/stats + /admin/security/events): 24h
// threat tiles, a per-day activity chart, top offending IPs, the most-targeted
// identities, and the filterable raw ledger underneath. The chart is plain
// flex-divs (no chart lib) so the bundle stays lean.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crosshair, Gauge, RefreshCw, ScrollText, Search, ShieldX,
  Ticket, UserPlus, X,
} from 'lucide-react';

import { adminApi } from '../adminApi';
import { StatCard } from './ui';
import { fmtDate } from './format';

const WINDOWS = [7, 14, 30, 90];
const PAGE_SIZE = 25;

// Label + chip tone per event type the backend emits. Unknown types fall back
// to a neutral chip, so a backend that learns a new event needs no client change.
const EVENT_META = {
  login_success:            { label: 'Login',             tone: 'green' },
  login_failed:             { label: 'Failed Login',      tone: 'red' },
  login_unverified:         { label: 'Unverified Login',  tone: 'amber' },
  register_success:         { label: 'Signup',            tone: 'green' },
  register_blocked:         { label: 'Signup Blocked',    tone: 'red' },
  invite_invalid:           { label: 'Bad Invite',        tone: 'red' },
  email_verified:           { label: 'Email Verified',    tone: 'green' },
  verify_failed:            { label: 'Bad Verify Link',   tone: 'red' },
  verify_resend_requested:  { label: 'Verify Resend',     tone: 'dim' },
  password_reset_requested: { label: 'Reset Requested',   tone: 'dim' },
  password_reset_success:   { label: 'Password Reset',    tone: 'green' },
  password_reset_failed:    { label: 'Bad Reset Link',    tone: 'red' },
  rate_limited:             { label: 'Rate Limited',      tone: 'amber' },
  admin_action:             { label: 'Admin Action',      tone: 'amber' },
};

const TONE_CHIP = {
  green: 'bg-green-500/10 border-green-500/30 text-green-400',
  red:   'bg-crimson-500/10 border-crimson-500/40 text-crimson-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  dim:   'bg-crimson-900/30 border-crimson-800/50 text-crimson-500',
};

const eventMeta = (type) => EVENT_META[type] || { label: type || '—', tone: 'dim' };

const EventChip = ({ type }) => {
  const m = eventMeta(type);
  return (
    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border whitespace-nowrap ${TONE_CHIP[m.tone]}`}>
      {m.label}
    </span>
  );
};

// Compact "k: v · k: v" rendering of an event's detail blob for the ledger rows.
const detailSummary = (detail) => {
  if (!detail || typeof detail !== 'object') return null;
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`);
  return parts.length ? parts.join(' · ') : null;
};

const SectionHeading = ({ icon: Icon, children }) => (
  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-crimson-500 flex items-center gap-3">
    <Icon className="w-4 h-4" /> {children} <div className="h-px bg-crimson-900/30 flex-grow" />
  </h3>
);

// Per-day activity bars: a dim column for all events with the denials burning
// brighter inside it. Pure CSS/flex — hover a column for the exact numbers.
const ActivityChart = ({ series }) => {
  const max = Math.max(1, ...series.map((d) => d.total));
  const labelStep = Math.max(1, Math.ceil(series.length / 10));
  return (
    <div className="bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 rounded-3xl p-6 shadow-inner">
      <div className="flex items-end gap-[3px] h-40">
        {series.map((d, i) => {
          const totalH = Math.round((d.total / max) * 100);
          const failH = Math.round((d.failures / max) * 100);
          const label = new Date(`${d.day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return (
            <div
              key={d.day}
              className="flex-1 h-full flex flex-col justify-end group relative min-w-0"
              title={`${label} — ${d.total} event${d.total === 1 ? '' : 's'} · ${d.failures} denial${d.failures === 1 ? '' : 's'}`}
            >
              <div className="relative w-full flex flex-col justify-end" style={{ height: '100%' }}>
                <div
                  className="w-full rounded-t-sm bg-crimson-900/50 group-hover:bg-crimson-800/60 transition-colors"
                  style={{ height: `${d.total > 0 ? Math.max(totalH, 2) : 0}%` }}
                />
                <div
                  className="w-full rounded-t-sm bg-crimson-500 shadow-[0_0_8px_rgba(255,0,60,0.4)] absolute bottom-0"
                  style={{ height: `${d.failures > 0 ? Math.max(failH, 2) : 0}%` }}
                />
              </div>
              <p className={`text-[8px] font-black text-crimson-700 text-center mt-1.5 truncate ${i % labelStep === 0 ? '' : 'invisible'}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-5 mt-4">
        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-crimson-600">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-crimson-900/60" /> All events
        </span>
        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-crimson-400">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-crimson-500 shadow-[0_0_8px_rgba(255,0,60,0.4)]" /> Denials
        </span>
      </div>
    </div>
  );
};

export default function SecurityTab({ notify }) {
  const [days, setDays] = useState(14);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Ledger filters + paging.
  const [typeFilter, setTypeFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [ledger, setLedger] = useState({ events: [], total: 0, event_types: [] });
  const [loadingLedger, setLoadingLedger] = useState(true);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await adminApi.securityStats(days);
      if (res.success) setStats(res);
      else notify('Failed to load security stats', false);
    } catch { notify('Failed to load security stats', false); }
    finally { setLoadingStats(false); }
  }, [days, notify]);

  const loadLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const res = await adminApi.securityEvents({
        event_type: typeFilter, outcome: outcomeFilter, ip: ipFilter,
        search: query, limit: PAGE_SIZE, offset,
      });
      if (res.success) setLedger(res);
      else notify('Failed to load the ledger', false);
    } catch { notify('Failed to load the ledger', false); }
    finally { setLoadingLedger(false); }
  }, [typeFilter, outcomeFilter, ipFilter, query, offset, notify]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadLedger(); }, [loadLedger]);

  const tiles = stats?.tiles || {};
  const typeOptions = ledger.event_types?.length ? ledger.event_types : Object.keys(EVENT_META);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(ledger.total / PAGE_SIZE));
  const anyFilter = typeFilter || outcomeFilter || ipFilter || query;

  const resetPagingAnd = (setter) => (value) => { setOffset(0); setter(value); };
  const setType = resetPagingAnd(setTypeFilter);
  const setOutcome = resetPagingAnd(setOutcomeFilter);
  const setIp = resetPagingAnd(setIpFilter);

  const failureTypes = useMemo(
    () => (stats?.by_type || []).filter((t) => t.outcome === 'failure'),
    [stats],
  );

  return (
    <div className="space-y-10">
      {/* Window selector + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                days === w
                  ? 'bg-crimson-600 text-white shadow-[0_6px_18px_rgba(255,0,60,0.25)]'
                  : 'bg-crimson-950/40 border border-crimson-900/60 text-crimson-500 hover:text-white hover:border-crimson-600'
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {stats?.retention_days && (
            <p className="text-[9px] font-black uppercase tracking-widest text-crimson-800">
              Ledger keeps {stats.retention_days} days
            </p>
          )}
          <button
            onClick={() => { loadStats(); loadLedger(); }}
            className="group flex items-center gap-2 px-4 py-2 bg-crimson-950/40 border border-crimson-900/60 rounded-xl text-crimson-400 hover:text-white hover:border-crimson-500 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : 'group-hover:rotate-90 transition-transform'}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Threat tiles */}
      <section className="space-y-4">
        <SectionHeading icon={Crosshair}>The Watchtower</SectionHeading>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Failed Logins (24h)" value={tiles.failed_logins_24h} icon={ShieldX} accent={tiles.failed_logins_24h > 0 ? 'text-crimson-500' : 'text-green-400'} />
          <StatCard label="Bad Invites (24h)" value={tiles.invite_rejections_24h} icon={Ticket} accent={tiles.invite_rejections_24h > 0 ? 'text-crimson-500' : 'text-green-400'} />
          <StatCard label="Rate Limited (24h)" value={tiles.rate_limited_24h} icon={Gauge} accent={tiles.rate_limited_24h > 0 ? 'text-amber-400' : 'text-green-400'} />
          <StatCard label="Offending IPs (24h)" value={tiles.offending_ips_24h} sub="distinct sources of denials" icon={Crosshair} accent={tiles.offending_ips_24h > 0 ? 'text-amber-400' : 'text-green-400'} />
          <StatCard label={`Signups (${days}d)`} value={tiles.signups_window} icon={UserPlus} accent="text-green-400" />
          <StatCard label={`Events (${days}d)`} value={tiles.events_window} sub="everything the ledger saw" icon={ScrollText} />
        </div>
      </section>

      {/* Per-day activity chart */}
      <section className="space-y-4">
        <SectionHeading icon={Gauge}>Activity at the Gates</SectionHeading>
        {loadingStats && !stats ? (
          <div className="py-16 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Consulting the ledger…</div>
        ) : (
          <ActivityChart series={stats?.series || []} />
        )}
        {failureTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pl-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-crimson-700">Denials by kind:</span>
            {failureTypes.map((t) => (
              <button key={t.event_type} onClick={() => setType(t.event_type)} title="Filter the ledger to this kind" className="hover:scale-105 transition-transform">
                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${TONE_CHIP[eventMeta(t.event_type).tone]}`}>
                  {eventMeta(t.event_type).label} · {t.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Offenders + targets */}
      <div className="grid lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <SectionHeading icon={Crosshair}>Top Offenders</SectionHeading>
          <div className="space-y-2.5">
            {(stats?.top_ips || []).map((o, i) => (
              <button
                key={o.ip}
                onClick={() => setIp(o.ip)}
                title="Filter the ledger to this IP"
                className="w-full text-left bg-crimson-950/30 border border-crimson-900/40 rounded-2xl p-4 hover:border-crimson-500/50 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-crimson-50 font-mono truncate">
                    <span className="text-crimson-700 mr-2">#{i + 1}</span>{o.ip}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-crimson-500 whitespace-nowrap">{o.count} denial{o.count === 1 ? '' : 's'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {Object.entries(o.types || {}).map(([t, n]) => (
                    <span key={t} className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${TONE_CHIP[eventMeta(t).tone]}`}>
                      {eventMeta(t).label} · {n}
                    </span>
                  ))}
                  <span className="text-[9px] font-bold text-crimson-700 ml-auto">last seen {fmtDate(o.last_seen)}</span>
                </div>
              </button>
            ))}
            {(!stats?.top_ips || stats.top_ips.length === 0) && !loadingStats && (
              <p className="py-10 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">No offenders in this window — the gates stand quiet</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading icon={ShieldX}>Targeted Identities</SectionHeading>
          <div className="space-y-2.5">
            {(stats?.top_identities || []).map((t) => (
              <div key={t.identity} className="bg-crimson-950/30 border border-crimson-900/40 rounded-2xl p-4 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-crimson-50 truncate">{t.identity}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-crimson-500 whitespace-nowrap">
                  {t.count} denial{t.count === 1 ? '' : 's'} · {fmtDate(t.last_seen)}
                </span>
              </div>
            ))}
            {(!stats?.top_identities || stats.top_identities.length === 0) && !loadingStats && (
              <p className="py-10 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">No souls under siege</p>
            )}
          </div>
        </section>
      </div>

      {/* The raw ledger */}
      <section className="space-y-4">
        <SectionHeading icon={ScrollText}>The Ledger</SectionHeading>

        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={(e) => { e.preventDefault(); setOffset(0); setQuery(search); }}
            className="relative flex-grow min-w-[200px]"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search identity or IP…"
              className="w-full pl-11 pr-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-700 text-sm font-bold focus:outline-none focus:border-crimson-500 transition-all"
            />
          </form>
          <select
            value={typeFilter}
            onChange={(e) => setType(e.target.value)}
            className="px-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-300 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-crimson-500"
          >
            <option value="">All kinds</option>
            {typeOptions.map((t) => <option key={t} value={t}>{eventMeta(t).label}</option>)}
          </select>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcome(e.target.value)}
            className="px-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-300 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-crimson-500"
          >
            <option value="">All outcomes</option>
            <option value="failure">Denials</option>
            <option value="success">Granted</option>
            <option value="info">Notes</option>
          </select>
          {ipFilter && (
            <button
              onClick={() => setIp('')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-crimson-600/20 border border-crimson-500/50 text-crimson-300 text-[10px] font-black uppercase tracking-widest hover:bg-crimson-600/30 transition-all"
            >
              IP {ipFilter} <X className="w-3 h-3" />
            </button>
          )}
          {anyFilter && !ipFilter && (
            <button
              onClick={() => { setTypeFilter(''); setOutcomeFilter(''); setSearch(''); setQuery(''); setOffset(0); }}
              className="text-[10px] font-black uppercase tracking-widest text-crimson-600 hover:text-crimson-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-crimson-700">
          {ledger.total} event{ledger.total === 1 ? '' : 's'} on record{anyFilter ? ' (filtered)' : ''}
        </p>

        {loadingLedger ? (
          <div className="py-16 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Consulting the ledger…</div>
        ) : (
          <div className="space-y-2">
            {ledger.events.map((ev) => (
              <div key={ev.id} className="bg-crimson-950/30 border border-crimson-900/40 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:border-crimson-900/80 transition-all">
                <div className="flex items-center gap-3 flex-shrink-0 sm:w-56">
                  <EventChip type={ev.event_type} />
                  <span className="text-[10px] font-bold text-crimson-600 whitespace-nowrap">{fmtDate(ev.ts)}</span>
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-xs font-bold text-crimson-100 truncate">
                    {ev.identity || <span className="text-crimson-700 italic">unknown identity</span>}
                    {ev.user_id != null && <span className="text-crimson-600 font-black ml-2">#{ev.user_id}</span>}
                  </p>
                  {detailSummary(ev.detail) && (
                    <p className="text-[10px] font-bold text-crimson-600 truncate mt-0.5">{detailSummary(ev.detail)}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  {ev.ip && (
                    <button
                      onClick={() => setIp(ev.ip)}
                      title="Filter the ledger to this IP"
                      className="text-[10px] font-black font-mono text-crimson-500 hover:text-crimson-300 transition-colors"
                    >
                      {ev.ip}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {ledger.events.length === 0 && (
              <p className="py-16 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">
                {anyFilter ? 'Nothing matches these filters' : 'The ledger is spotless — no one has rattled the gates'}
              </p>
            )}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="px-4 py-2 rounded-xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:hover:text-crimson-400 disabled:hover:border-crimson-900/60"
            >
              Prev
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-crimson-600">Page {page} / {pages}</span>
            <button
              disabled={offset + PAGE_SIZE >= ledger.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="px-4 py-2 rounded-xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:hover:text-crimson-400 disabled:hover:border-crimson-900/60"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
