import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, CalendarDays, ChevronLeft, ChevronRight, Crown, Gift, Heart, Music, Palette, Puzzle, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { HOSTED_IN } from '../api/config';
import { usePublicConfig } from '../api/client';
import { useLumiStatus } from '../lumi/hooks';
import { useThemedAsset } from '../account/theme';

// Shown once per login; the trigger lives in App.jsx. A step with `when` appears only
// if that feature is live for this viewer, so the tour never points at a missing door.
const STEPS = [
  {
    icon: Crown,
    title: 'Welcome to the Haven',
    body: () => (
      <>
        Ahh… a fresh pulse graces my sanctuary. I am <strong className="text-crimson-50">Luminas Crimsonveil</strong>,
        eternal curator of this place. Lean close, darling~. Let me unveil the little delights woven into your
        <span className="text-crimson-400 font-bold"> crimsonhaven</span> before you lose yourself in the dark.
      </>
    ),
  },
  {
    icon: Search,
    title: 'Summon Anything',
    body: ({ liveTvEnabled, localEnabled }) => (
      <>
        Whisper a name into the search and I shall conjure it: anime, mortal shows and cinema alike. Crave a grander
        hunt? <strong className="text-crimson-50">Anime</strong>, <strong className="text-crimson-50">Shows</strong>,{' '}
        <strong className="text-crimson-50">Movies</strong> and <strong className="text-crimson-50">Manga</strong> each keep
        their own hall above, and manga is read right here, chapter by chapter.
        {liveTvEnabled && <> <strong className="text-crimson-50">Live TV</strong> streams channels as they air.</>}
        {localEnabled && <> The <strong className="text-crimson-50">Local</strong> vault holds this castle&apos;s own library.</>}
        {' '}And the rows on the home page? Picked from what you have already savoured.
      </>
    ),
  },
  {
    icon: SlidersHorizontal,
    title: 'Streams That Bend to Your Will',
    body: () => (
      <>
        Each tale is drawn from many sources and I serve the swiftest first; the gear in the player lets you switch.
        I skip the intro and outro at a touch, and <strong className="text-crimson-50">Auto-Next</strong> carries you into
        the following episode. In <strong className="text-crimson-50">Preferences</strong>, name your tongue,{' '}
        <strong className="text-crimson-50">Dubbed</strong> or <strong className="text-crimson-50">Subbed</strong>, and your
        subtitle languages; I remember them on every device you haunt.
      </>
    ),
    cta: { label: 'Open Preferences', to: '/settings' },
  },
  {
    icon: Heart,
    title: 'Curate Your Collections',
    body: () => (
      <>
        Build as many <strong className="text-crimson-50">Watchlists</strong> as your heart desires, sort them by hand, and
        let a single jewel rest in many at once. Export them, import them; they are forever yours. And slip away
        mid-tale without a care: your <strong className="text-crimson-50">History</strong> holds your place to the very second.
      </>
    ),
  },
  {
    icon: CalendarDays,
    title: 'Never Miss a Night',
    isNew: true,
    body: () => (
      <>
        The <strong className="text-crimson-50">Calendar</strong> shows when every airing episode arrives, in your own hours.
        <strong className="text-crimson-50"> Follow</strong> a title and I shall mark it for you, and send word by email the
        moment a new episode lands, once your address is verified.
      </>
    ),
    cta: { label: 'Open the Calendar', to: '/calendar' },
  },
  {
    icon: Music,
    title: 'A Song for the Dark',
    isNew: true,
    when: ({ musicEnabled }) => musicEnabled,
    body: () => (
      <>
        <strong className="text-crimson-50">Music</strong> now sings in the Haven. Bring your Spotify playlists or a CSV, or
        build your own by searching. Let songs <strong className="text-crimson-50">crossfade</strong> into one another,
        and download whole playlists to play with no signal at all, lock screen and all.
      </>
    ),
    cta: { label: 'Open Music', to: '/music' },
  },
  {
    icon: Puzzle,
    title: 'The Crimson Companion',
    body: () => (
      <>
        My <strong className="text-crimson-50">Companion</strong> for Chrome and Firefox lets your own browser fetch the
        sources, straight from your connection, so more of them answer and they answer faster. It takes but a
        moment to claim.
      </>
    ),
    cta: { label: 'Claim the Companion', to: '/extension' },
  },
  {
    icon: Palette,
    title: 'Make It Yours',
    isNew: true,
    body: () => (
      <>
        Dress the Haven in another <strong className="text-crimson-50">theme</strong> (a certain catgirl has her own~), or
        calm the background on gentler devices. With a tiny desktop helper,{' '}
        <strong className="text-crimson-50">Discord Presence</strong> tells your friends what you watch and hear. All of
        it waits in Preferences.
      </>
    ),
    cta: { label: 'Open Preferences', to: '/settings' },
  },
  {
    icon: Gift,
    title: 'Your Year in Crimson',
    isNew: true,
    body: ({ musicEnabled }) => (
      <>
        Every tale you finish, I remember. <strong className="text-crimson-50">Crimson Wrapped</strong> lays your year
        bare: where your hours went, your favourite genres, your longest streak{musicEnabled ? ', and the songs you could not stop playing' : ''}.
        Find it in your account menu, up in the corner.
      </>
    ),
    cta: { label: 'Open Wrapped', to: '/wrapped' },
  },
  {
    icon: Bot,
    title: 'Whisper to Me',
    when: ({ lumiAvailable }) => lumiAvailable,
    body: () => (
      <>
        You are among the few I speak with directly, darling~. Summon me from the corner of any page, ask for something
        to watch, and I shall find it and start it for you.
      </>
    ),
  },
  {
    icon: Sparkles,
    title: 'The Night Is Yours',
    body: () => (
      <>
        Enough secrets for one evening. Your account, your sessions and a full export of your data wait in your
        account menu, up in the corner, whenever you wish to wander back. Now, go. Lose yourself beautifully. And do rest easy: your
        data slumbers safely in {HOSTED_IN}.
      </>
    ),
  },
];

