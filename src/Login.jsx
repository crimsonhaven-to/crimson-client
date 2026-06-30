import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, KeyRound, LogIn, UserPlus, RefreshCw, AlertCircle,
  CheckCircle2, MailCheck, ArrowLeft, Ticket, Eye, EyeOff, Key, Copy,
} from 'lucide-react';
import { useAuth, useTitle, usePublicConfig } from './hooks';

// Shared field shell — keeps every input on-theme without repeating the long
// Tailwind class string at each call site.
function Field({ icon: Icon, children }) {
  return (
    <div className="relative flex items-center">
      <Icon className="absolute left-5 w-4 h-4 text-crimson-500/60 pointer-events-none" />
      {children}
    </div>
  );
}

const inputCls =
  'w-full py-4 pl-12 pr-4 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl ' +
  'text-crimson-50 placeholder-crimson-500/40 focus:outline-none focus:border-crimson-500 ' +
  'focus:shadow-[0_0_30px_rgba(255,0,60,0.12)] transition-all font-semibold text-sm backdrop-blur-md';

const primaryBtn =
  'group relative w-full py-4 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 ' +
  'disabled:cursor-not-allowed text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl ' +
  'transition-all shadow-[0_15px_30px_rgba(255,0,60,0.2)] flex items-center justify-center gap-3 active:scale-95';

