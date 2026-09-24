// Spotify's redirect lands here with a code (or an error). The code goes to the
// backend once, with the verifier this tab kept, and the member is sent back
// to the Music hub.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { musicApi } from './hooks';
import { redirectUri, takePendingAuthorization } from './music/spotifyAuth';

// Every way this can go wrong rejects, so the page has one place to report it.
async function connectFromCallback(params) {
  const code = params.get('code');
  const denied = params.get('error');
  if (denied === 'access_denied') throw new Error('Spotify access was declined.');
  if (denied || !code) throw new Error(`Spotify said: ${denied || 'no code returned'}.`);
  const pending = takePendingAuthorization(params.get('state'));
  await musicApi.connectSpotify({
    client_id: pending.clientId,
    code,
    code_verifier: pending.verifier,
    redirect_uri: redirectUri(),
  });
}

export default function MusicConnect() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  // A code is single use, and React's development double effect would spend it twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    connectFromCallback(params).then(
      () => navigate('/music', { replace: true }),
      (err) => setError(err.message),
    );
  }, [params, navigate]);

  return (
    <div className="max-w-xl mx-auto py-32 px-6 text-center space-y-5">
      {error ? (
        <>
          <p className="text-crimson-300 font-bold">{error}</p>
          <Link to="/music" className="inline-block px-6 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
            Back to Music
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 text-crimson-500 animate-spin mx-auto" />
          <p className="text-crimson-400 text-[10px] font-black uppercase tracking-[0.3em]">Connecting Spotify...</p>
        </>
      )}
    </div>
  );
}
