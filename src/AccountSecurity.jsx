import { useState } from 'react';
import {
  MonitorSmartphone, ShieldAlert, Download, Trash2, LogOut, Loader2, Check,
  AlertTriangle, History,
} from 'lucide-react';
import {
  useSessions, useSecurityEvents, downloadAccountExport, deleteAccount, useAuth,
} from './hooks';
import { deviceLabel, eventLabel, when } from './securityFormat';

// The account holder's own view of their security: where they are signed in,
// what has happened to the account, a copy of their data, and the way out.
//
// Mounted on the Account page rather than in Settings, because none of it is a
// preference: it is the account itself.

const Card = ({ icon: Icon, title, blurb, children, tone = 'crimson' }) => (
  <div
    className={`backdrop-blur-xl border p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden ${
      tone === 'danger'
        ? 'bg-red-950/20 border-red-900/50'
        : 'bg-crimson-950/30 border-crimson-900/40'
    }`}
  >
    <div className="absolute -top-24 -left-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>
    <div className="space-y-3 relative z-10">
      <div className={`flex items-center gap-3 ${tone === 'danger' ? 'text-red-500' : 'text-crimson-500'}`}>
        <Icon className="w-6 h-6" />
        <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">{title}</h3>
      </div>
      {blurb && (
        <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">{blurb}</p>
      )}
    </div>
    <div className="relative z-10 space-y-4">{children}</div>
  </div>
);

