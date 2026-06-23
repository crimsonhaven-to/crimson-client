import { Languages, Mic, Subtitles, Check, Info, SlidersHorizontal } from 'lucide-react';
import { usePlaybackPrefs, useTitle, PREF_LANGUAGES, PREF_TYPES } from './hooks';

// A reusable pill: the "Any" choice is the empty string, every other choice is a
// language ("German") or a type ("Dub"). Selecting the active pill again clears it
// back to "Any", so a single tap toggles a preference off.
const PrefPill = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all duration-300 active:scale-95 ${
      active
        ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
        : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-400 hover:border-crimson-600 hover:bg-crimson-900/30'
    }`}
  >
    {label}
  </button>
);

const UserSettings = () => {
  useTitle('Preferences');
  const [prefs, setPrefs] = usePlaybackPrefs();

  // Toggle semantics: tapping the active value clears it back to "Any".
  const setLanguage = (value) => setPrefs({ ...prefs, language: prefs.language === value ? '' : value });
  const setType = (value) => setPrefs({ ...prefs, type: prefs.type === value ? '' : value });

  // Human description of the resulting auto-select behaviour.
  const summary = !prefs.language && !prefs.type
    ? 'No language preference — the fastest, most reliable source plays by default.'
    : `Sources tagged ${[prefs.language, prefs.type].filter(Boolean).join(' ')} play first, with the global source order (Cache › Voe › Jellyfin) deciding within that group.`;

  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 space-y-2">
        <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
          <SlidersHorizontal className="w-9 h-9 text-crimson-500 drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" />
          <span>Your <span className="text-crimson-500">Preferences</span></span>
        </h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">Tune how the haven picks your stream</p>
      </div>

      <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-10 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

        {/* Preferred language */}
        <div className="space-y-5 relative z-10">
          <div className="flex items-center gap-3 text-crimson-500">
            <Languages className="w-6 h-6" />
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Preferred Language</h3>
          </div>
          <p className="text-xs text-crimson-300/60 font-medium leading-relaxed">
            Sources in this language are auto-selected when available.
          </p>
          <div className="flex flex-wrap gap-3">
            <PrefPill label="Any" active={!prefs.language} onClick={() => setPrefs({ ...prefs, language: '' })} />
            {PREF_LANGUAGES.map((lang) => (
              <PrefPill key={lang} label={lang} active={prefs.language === lang} onClick={() => setLanguage(lang)} />
            ))}
          </div>
        </div>

        {/* Preferred dub / sub */}
        <div className="space-y-5 relative z-10">
          <div className="flex items-center gap-3 text-crimson-500">
            <Mic className="w-6 h-6" />
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Dub or Sub</h3>
          </div>
          <p className="text-xs text-crimson-300/60 font-medium leading-relaxed">
            Whether you prefer dubbed audio or subtitled originals.
          </p>
          <div className="flex flex-wrap gap-3">
            <PrefPill label="Any" active={!prefs.type} onClick={() => setPrefs({ ...prefs, type: '' })} />
            {PREF_TYPES.map((type) => (
              <PrefPill
                key={type}
                label={type === 'Sub' ? 'Subbed' : 'Dubbed'}
                active={prefs.type === type}
                onClick={() => setType(type)}
              />
            ))}
          </div>
        </div>

        {/* Live summary of the effective behaviour */}
        <div className="relative z-10 flex items-start gap-4 p-6 bg-crimson-500/5 border border-crimson-500/20 rounded-3xl">
          <div className="p-2.5 rounded-2xl bg-crimson-900/20 shrink-0">
            {prefs.type === 'Sub' ? <Subtitles className="w-5 h-5 text-crimson-500" /> : <Info className="w-5 h-5 text-crimson-500" />}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-500" /> Saved automatically
            </p>
            <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">{summary}</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-crimson-700 font-black uppercase tracking-[0.25em] text-center leading-relaxed">
        Stored privately on this device · You can still pick any source manually while watching
      </p>
    </div>
  );
};

export default UserSettings;
