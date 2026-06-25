import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from './hooks';

// --- The secret shrine -----------------------------------------------------
// Revealed by the Konami code (see useKonami.js). Lumi art that the viewer can
// click to cycle, plus a blessing pulled live from the backend /lumi endpoint
// (with a local fallback so it's never empty).
const LUMI_ART = [
  '/lumi_secret_lumi_peace.png',
  '/lumi_secret_nobackgroundmascot.png',
  '/lumi_secret_lumi_cuty.png',
  '/lumi_secret_lumi_sideways.png',
  '/lumi_secret_annoyed_lumi.png',
];

const FALLBACK_BLESSING = 'You found my shrine, mortal. Few are so persistent. ✨';

export default function LumiSecret() {
  const [art, setArt] = useState(0);
  const [blessing, setBlessing] = useState(FALLBACK_BLESSING);
  const [title, setTitle] = useState('Eternal Empress of the Crimson Archives');

  // Pull a fresh blessing from the backend (public endpoint). Best-effort.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch('/lumi');
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        if (data?.blessing) setBlessing(data.blessing);
        if (data?.title) setTitle(data.title);
      } catch { /* keep the fallback */ }
    })();
    return () => { alive = false; };
  }, []);

  // Slowly drift through the gallery; clicking advances it immediately.
  useEffect(() => {
    const t = setInterval(() => setArt((i) => (i + 1) % LUMI_ART.length), 6000);
    return () => clearInterval(t);
  }, []);

  const nextArt = useCallback(() => setArt((i) => (i + 1) % LUMI_ART.length), []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-black via-crimson-950 to-black px-6 text-center">
      {/* Soft crimson glow behind the empress */}
      <div className="pointer-events-none absolute h-[60vmin] w-[60vmin] rounded-full bg-crimson-600/20 blur-3xl" />

      <p className="z-10 mb-6 text-xs font-black uppercase tracking-[0.4em] text-crimson-500/80 animate-pulse">
        ✦ A Secret Audience ✦
      </p>

      <button
        onClick={nextArt}
        title="The empress turns to face you"
        className="z-10 transition-transform duration-500 hover:scale-105 focus:outline-none"
      >
        <img
          key={art}
          src={LUMI_ART[art]}
          alt="Luminas Crimsonveil"
          className="max-h-[48vh] w-auto select-none drop-shadow-[0_0_40px_rgba(225,29,72,0.45)] animate-in fade-in zoom-in-95 duration-700"
          draggable={false}
        />
      </button>

      <h1 className="z-10 mt-8 font-black uppercase tracking-widest text-3xl sm:text-4xl text-crimson-100">
        Luminas Crimsonveil
      </h1>
      <p className="z-10 mt-1 text-xs font-bold uppercase tracking-[0.3em] text-crimson-500/80">
        {title}
      </p>

      <p className="z-10 mt-6 max-w-xl text-lg italic text-crimson-200/90">
        “{blessing}”
      </p>

      <div className="z-10 mt-10 flex items-center gap-4">
        <Link
          to="/"
          className="rounded-xl border border-crimson-800 bg-crimson-900/40 px-6 py-3 text-sm font-black uppercase tracking-widest text-crimson-100 transition-all hover:bg-crimson-500/20 hover:text-crimson-400"
        >
          ← Return to the mortal realm
        </Link>
      </div>

      <p className="z-10 mt-6 text-[0.65rem] uppercase tracking-[0.3em] text-crimson-700">
        (click the empress — she enjoys the attention)
      </p>
    </div>
  );
}