const SessionsCard = () => {
  const { sessions, loading, error, revoke, revokeOthers } = useSessions();
  const [busy, setBusy] = useState(null);

  const others = sessions.filter((s) => !s.current).length;

  const handleRevoke = async (id) => {
    setBusy(id);
    await revoke(id);
    setBusy(null);
  };

  const handleRevokeOthers = async () => {
    setBusy('others');
    await revokeOthers();
    setBusy(null);
  };

  return (
    <Card
      icon={MonitorSmartphone}
      title="Where you are signed in"
      blurb="Every device holding a live session. If one of these is not you, sign it out and change your password."
    >
      {loading && <p className="text-xs text-crimson-500 font-bold uppercase tracking-widest">Reading…</p>}
      {error && <p className="text-xs text-crimson-300 font-medium">{error}</p>}

      <div className="space-y-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-4 p-4 rounded-2xl border ${
              s.current
                ? 'bg-crimson-500/10 border-crimson-500/40'
                : 'bg-crimson-950/40 border-crimson-900/50'
            }`}
          >
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-black text-crimson-50 truncate tracking-tight">
                  {deviceLabel(s.user_agent)}
                </span>
                {s.current && (
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-crimson-500 text-white text-[9px] font-black uppercase tracking-widest">
                    This device
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-crimson-600">
                <span>{s.ip || 'Unknown address'}</span>
                <span className="text-crimson-800">·</span>
                <span>Last used {when(s.last_seen_at)}</span>
              </div>
            </div>
            <button
              onClick={() => handleRevoke(s.id)}
              disabled={busy === s.id}
              aria-label="Sign this device out"
              className="shrink-0 p-2.5 rounded-full text-crimson-600 hover:text-white hover:bg-crimson-900/50 transition-all active:scale-90 disabled:opacity-50"
            >
              {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>

      {others > 0 && (
        <button
          onClick={handleRevokeOthers}
          disabled={busy === 'others'}
          className="w-full py-4 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
          {busy === 'others' ? 'Signing out…' : `Sign out ${others} other device${others === 1 ? '' : 's'}`}
        </button>
      )}
    </Card>
  );
};

const ActivityCard = () => {
  const { events, retentionDays, loading } = useSecurityEvents();

  return (
    <Card
      icon={History}
      title="Recent activity"
      blurb={
        retentionDays
          ? `Sign-ins and account changes belonging to you, kept for ${retentionDays} days.`
          : 'Sign-ins and account changes belonging to you.'
      }
    >
      {loading && <p className="text-xs text-crimson-500 font-bold uppercase tracking-widest">Reading…</p>}
      {!loading && events.length === 0 && (
        <p className="text-xs text-crimson-300/60 font-medium">Nothing recorded yet.</p>
      )}
      <div className="space-y-1.5">
        {events.map((e, i) => (
          <div
            key={`${e.ts}-${i}`}
            className="flex items-center gap-4 px-4 py-3 rounded-xl bg-crimson-950/40 border border-crimson-900/40"
          >
            <span
              className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                e.outcome === 'failure' ? 'bg-amber-500' : 'bg-crimson-500'
              }`}
            />
            <span className="flex-grow min-w-0 text-xs font-bold text-crimson-100 truncate">
              {eventLabel(e.event_type)}
            </span>
            <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-crimson-700">
              {e.ip || '—'}
            </span>
            <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-crimson-600 tabular-nums">
              {when(e.ts)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

const ExportCard = () => {
  const [state, setState] = useState('idle');

  const run = async () => {
    setState('working');
    try {
      await downloadAccountExport();
      setState('done');
      setTimeout(() => setState('idle'), 3000);
    } catch (e) {
      console.error('Export error:', e);
      setState('error');
    }
  };

  return (
    <Card
      icon={Download}
      title="Take your data with you"
      blurb="One JSON file holding your profile, preferences, every watchlist, all your progress and the titles you follow. Your password and session tokens are not in it, and never leave the server."
    >
      <button
        onClick={run}
        disabled={state === 'working'}
        className="w-full py-4 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-300 hover:text-white hover:border-crimson-600 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {state === 'working' && <Loader2 className="w-4 h-4 animate-spin" />}
        {state === 'done' && <Check className="w-4 h-4 text-green-500" />}
        {state === 'working' ? 'Preparing…' : state === 'done' ? 'Downloaded' : 'Download my data'}
      </button>
      {state === 'error' && (
        <p className="text-xs text-amber-400 font-medium">
          The export could not be prepared. Try again in a moment.
        </p>
      )}
    </Card>
  );
};

// Deleting is confirmed with the credential, not with the session: a bearer
// token is the one thing an attacker can hold without being the account holder,
// and this is the action that cannot be undone.
const DeleteCard = ({ hasEmail }) => {
  const { signChallenge } = useAuth();
  const [armed, setArmed] = useState(false);
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const ready = typed.trim().toUpperCase() === 'DELETE' && (hasEmail ? password : mnemonic.trim());

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const confirmation = hasEmail
        ? { password }
        : await signChallenge(mnemonic.trim());
      await deleteAccount(confirmation);
      // The session is cleared inside deleteAccount, so the app drops back to
      // the login wall on its own. A reload leaves nothing stale behind.
      window.location.href = '/';
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Card
      icon={ShieldAlert}
      title="Delete this account"
      tone="danger"
      blurb="Your watchlists, progress, follows and preferences are erased with it. This cannot be undone, and there is no copy to restore from. Download your data first if you want to keep it."
    >
      {!armed ? (
        <button
          onClick={() => setArmed(true)}
          className="w-full py-4 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-400 hover:text-white hover:border-red-500 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <Trash2 className="w-4 h-4" /> Delete my account
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-500/5 border border-red-500/30">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-crimson-300/80 leading-relaxed font-medium">
              {hasEmail
                ? 'Confirm with your password, then type DELETE to be certain.'
                : 'Confirm by signing with your 12-word mnemonic, then type DELETE to be certain. It is never sent anywhere: only the signature it produces is.'}
            </p>
          </div>

          {hasEmail ? (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full px-5 py-4 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder:text-crimson-700 text-sm font-bold focus:outline-none focus:border-red-600 transition-colors"
            />
          ) : (
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="word1 word2 word3…"
              className="w-full h-24 px-5 py-4 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder:text-crimson-700 text-sm font-bold resize-none focus:outline-none focus:border-red-600 transition-colors"
            />
          )}

          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type DELETE"
            className="w-full px-5 py-4 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder:text-crimson-700 text-sm font-black tracking-widest uppercase focus:outline-none focus:border-red-600 transition-colors"
          />

          {error && <p className="text-xs text-amber-400 font-medium">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setArmed(false); setPassword(''); setMnemonic(''); setTyped(''); setError(null); }}
              disabled={busy}
              className="flex-1 py-4 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Keep it
            </button>
            <button
              onClick={run}
              disabled={!ready || busy}
              className="flex-1 py-4 rounded-2xl bg-red-600 hover:bg-red-500 disabled:bg-red-950/50 disabled:text-red-800 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

const AccountSecurity = ({ hasEmail }) => (
  <div className="space-y-8">
    <SessionsCard />
    <ActivityCard />
    <ExportCard />
    <DeleteCard hasEmail={hasEmail} />
  </div>
);

export default AccountSecurity;