const WelcomeTour = ({ musicEnabled, onClose }) => {
  const { live_tv_enabled: liveTvEnabled, local_library_enabled: localEnabled } = usePublicConfig();
  const lumiAvailable = !!useLumiStatus()?.available;
  const features = { musicEnabled, liveTvEnabled, localEnabled, lumiAvailable };
  const steps = STEPS.filter((s) => !s.when || s.when(features));
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const lumiAvatar = useThemedAsset('lumi_avatar');
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const current = steps[step];
  const Icon = current.icon;

  const close = useCallback(() => onClose?.(), [onClose]);

  // Escape closes the ritual; restore page scroll on unmount.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' && step < steps.length - 1) setStep((s) => s + 1);
      else if (e.key === 'ArrowLeft' && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close, step, steps.length]);

  const goToCta = () => {
    close();
    if (current.cta) navigate(current.cta.to);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex overflow-y-auto p-4 sm:p-6 bg-crimson-950/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to CrimsonHaven"
    >
      <div
        className="relative m-auto w-full max-w-lg bg-crimson-950/95 border border-crimson-900 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-crimson-500/10 blur-[90px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-28 -left-20 w-56 h-56 bg-crimson-600/5 blur-[90px] rounded-full pointer-events-none" />

        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-5 right-5 z-10 p-2 rounded-xl text-crimson-600 hover:text-white hover:bg-crimson-900/40 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-[1] p-8 sm:p-10 space-y-7">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={lumiAvatar}
                alt="Luminas Crimsonveil"
                className="w-16 h-16 rounded-full object-cover border-2 border-crimson-500/40 shadow-[0_0_30px_rgba(255,0,60,0.25)]"
              />
              <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-crimson-500 border-2 border-crimson-950 shadow-[0_0_10px_rgba(255,0,60,0.7)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-crimson-50 tracking-tight truncate">Luminas Crimsonveil</h3>
                <Crown className="w-3.5 h-3.5 text-crimson-500 shrink-0" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-crimson-600 mt-0.5">
                {isFirst ? "The Queen's Welcome" : `Rite ${step} of ${steps.length - 1}`}
              </p>
            </div>
            {current.isNew && (
              <span className="ml-auto px-3 py-1 bg-crimson-500 rounded-full text-[8px] font-black uppercase tracking-[0.3em] text-white animate-pulse">
                New
              </span>
            )}
          </div>

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
                {current.body(features)}
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

          <div className="flex items-center justify-center gap-2 pt-1">
            {steps.map((_, i) => (
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
