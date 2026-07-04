import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { useAuth, useTitle } from './hooks';
import { Shell } from './Login';

// Landing page for the verification link emailed on registration. Consumes the
// ?token=, and on success the backend hands back a session — so a verified user
// lands straight inside the app.
const VerifyEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  useTitle('Verifying');

  const [status, setStatus] = useState('working'); // 'working' | 'ok' | 'error'
  const [error, setError] = useState(null);
  const ran = useRef(false); // guard React 18 StrictMode double-invoke (token is single-use)

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setStatus('error'); setError('No verification token provided.'); return; }
    (async () => {
      const res = await verifyEmail(token);
      if (res.ok) {
        setStatus('ok');
        // Session is set; give the user a beat to read, then drop into the app.
        setTimeout(() => navigate('/'), 1200);
      } else {
        setStatus('error');
        setError(res.error || 'Verification failed.');
      }
    })();
  }, [token, verifyEmail, navigate]);

  return (
    <Shell subtitle="Confirming your descent">
      <div className="space-y-8 text-center">
        {status === 'working' && (
          <div className="space-y-5 py-6">
            <RefreshCw className="w-10 h-10 text-crimson-500 animate-spin mx-auto" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-crimson-400 animate-pulse">Verifying token…</p>
          </div>
        )}
        {status === 'ok' && (
          <div className="space-y-5 py-4 animate-in zoom-in-95 duration-500">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <h3 className="text-xl font-black text-crimson-50 uppercase tracking-tighter">Email verified</h3>
            <p className="text-xs text-crimson-300/70 font-medium">Welcome to the haven. Taking you inside…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-6 py-4">
            <AlertCircle className="w-14 h-14 text-crimson-500 mx-auto" />
            <h3 className="text-xl font-black text-crimson-50 uppercase tracking-tighter">Verification failed</h3>
            <p className="text-xs text-crimson-300/70 font-medium leading-relaxed">{error}</p>
            <button onClick={() => navigate('/')}
              className="group w-full py-4 bg-crimson-600 hover:bg-crimson-500 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all shadow-[0_15px_30px_rgba(255,0,60,0.2)] flex items-center justify-center gap-3 active:scale-95">
              Back to Sign In <LogIn className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default VerifyEmail;
