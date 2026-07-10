// Admin dashboard shell.
//
// This file used to be one ~1,700-line module holding every tab's markup + logic.
// The tabs now live in src/admin/ (one file each) with their shared presentational
// atoms in src/admin/ui.jsx; this file is just the page frame: the access guard,
// the top-level stats/health/system fetch, the tab bar, and the toast host.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, Download, DownloadCloud, HardDrive, HeartPulse, KeyRound, RefreshCw,
  Server, Shield, ShieldAlert, ShieldOff, Ticket, Users,
} from 'lucide-react';

import { useTitle, useProfile } from './hooks';
import { adminApi } from './adminApi';
import { TabButton, Toast } from './admin/ui';
import OverviewTab from './admin/OverviewTab';
import HealthTab from './admin/HealthTab';
import UsersTab from './admin/UsersTab';
import InvitesTab from './admin/InvitesTab';
import SourcesTab from './admin/SourcesTab';
import CacheTab from './admin/CacheTab';
import DownloadsTab from './admin/DownloadsTab';
import ApiKeysTab from './admin/ApiKeysTab';
import SecurityTab from './admin/SecurityTab';
import SystemTab from './admin/SystemTab';

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
        <h2 className="text-3xl font-black text-crimson-50 uppercase tracking-tighter">Access <span className="text-crimson-500">Denied</span></h2>
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
            <h2 className="text-4xl sm:text-5xl font-black text-crimson-50 uppercase tracking-tighter">Admin <span className="text-crimson-500">Sanctum</span></h2>
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
        <TabButton active={tab === 'security'} onClick={() => setTab('security')} icon={ShieldAlert} label="Security" />
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Users" />
        <TabButton active={tab === 'invites'} onClick={() => setTab('invites')} icon={Ticket} label="Invites" />
        <TabButton active={tab === 'sources'} onClick={() => setTab('sources')} icon={HardDrive} label="Sources" />
        <TabButton active={tab === 'cache'} onClick={() => setTab('cache')} icon={DownloadCloud} label="Cache" />
        <TabButton active={tab === 'downloads'} onClick={() => setTab('downloads')} icon={Download} label="Downloads" />
        <TabButton active={tab === 'keys'} onClick={() => setTab('keys')} icon={KeyRound} label="Bridge Keys" />
        <TabButton active={tab === 'system'} onClick={() => setTab('system')} icon={Server} label="System" />
      </div>

      <div>
        {tab === 'overview' && (loading && !stats
          ? <div className="py-24 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Gathering diagnostics…</div>
          : <OverviewTab stats={stats} health={health} system={system} />)}
        {tab === 'health' && <HealthTab notify={notify} />}
        {tab === 'security' && <SecurityTab notify={notify} />}
        {tab === 'users' && <UsersTab notify={notify} />}
        {tab === 'invites' && <InvitesTab notify={notify} />}
        {tab === 'sources' && <SourcesTab notify={notify} />}
        {tab === 'cache' && <CacheTab notify={notify} />}
        {tab === 'downloads' && <DownloadsTab notify={notify} />}
        {tab === 'keys' && <ApiKeysTab notify={notify} />}
        {tab === 'system' && <SystemTab stats={stats} system={system} notify={notify} refreshStats={loadStats} />}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default AdminPage;
