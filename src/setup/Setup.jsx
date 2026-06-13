import { useState } from 'react';
import { setTmdbKey } from '../local-backend';

// First-run screen: the extension ships no TMDB key, so the user pastes their own
// free token (v4 read access token or legacy v3 key). We validate it with a single
// lightweight TMDB call before saving, then hand control back to the app.
async function validateTmdbKey(key) {
  const isV4 = key.includes('.') || key.length > 40;
  const url = new URL('https://api.themoviedb.org/3/configuration');
  const headers = { accept: 'application/json' };
  if (isV4) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);
  try {
    const res = await fetch(url.toString(), { headers });
    return res.ok;
  } catch {
    return false;
  }
}

export default function Setup({ onDone }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) { setError('Please paste your TMDB token.'); return; }
    setBusy(true);
    setError(null);
    const ok = await validateTmdbKey(trimmed);
    if (!ok) {
      setBusy(false);
      setError('That token was rejected by TMDB. Double-check you copied the full key.');
      return;
    }
    await setTmdbKey(trimmed);
    setBusy(false);
    onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-crimson-950/40 to-black text-white p-6">
      <div className="w-full max-w-lg bg-crimson-950/40 border border-crimson-900/60 rounded-[2rem] p-8 sm:p-10 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-black tracking-tight">Welcome to Crimsonhaven</h1>
          <p className="text-crimson-300/80 text-sm leading-relaxed">
            This extension runs entirely on your machine — no account, no server. It
            just needs <span className="text-white font-semibold">your own free TMDB API token</span> to
            fetch anime metadata, posters and episode lists.
          </p>
        </div>

        <ol className="text-xs text-crimson-200/80 space-y-1.5 list-decimal list-inside bg-black/30 rounded-2xl p-4 border border-crimson-900/40">
          <li>Create a free account at <span className="text-white">themoviedb.org</span>.</li>
          <li>Open <span className="text-white">Settings → API</span> and request an API key.</li>
          <li>Copy the <span className="text-white">API Read Access Token</span> (v4) and paste it below.</li>
        </ol>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your TMDB token (eyJ...)"
            autoFocus
            className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-crimson-900/60 focus:border-crimson-500 outline-none text-sm font-mono"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-2xl bg-crimson-600 hover:bg-crimson-500 disabled:opacity-50 font-black uppercase tracking-widest text-xs transition-all active:scale-95"
          >
            {busy ? 'Verifying…' : 'Enter the sanctuary'}
          </button>
        </form>

        <p className="text-[10px] text-crimson-400/60 text-center">
          Your token is stored locally in the browser and is never sent anywhere except TMDB.
        </p>
      </div>
    </div>
  );
}
