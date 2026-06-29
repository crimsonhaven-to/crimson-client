/*
 * The Companion download page (/extension).
 *
 * The crimson-extension repo is private, so its build can't be fetched from a
 * GitHub Release. Instead CI packs it into the client image (see Dockerfile's
 * `extpack` stage) and nginx serves it at /extension/crimson-extension.zip with
 * the live manifest at /extension/manifest.json. This page hands the viewer that
 * zip plus the side-load ritual, in Luminas' register.
 *
 * Same-origin static assets — fetched with a plain relative `fetch`, NOT apiFetch
 * (that points at the backend; the zip + manifest live on the client's own nginx).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Puzzle, FolderOpen, Power, ShieldCheck, Sparkles, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import { useTitle } from './hooks';

const ZIP_URL = '/extension/crimson-extension.zip';
const MANIFEST_URL = '/extension/manifest.json';

// Reads window.CrimsonExtension synchronously and keeps it fresh: the companion
// injects its MAIN-world API at document_start and fires a one-shot
// `crimson-extension-ready` event, which can land before this component mounts —
// so we seed from the global AND listen, racing a short re-check against the event.
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
        <h4 className="text-white font-black tracking-tight flex items-center gap-2.5 text-base sm:text-lg">
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
  // The downloadable build's version, read from the packed manifest. Falls back
  // to whatever the live companion reports, then to nothing (chip just hides).
  const [packVersion, setPackVersion] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(MANIFEST_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (!cancelled && m?.version) setPackVersion(m.version); })
      .catch(() => { /* manifest missing on an old build — the button still works */ });
    return () => { cancelled = true; };
  }, []);

  const shownVersion = packVersion || liveVersion;

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* Header */}
      <div className="border-b border-crimson-900/30 pb-8 space-y-3">
        <div className="flex items-center gap-3 text-crimson-500">
          <Puzzle className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">The Crimson Companion</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter leading-none">
          Claim the <span className="text-crimson-500">Companion</span>
        </h2>
        <p className="text-sm sm:text-base text-crimson-100/70 leading-relaxed font-medium max-w-2xl">
          A featherlight browser familiar that lets the haven resolve and play your sources
          <strong className="text-white font-black"> straight from your own machine</strong> — no throne-room
          relay in the path. Install it once and every supported source bends the knee locally.
        </p>
      </div>

      {/* Already-installed success state */}
      {present && (
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-green-500/5 border border-green-500/25 shadow-xl">
          <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-white font-black tracking-tight">The companion is already bound to this browser, darling.</p>
            <p className="text-sm text-crimson-100/70 font-medium leading-relaxed">
              {liveVersion ? `Version ${liveVersion} is awake and listening. ` : 'It is awake and listening. '}
              Just make sure its single red button is lit — then watch anything and your sources resolve in your own hands.
            </p>
          </div>
        </div>
      )}

      {/* Download CTA */}
      <div className="relative bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/50 p-8 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-[0.07] pointer-events-none">
          <Puzzle className="w-24 h-24 text-crimson-500" />
        </div>
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-black text-white tracking-tight">Crimson Haven Companion</h3>
            {shownVersion && (
              <span className="px-2.5 py-1 bg-crimson-500/10 border border-crimson-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-crimson-300">
                v{shownVersion}
              </span>
            )}
            <span className="px-2.5 py-1 bg-crimson-950/60 border border-crimson-900/60 rounded-lg text-[10px] font-black uppercase tracking-widest text-crimson-500">
              Chromium · MV3
            </span>
          </div>
          <p className="text-sm text-crimson-100/70 font-medium leading-relaxed max-w-xl">
            Built for Chromium-blooded browsers — Chrome 111+, Edge, Brave, Opera. Firefox &amp; Safari
            speak a different dialect of the rites and aren't supported yet.
          </p>
          <a
            href={ZIP_URL}
            download
            className="inline-flex items-center gap-3 px-7 py-4 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl transition-all shadow-lg font-black uppercase tracking-widest text-xs group"
          >
            <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
            Download the Companion
          </a>
        </div>
      </div>

      {/* Install ritual */}
      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
          <Sparkles className="w-4 h-4" /> The Binding Ritual
          <div className="h-px bg-crimson-900/30 flex-grow" />
        </h3>

        <ol className="space-y-0">
          <Step index="1" icon={<Download className="w-4 h-4" />} title="Claim &amp; unseal">
            Download the sigil above, then unzip it somewhere it won't be swept away — your Documents,
            perhaps. You'll be left with a single <code className="px-1.5 py-0.5 rounded bg-crimson-950/60 border border-crimson-900/60 text-crimson-300 font-mono text-xs">crimson-extension</code> folder.
          </Step>
          <Step index="2" icon={<Puzzle className="w-4 h-4" />} title="Open the extensions altar">
            Paste <code className="px-1.5 py-0.5 rounded bg-crimson-950/60 border border-crimson-900/60 text-crimson-300 font-mono text-xs">chrome://extensions</code> into
            your address bar (or <code className="px-1.5 py-0.5 rounded bg-crimson-950/60 border border-crimson-900/60 text-crimson-300 font-mono text-xs">edge://extensions</code> on Edge,
            <code className="px-1.5 py-0.5 rounded bg-crimson-950/60 border border-crimson-900/60 text-crimson-300 font-mono text-xs">brave://extensions</code> on Brave) and press enter.
          </Step>
          <Step index="3" icon={<Power className="w-4 h-4" />} title="Reveal the rites — Developer mode">
            Flip on <strong className="text-white font-black">Developer mode</strong> — the toggle hiding in
            the top-right corner. The hidden incantations appear.
          </Step>
          <Step index="4" icon={<FolderOpen className="w-4 h-4" />} title="Load unpacked">
            Click <strong className="text-white font-black">Load unpacked</strong> and choose the
            unzipped <code className="px-1.5 py-0.5 rounded bg-crimson-950/60 border border-crimson-900/60 text-crimson-300 font-mono text-xs">crimson-extension</code> folder
            (the one with <code className="px-1.5 py-0.5 rounded bg-crimson-950/60 border border-crimson-900/60 text-crimson-300 font-mono text-xs">manifest.json</code> inside).
            The crimson blood-drop sigil joins your browser.
          </Step>
          <Step index="5" icon={<Power className="w-4 h-4" />} title="Kneel — one red button">
            Pin the companion to your toolbar, click its sigil, and press the single red
            <strong className="text-white font-black"> "Use Extension"</strong> button. When it glows crimson, it's awake —
            that's the whole configuration. Refresh crimsonhaven and your sources now answer to you directly.
          </Step>
        </ol>
      </div>

      {/* Privacy / what-it-does decree */}
      <div className="relative bg-crimson-500/5 backdrop-blur-md border border-crimson-500/20 p-8 rounded-[2.5rem] shadow-xl">
        <div className="absolute -top-3 left-10 px-4 py-1 bg-crimson-500 rounded-full text-[8px] font-black uppercase tracking-[0.3em] text-white">Queen's Decree</div>
        <p className="italic text-crimson-100/90 leading-relaxed text-lg tracking-tight">
          "Fear not, darling~ My little familiar scrapes nothing, hoards no secrets, and whispers to no one.
          It merely unshackles your own browser's requests so the sources answer to <span className="text-white not-italic font-black border-b-2 border-crimson-500/50">you</span>,
          directly — no relay, no middleman, no trace left at my door. A pure upgrade, as all my gifts are~"
        </p>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-500 flex items-center gap-3">
          <span className="block w-8 h-px bg-crimson-500/50" />
          Luminas Crimsonveil, Eternal Empress of the Crimson Archives
        </p>
      </div>

      {/* Reassurance + safety */}
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-crimson-950/30 border border-crimson-900/40">
        <ShieldCheck className="w-6 h-6 text-crimson-500 shrink-0 mt-0.5" />
        <p className="text-sm text-crimson-100/70 font-medium leading-relaxed">
          The companion is entirely optional — without it, the haven simply resolves your sources the old way,
          through the backend. Nothing breaks; you just hand the work back to me. Loading an unpacked extension is
          standard, safe, and reversible: remove it any time from the same extensions page.
        </p>
      </div>

      {/* Footer note */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Desktop Chromium only
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
