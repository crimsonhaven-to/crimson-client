// Shared presentational atoms for the Admin dashboard, so every tab component
// draws from one set of building blocks. The non-component helpers (statusMeta,
// fmtDate, STATUS_META) live in ./format so this file only exports components —
// Vite fast-refresh requires that. Lifted verbatim from the Admin.jsx monolith.
import { AlertCircle, CheckCircle2, Wifi, WifiOff, X } from 'lucide-react';

import { statusMeta } from './format';

export const StatusDot = ({ status }) => {
  const m = statusMeta(status);
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${m.dot} ${m.glow} ${status === 'active' || status === 'ok' ? 'animate-pulse' : ''}`} />;
};

// A small on/off capability badge (used in the System flags grid).
export const FlagBadge = ({ on, label, onIcon: OnIcon = Wifi, offIcon: OffIcon = WifiOff }) => (
  <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${
    on ? 'bg-green-950/30 border-green-800/40 text-green-300' : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-700'
  }`}>
    {on ? <OnIcon className="w-3.5 h-3.5" /> : <OffIcon className="w-3.5 h-3.5" />}
    <span className="truncate">{label}</span>
  </div>
);

// ---------- small presentational helpers ----------
export const StatCard = ({ label, value, sub, icon: Icon, accent }) => (
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

export const TabButton = ({ active, onClick, icon: Icon, label }) => (
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

export const Toast = ({ toast, onClose }) => {
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
