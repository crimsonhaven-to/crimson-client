import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, KeyRound, RefreshCw, AlertCircle, CheckCircle2, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth, useTitle } from './hooks';
import { Shell } from './Login';

// Landing page for the password-reset link. Sets a new password against the
// emailed ?token=; on success the backend revokes old sessions, so the user is
// sent back to sign in fresh.
const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  useTitle('Reset Password');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!token) { setError('This reset link is missing its token.'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    const res = await resetPassword(token, password);
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.error || 'Reset failed');
  };

  if (done) {
    return (
      <Shell subtitle="Your key has been reforged">
        <div className="space-y-6 text-center py-4 animate-in zoom-in-95 duration-500">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Password updated</h3>
          <p className="text-xs text-crimson-300/70 font-medium">Sign in with your new password to continue.</p>
          <button onClick={() => navigate('/')}
            className="group w-full py-4 bg-crimson-600 hover:bg-crimson-500 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all shadow-[0_15px_30px_rgba(255,0,60,0.2)] flex items-center justify-center gap-3 active:scale-95">
            Go to Sign In <LogIn className="w-4 h-4" />
          </button>
        </div>
      </Shell>
    );
  }

  const inputCls =
    'w-full py-4 pl-12 pr-12 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 ' +
    'placeholder-crimson-500/40 focus:outline-none focus:border-crimson-500 transition-all font-semibold text-sm backdrop-blur-md';

  return (
    <Shell subtitle="Choose a new password">
      <form onSubmit={submit} className="space-y-5">
        <h3 className="text-lg font-black text-white uppercase tracking-tighter text-center">Reset Password</h3>
        <div className="relative flex items-center">
          <Lock className="absolute left-5 w-4 h-4 text-crimson-500/60 pointer-events-none" />
          <input type={showPw ? 'text' : 'password'} required minLength={8} placeholder="New password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
          <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
            className="absolute right-4 text-crimson-500/60 hover:text-crimson-400 transition-colors">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="relative flex items-center">
          <Lock className="absolute left-5 w-4 h-4 text-crimson-500/60 pointer-events-none" />
          <input type={showPw ? 'text' : 'password'} required minLength={8} placeholder="Confirm new password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" />
        </div>
        {error && (
          <div className="p-4 rounded-2xl bg-crimson-500/5 border border-crimson-500/20 text-crimson-400 flex items-center gap-3 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-crimson-500" /> {error}
          </div>
        )}
        <button type="submit" disabled={busy || !password || !confirm}
          className="group w-full py-4 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all shadow-[0_15px_30px_rgba(255,0,60,0.2)] flex items-center justify-center gap-3 active:scale-95">
          {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Update Password <KeyRound className="w-4 h-4" /></>}
        </button>
      </form>
    </Shell>
  );
};

export default ResetPassword;
