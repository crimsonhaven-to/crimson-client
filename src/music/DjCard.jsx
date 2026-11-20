import { useNavigate } from 'react-router-dom';
import { Loader2, Radio } from 'lucide-react';

import { startDj, useDj } from './dj';
import { useDjAccess } from './hooks';

export default function DjCard() {
  const allowed = useDjAccess();
  const dj = useDj();
  const navigate = useNavigate();
  if (!allowed) return null;

  const start = async () => {
    if (await startDj()) navigate('/music/now');
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-3xl border border-crimson-700/40 bg-gradient-to-br from-crimson-900/40 to-crimson-950/60 p-5">
      <span className="w-12 h-12 rounded-2xl bg-crimson-600 text-white flex items-center justify-center flex-shrink-0 shadow-[0_10px_30px_rgba(255,0,60,0.25)]">
        <Radio className="w-6 h-6" />
      </span>
      <div className="min-w-0 flex-grow">
        <p className="text-sm font-black text-crimson-50">Lumi DJ</p>
        <p className="text-xs text-crimson-400">
          {dj.error || (dj.active
            ? 'Lumi is on the decks. Pick a playlist to send her home.'
            : 'Lumi picks a theme from your library, plays a few songs, then moves on to the next.')}
        </p>
      </div>
      <button onClick={start} disabled={dj.loading && !dj.active}
        className="flex items-center justify-center gap-2 px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-60 flex-shrink-0">
        {dj.loading && !dj.active ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
        {dj.active ? 'New set' : 'Start the DJ'}
      </button>
    </div>
  );
}