// modes: 'login' | 'register' | 'forgot' | 'mnemonic'
const LoginWall = () => {
  const {
    emailLogin, emailRegister, requestPasswordReset, resendVerification,
    login, registerMnemonic, createNewMnemonic,
    loading, error, setError,
  } = useAuth();
  const navigate = useNavigate();
  useTitle('Enter the Haven');
  // On a demo instance signup is open — the backend bypasses the invite gate, so the
  // login page drops the invite field (and its required/disabled gating) entirely.
  const { demo_mode: demoMode } = usePublicConfig();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invite, setInvite] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [notice, setNotice] = useState(null);      // success / info banner
  const [pending, setPending] = useState(false);   // local spinner (forgot flow)
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  // Mnemonic tab: 'signin' shows the existing-account form; 'create' shows a
  // freshly generated mnemonic + invite-code field (registration is invite-gated).
  const [mnemonic, setMnemonic] = useState('');
  const [genMnemonic, setGenMnemonic] = useState('');
  const [mnemonicView, setMnemonicView] = useState('signin');
  const [copied, setCopied] = useState(false);

  const switchMode = (next) => {
    setError && setError(null);
    setNotice(null);
    setAwaitingVerify(false);
    if (next === 'mnemonic') setMnemonicView('signin');
    setMode(next);
  };

  // --- handlers -------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await emailLogin(email.trim(), password);
    if (res.ok) navigate('/');
    else if (res.needsVerification) setAwaitingVerify(true);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setNotice(null);
    if (password !== confirm) {
      setError && setError('Passwords do not match');
      return;
    }
    const res = await emailRegister(email.trim(), password, invite.trim());
    if (res.ok) {
      setAwaitingVerify(true);
      setNotice(res.message || 'Account created. Check your email to verify.');
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setPending(true);
    setNotice(null);
    const res = await requestPasswordReset(email.trim());
    setPending(false);
    setNotice(res.message || 'If that account exists, a reset link is on its way.');
  };

  const handleResend = async () => {
    setPending(true);
    const res = await resendVerification(email.trim());
    setPending(false);
    setNotice(res.message || 'Verification link sent.');
  };

  // --- mnemonic handlers ----------------------------------------------------
  const handleMnemonicLogin = async (e) => {
    e.preventDefault();
    if (await login(mnemonic.trim())) navigate('/');
  };

  const handleGenerateIdentity = async () => {
    setError && setError(null);
    setGenMnemonic(await createNewMnemonic());
    setMnemonicView('create');
  };

  const handleMnemonicRegister = async (e) => {
    e.preventDefault();
    if (await registerMnemonic(genMnemonic.trim(), invite.trim())) navigate('/');
  };

  const copyMnemonic = () => {
    navigator.clipboard.writeText(genMnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const busy = loading || pending;

  // --- "check your inbox" interstitial -------------------------------------
  if (awaitingVerify) {
    return (
      <Shell subtitle="One step away from the dark network">
        <div className="space-y-8 text-center animate-in zoom-in-95 duration-500">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-crimson-500/10 border border-crimson-500/30 flex items-center justify-center">
            <MailCheck className="w-8 h-8 text-crimson-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Verify your email</h3>
            <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">
              We sent a confirmation link to <span className="text-crimson-400 font-bold break-all">{email}</span>.
              Click it to activate your account, then sign in.
            </p>
          </div>
          {notice && <Banner kind="ok" text={notice} />}
          <div className="space-y-3">
            <button onClick={handleResend} disabled={busy} className={primaryBtn}>
              {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Resend Link <Mail className="w-4 h-4" /></>}
            </button>
            <button
              onClick={() => switchMode('login')}
              className="w-full text-center text-[10px] text-crimson-700 hover:text-crimson-500 transition-colors font-black uppercase tracking-[0.2em]"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // --- forgot password ------------------------------------------------------
  if (mode === 'forgot') {
    return (
      <Shell subtitle="Recover access to your sanctuary">
        <form onSubmit={handleForgot} className="space-y-6">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter text-center">Reset Password</h3>
          <Field icon={Mail}>
            <input type="email" required placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" />
          </Field>
          {error && <Banner kind="err" text={error} />}
          {notice && <Banner kind="ok" text={notice} />}
          <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}>
            {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Send Reset Link <KeyRound className="w-4 h-4" /></>}
          </button>
          <button type="button" onClick={() => switchMode('login')}
            className="w-full flex items-center justify-center gap-2 text-[10px] text-crimson-700 hover:text-crimson-500 transition-colors font-black uppercase tracking-[0.2em]">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </button>
        </form>
      </Shell>
    );
  }

  // --- sign in / register / mnemonic (shared shell with a tab switch) -------
  const isRegister = mode === 'register';
  const isMnemonic = mode === 'mnemonic';
  return (
    <Shell subtitle="Members only — sign in to descend">
      {/* Tab switch */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl mb-8">
        {[['login', 'Sign In'], ['register', 'Register'], ['mnemonic', 'Mnemonic']].map(([key, label]) => (
          <button key={key} onClick={() => switchMode(key)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
              mode === key ? 'bg-crimson-600 text-white shadow-[0_5px_15px_rgba(255,0,60,0.25)]' : 'text-crimson-500 hover:text-crimson-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {demoMode && (
        <div className="mb-6">
          <Banner kind="ok" text="Demo instance — open signup, no streaming sources, and all accounts reset nightly." />
        </div>
      )}

      {/* Mnemonic tab: P-Stream-style key-based identity. Sign-in needs no invite;
          creating a new identity is invite-gated, like email registration. */}
      {isMnemonic ? (
        mnemonicView === 'signin' ? (
          <form onSubmit={handleMnemonicLogin} className="space-y-5">
            <p className="text-xs text-crimson-300/60 leading-relaxed font-medium text-center">
              Paste your 12-word mnemonic to sign in. No email, no password — your
              key never leaves this device.
            </p>
            <textarea required placeholder="word1 word2 word3 …" value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              className={inputCls.replace('py-4 pl-12 pr-4', 'p-4') + ' h-28 resize-none font-mono leading-relaxed'} />

            {error && <Banner kind="err" text={error} />}

            <button type="submit" disabled={busy || !mnemonic.trim()} className={primaryBtn}>
              {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Sign In <Key className="w-4 h-4" /></>}
            </button>

            <button type="button" onClick={handleGenerateIdentity}
              className="w-full text-center text-[10px] text-crimson-700 hover:text-crimson-500 transition-colors font-black uppercase tracking-[0.2em]">
              No mnemonic yet? Create a new identity
            </button>
          </form>
        ) : (
          <form onSubmit={handleMnemonicRegister} className="space-y-5">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500">Your new mnemonic</p>
              <div className="p-5 bg-crimson-950/80 border border-crimson-900/60 rounded-2xl text-crimson-100 font-mono text-sm leading-relaxed break-words select-all shadow-inner">
                {genMnemonic}
              </div>
              <button type="button" onClick={copyMnemonic}
                className="w-full flex items-center justify-center gap-2 py-3 bg-crimson-900/20 hover:bg-crimson-900/40 text-crimson-100 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest border border-crimson-800/50">
                {copied ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Copied</> : <><Copy className="w-4 h-4" /> Copy mnemonic</>}
              </button>
              <p className="text-[11px] text-crimson-300/60 leading-relaxed font-medium">
                Save these 12 words somewhere safe — they are the <span className="text-crimson-400 font-bold">only</span> way
                back into this account. We never store them; lose them and the account is gone forever.
              </p>
            </div>

            {!demoMode && (
              <Field icon={Ticket}>
                <input type="text" required placeholder="Invite code" value={invite}
                  onChange={(e) => setInvite(e.target.value)} className={inputCls} />
              </Field>
            )}

            {error && <Banner kind="err" text={error} />}

            <button type="submit" disabled={busy || !genMnemonic.trim() || (!demoMode && !invite.trim())} className={primaryBtn}>
              {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Create Account <UserPlus className="w-4 h-4" /></>}
            </button>

            <button type="button" onClick={() => switchMode('mnemonic')}
              className="w-full flex items-center justify-center gap-2 text-[10px] text-crimson-700 hover:text-crimson-500 transition-colors font-black uppercase tracking-[0.2em]">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to mnemonic sign in
            </button>
          </form>
        )
      ) : (
      <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-5">
        <Field icon={Mail}>
          <input type="email" required placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" />
        </Field>

        <Field icon={Lock}>
          <input type={showPw ? 'text' : 'password'} required placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputCls}
            autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={8} />
          <button type="button" onClick={() => setShowPw((v) => !v)}
            className="absolute right-4 text-crimson-500/60 hover:text-crimson-400 transition-colors" tabIndex={-1}>
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </Field>

        {isRegister && (
          <>
            <Field icon={Lock}>
              <input type={showPw ? 'text' : 'password'} required placeholder="Confirm password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" minLength={8} />
            </Field>
            {!demoMode && (
              <Field icon={Ticket}>
                <input type="text" required placeholder="Invite code" value={invite}
                  onChange={(e) => setInvite(e.target.value)} className={inputCls} />
              </Field>
            )}
          </>
        )}

        {error && <Banner kind="err" text={error} />}
        {notice && <Banner kind="ok" text={notice} />}

        <button type="submit"
          disabled={busy || !email.trim() || !password || (isRegister && (!confirm || (!demoMode && !invite.trim())))}
          className={primaryBtn}>
          {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : (
            isRegister ? <>Create Account <UserPlus className="w-4 h-4" /></> : <>Sign In <LogIn className="w-4 h-4" /></>
          )}
        </button>
      </form>
      )}

      {/* Footer links */}
      {mode === 'login' && (
        <div className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.2em]">
          <button onClick={() => switchMode('forgot')} className="text-crimson-700 hover:text-crimson-500 transition-colors">
            Forgot password?
          </button>
        </div>
      )}
    </Shell>
  );
};

// --- presentational helpers -------------------------------------------------
function Banner({ kind, text }) {
  const ok = kind === 'ok';
  return (
    <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl animate-in fade-in duration-300 ${
      ok ? 'bg-green-500/5 border border-green-500/20 text-green-300'
         : 'bg-crimson-500/5 border border-crimson-500/20 text-crimson-400'
    }`}>
      {ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" /> : <AlertCircle className="w-4 h-4 shrink-0 text-crimson-500" />}
      <span className="leading-relaxed normal-case tracking-normal font-bold">{text}</span>
    </div>
  );
}

// Centered card shell shared by every auth view.
export function Shell({ subtitle, children }) {
  return (
    <div className="max-w-md w-full mx-auto px-6 py-16 sm:py-24 my-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center space-y-3 mb-10">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white uppercase drop-shadow-[0_10px_40px_rgba(255,0,60,0.3)]">
          crimson<span className="text-crimson-500 font-light">haven</span>
        </h1>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">{subtitle}</p>
      </div>
      <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/50 p-7 sm:p-9 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}

export default LoginWall;
