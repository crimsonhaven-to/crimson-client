// The stores are the single source of the build, so nothing is side-loaded or
// served from /extension/.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Puzzle, Power, ShieldCheck, Sparkles, CheckCircle2, ExternalLink, ChevronRight } from 'lucide-react';
import { useTitle } from './hooks';

const STORES = {
  chrome: {
    url: 'https://chromewebstore.google.com/detail/crimson-haven-companion/npfllfkcppdjimedcbaadpaidkjbgkki',
    name: 'Chrome Web Store',
    add: 'Add to Chrome',
    confirm: 'Add extension',
  },
  firefox: {
    url: 'https://addons.mozilla.org/en-US/firefox/addon/crimson-haven-companion/',
    name: 'Firefox Add-ons',
    add: 'Add to Firefox',
    confirm: 'Add',
  },
};

const isFirefox = () => typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

// The companion fires a one-shot `crimson-extension-ready` at document_start, which
// can land before mount, so seed from the global AND listen, racing a short re-check.
function useCompanionPresence() {
  const [present, setPresent] = useState(() => {
    try { return Boolean(window.CrimsonExtension?.available); } catch { return false; }
  });
  const [version, setVersion] = useState(() => {
    try { return window.CrimsonExtension?.version || null; } catch { return null; }
  });
  useEffect(() => {
    if (present) return;
    const sync = () => {
      try {
        if (window.CrimsonExtension?.available) {
          setPresent(true);
          setVersion(window.CrimsonExtension.version || null);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('crimson-extension-ready', sync, { once: true });
    const t = setTimeout(sync, 400);
    return () => { window.removeEventListener('crimson-extension-ready', sync); clearTimeout(t); };
  }, [present]);
  return { present, version };
}

function Step({ index, icon, title, children }) {
  return (
    <li className="relative flex gap-5">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 font-black shrink-0">
          {index}
        </div>
        <div className="flex-grow w-px bg-crimson-900/40 mt-2 last:hidden" />
      </div>
      <div className="pb-8 space-y-2 min-w-0">
        <h4 className="text-crimson-50 font-black tracking-tight flex items-center gap-2.5 text-base sm:text-lg">
          <span className="text-crimson-500 shrink-0">{icon}</span>
          {title}
        </h4>
        <div className="text-sm sm:text-base text-crimson-100/70 leading-relaxed font-medium">
          {children}
        </div>
      </div>
    </li>
  );
}

export default function DownloadExtension() {
  useTitle('Claim the Companion');
  const { present, version: liveVersion } = useCompanionPresence();
  const [store, other] = isFirefox() ? [STORES.firefox, STORES.chrome] : [STORES.chrome, STORES.firefox];

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 space-y-3">
        <div className="flex items-center gap-3 text-crimson-500">
          <Puzzle className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">The Crimson Companion</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-crimson-50 uppercase tracking-tighter leading-none">
          Claim the <span className="text-crimson-500">Companion</span>
        </h2>
        <p className="text-sm sm:text-base text-crimson-100/70 leading-relaxed font-medium max-w-2xl">
          A featherlight browser familiar that lets the haven resolve and play your sources
          <strong className="text-crimson-50 font-black"> straight from your own machine</strong>, with no throne-room
          relay in the path. One click from your browser's store and every supported source bends the knee locally.
        </p>
      </div>

      {present && (
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-green-500/5 border border-green-500/25 shadow-xl">
          <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-crimson-50 font-black tracking-tight">The companion is already bound to this browser, darling.</p>
            <p className="text-sm text-crimson-100/70 font-medium leading-relaxed">
              {liveVersion ? `Version ${liveVersion} is awake and listening. ` : 'It is awake and listening. '}
              Just make sure its single red button is lit, then watch anything and your sources resolve in your own hands.
            </p>
          </div>
        </div>
      )}

      <div className="relative bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/50 p-8 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-[0.07] pointer-events-none">
          <Puzzle className="w-24 h-24 text-crimson-500" />
        </div>
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-black text-crimson-50 tracking-tight">Crimson Haven Companion</h3>
            {liveVersion && (
              <span className="px-2.5 py-1 bg-crimson-500/10 border border-crimson-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-crimson-300">
                v{liveVersion}
              </span>
            )}
            <span className="px-2.5 py-1 bg-crimson-950/60 border border-crimson-900/60 rounded-lg text-[10px] font-black uppercase tracking-widest text-crimson-500">
              Chromium &amp; Firefox · MV3
            </span>
          </div>
          <p className="text-sm text-crimson-100/70 font-medium leading-relaxed max-w-xl">
            Built for Chrome 111+, Edge, Brave, Opera and Firefox 140+. Safari speaks a different dialect
            of the rites and isn't supported yet. Installed straight from your browser's store, so it stays
            up to date on its own.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-7 py-4 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl transition-all shadow-lg font-black uppercase tracking-widest text-xs group"
            >
              <ExternalLink className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              Get it on {store.name}
            </a>
            <a
              href={other.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-4 bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 rounded-2xl transition-all font-black uppercase tracking-widest text-xs"
            >
              <ExternalLink className="w-4 h-4" />
              {other.name}
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
          <Sparkles className="w-4 h-4" /> The Binding Ritual
          <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>

        <ol className="space-y-0">
          <Step index="1" icon={<ExternalLink className="w-4 h-4" />} title="Open the listing">
            Follow the sigil above to the companion's page on
            <strong className="text-crimson-50 font-black"> {store.name}</strong>. It opens in a new tab,
            leaving the haven undisturbed behind you.
          </Step>
          <Step index="2" icon={<Puzzle className="w-4 h-4" />} title={store.add}>
            Press <strong className="text-crimson-50 font-black">{store.add}</strong>, then confirm with
            <strong className="text-crimson-50 font-black"> {store.confirm}</strong> when your browser asks. The crimson
            blood-drop sigil joins your browser, and the store keeps it updated for you, forever.
          </Step>
          <Step index="3" icon={<Power className="w-4 h-4" />} title="Kneel: one red button">
            Pin the companion to your toolbar, click its sigil, and press the single red
            <strong className="text-crimson-50 font-black"> "Use Extension"</strong> button. When it glows crimson, it's awake.
            That's the whole configuration. Refresh crimsonhaven and your sources now answer to you directly.
          </Step>
        </ol>
      </div>

      <div className="relative bg-crimson-500/5 backdrop-blur-md border border-crimson-500/20 p-8 rounded-[2.5rem] shadow-xl">
        <div className="absolute -top-3 left-10 px-4 py-1 bg-crimson-500 rounded-full text-[8px] font-black uppercase tracking-[0.3em] text-white">Queen's Decree</div>
        <p className="italic text-crimson-100/90 leading-relaxed text-lg tracking-tight">
          "Fear not, darling~ My little familiar scrapes nothing, hoards no secrets, and whispers to no one.
          It merely unshackles your own browser's requests so the sources answer to <span className="text-crimson-50 not-italic font-black border-b-2 border-crimson-500/50">you</span>,
          directly: no relay, no middleman, no trace left at my door. A pure upgrade, as all my gifts are~"
        </p>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-500 flex items-center gap-3">
          <span className="block w-8 h-px bg-crimson-500/50" />
          Luminas Crimsonveil, Eternal Empress of the Crimson Archives
        </p>
      </div>

      <div className="flex items-start gap-4 p-5 rounded-2xl bg-crimson-950/30 border border-crimson-900/40">
        <ShieldCheck className="w-6 h-6 text-crimson-500 shrink-0 mt-0.5" />
        <p className="text-sm text-crimson-100/70 font-medium leading-relaxed">
          The companion is entirely optional. Without it, the haven simply resolves your sources the old way,
          through the backend. Nothing breaks; you just hand the work back to me. It's published on the
          Chrome Web Store and Firefox Add-ons, reviewed by both, and removable any time from your browser's
          extensions page.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" /> Desktop Chromium &amp; Firefox
        </p>
        <Link
          to="/about"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-crimson-500 hover:text-crimson-400 transition-colors group"
        >
          About the Haven
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
