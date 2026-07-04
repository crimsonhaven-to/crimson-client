import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Search, Heart, History, SlidersHorizontal, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { HOSTED_IN, useThemedAsset } from './hooks';

// Luminas Crimsonveil's welcome ritual — a stepped, themed introduction to the
// haven's features, shown once per login (see the trigger in App.jsx). Self-
// contained: owns its own step state and calls onClose when the dweller skips,
// closes, or finishes. Written in the Queen's voice to match the site's flavour.
//
// `isNew` marks the freshest feature (the language preference) with a little badge
// so returning mortals can spot what's changed.
const STEPS = [
  {
    icon: Crown,
    title: 'Welcome to the Haven',
    body: (
      <>
        Ahh… a fresh pulse graces my sanctuary. I am <strong className="text-crimson-50">Luminas Crimsonveil</strong>,
        eternal curator of this place. Lean close, darling~ — let me unveil the little delights woven into your
        <span className="text-crimson-400 font-bold"> crimsonhaven</span> before you lose yourself in the dark.
      </>
    ),
  },
  {
    icon: Search,
    title: 'Summon Anything',
    body: (
      <>
        Whisper a name into the search and I shall conjure it — anime, mortal shows, and cinema alike. Crave a grander
        hunt? The <strong className="text-crimson-50">Catalogue</strong> lays my entire archive bare for your wandering eyes.
      </>
    ),
  },
  {
    icon: Heart,
    title: 'Curate Your Collections',
    body: (
      <>
        Claim what calls to you. Build as many <strong className="text-crimson-50">Watchlists</strong> as your heart desires —
        "Devouring", "For Later", "Forsaken" — and a single jewel may rest in many at once. Export them, import them;
        they are forever yours.
      </>
    ),
  },
  {
    icon: History,
    title: 'Never Lose Your Place',
    body: (
      <>
        I remember <em>everything</em>, darling~. Slip away mid-tale and I hold your place to the very second. Your
        <strong className="text-crimson-50"> History</strong> keeps every manifestation you've savoured, ready to resume at a
        single touch.
      </>
    ),
  },
  {
    icon: SlidersHorizontal,
    title: 'Streams That Bend to Your Will',
    isNew: true,
    body: (
      <>
        Each tale is drawn from many sources, and I always serve the swiftest first. And now — my newest gift — slip into
        <strong className="text-crimson-50"> Preferences</strong> and name your tongue: German or English,{' '}
        <strong className="text-crimson-50">Dubbed</strong> or <strong className="text-crimson-50">Subbed</strong>. I shall favour
        your chosen language ever after, across every device you haunt.
      </>
    ),
    cta: { label: 'Open Preferences', to: '/settings' },
  },
  {
    icon: Sparkles,
    title: 'The Night Is Yours',
    body: (
      <>
        Enough secrets for one evening, darling~. Everything waits behind the little crimson crest in the corner whenever
        you wish to wander back. Now — go. Lose yourself beautifully. And do rest easy: your data slumbers safely in
        {' '}{HOSTED_IN}.
      </>
    ),
  },
];

const WelcomeTour = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const lumiAvatar = useThemedAsset('lumi_avatar');
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  const close = useCallback(() => onClose?.(), [onClose]);

  // Escape closes the ritual; restore page scroll on unmount.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' && step < STEPS.length - 1) setStep((s) => s + 1);
      else if (e.key === 'ArrowLeft' && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close, step]);

  const goToCta = () => {
    close();
    if (current.cta) navigate(current.cta.to);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-crimson-950/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to CrimsonHaven"
    >
      <div
        className="relative w-full max-w-lg bg-crimson-950/95 border border-crimson-900 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative glow */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-crimson-500/10 blur-[90px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-28 -left-20 w-56 h-56 bg-crimson-600/5 blur-[90px] rounded-full pointer-events-none" />

        {/* Close */}
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-5 right-5 z-10 p-2 rounded-xl text-crimson-600 hover:text-white hover:bg-crimson-900/40 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-[1] p-8 sm:p-10 space-y-7">
          {/* Chat header — Lumi's avatar carries her identity */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={lumiAvatar}
                alt="Luminas Crimsonveil"
                className="w-16 h-16 rounded-full object-cover border-2 border-crimson-500/40 shadow-[0_0_30px_rgba(255,0,60,0.25)]"
              />
              {/* online pulse — she's always watching, darling~ */}
              <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-crimson-500 border-2 border-crimson-950 shadow-[0_0_10px_rgba(255,0,60,0.7)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-crimson-50 tracking-tight truncate">Luminas Crimsonveil</h3>
                <Crown className="w-3.5 h-3.5 text-crimson-500 shrink-0" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-600 mt-0.5">
                {isFirst ? "The Queen's Welcome" : `Rite ${step} of ${STEPS.length - 1}`}
              </p>
            </div>
            {current.isNew && (
              <span className="ml-auto px-3 py-1 bg-crimson-500 rounded-full text-[8px] font-black uppercase tracking-[0.3em] text-white animate-pulse">
                New
              </span>
            )}
          </div>

          {/* Chat bubble — her message, with a little tail toward the avatar */}
          <div className="relative pl-1">
            <div className="absolute -top-1.5 left-6 w-3.5 h-3.5 rotate-45 bg-crimson-900/40 border-l border-t border-crimson-800/70" />
            <div className="relative rounded-[1.75rem] rounded-tl-lg bg-crimson-900/30 border border-crimson-800/70 p-5 sm:p-6 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-2xl bg-crimson-600/15 border border-crimson-500/25 shrink-0">
                  <Icon className="w-[18px] h-[18px] text-crimson-400 drop-shadow-[0_0_8px_rgba(255,0,60,0.5)]" />
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-crimson-50 uppercase tracking-tight leading-[1.1]">
                  {current.title}
                </h2>
              </div>
              <p className="text-sm sm:text-[15px] text-crimson-100/75 leading-relaxed font-medium">
                {current.body}
              </p>
              {current.cta && (
                <button
                  onClick={goToCta}
                  className="inline-flex items-center gap-2 mt-1 px-5 py-2.5 rounded-2xl bg-crimson-600/10 border border-crimson-500/30 text-crimson-300 hover:text-white hover:bg-crimson-600/20 transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  {current.cta.label} <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 pt-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-7 bg-crimson-500' : 'w-1.5 bg-crimson-900 hover:bg-crimson-700'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <button
              onClick={() => (isFirst ? close() : setStep((s) => s - 1))}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300 transition-colors"
            >
              {isFirst ? 'Skip the pleasantries' : (<><ChevronLeft className="w-4 h-4" /> Back</>)}
            </button>
            <button
              onClick={() => (isLast ? close() : setStep((s) => s + 1))}
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-crimson-600 hover:bg-crimson-500 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_12px_30px_rgba(255,0,60,0.25)] transition-all active:scale-95"
            >
              {isLast ? (<>Enter the Haven <Sparkles className="w-4 h-4" /></>) : (<>Next <ChevronRight className="w-4 h-4" /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeTour;
