import { useState, useEffect } from 'react';
import { Languages, Mic, Subtitles, Check, Info, SlidersHorizontal, Gamepad2, Download, UserRound, Loader2, AlertTriangle, Gauge, Palette } from 'lucide-react';
import { usePlaybackPrefs, useLiteBackground, setLiteBackground, useTheme, setTheme, THEME_LIST, useTitle, useProfile, updateUsername, PREF_LANGUAGES, PREF_TYPES, SUBTITLE_LANGUAGES } from './hooks';

// The little local bridge that carries presence from the haven to your Discord
// client (see rpc-helper/). The binaries are cross-compiled into the site image
// and served from /helper — same origin — so they download straight from
// Crimson Haven (the repo is private, so GitHub Releases wouldn't be reachable).
const HELPER_DIR = '/helper';
const HELPER_BUILDS = [
  { key: 'windows-amd64', label: 'Windows x64',         file: 'crimson-presence-helper-windows-amd64.exe' },
  { key: 'windows-arm64', label: 'Windows ARM',         file: 'crimson-presence-helper-windows-arm64.exe' },
  { key: 'macos-amd64',   label: 'macOS Intel',         file: 'crimson-presence-helper-macos-amd64' },
  { key: 'macos-arm64',   label: 'macOS Apple Silicon', file: 'crimson-presence-helper-macos-arm64' },
  { key: 'linux-amd64',   label: 'Linux x64',           file: 'crimson-presence-helper-linux-amd64' },
  { key: 'linux-arm64',   label: 'Linux ARM',           file: 'crimson-presence-helper-linux-arm64' },
];
const helperHref = (file) => `${HELPER_DIR}/${file}`;

// Best one-click guess for the visitor's machine. We pick the amd64 build per OS
// because it runs everywhere — natively on x64, and via Rosetta / Windows-on-ARM
// emulation otherwise — so a single tap "just works" for nearly everyone; the
// keen can still grab a native ARM build from the full list.
function guessHelper() {
  const probe =
    typeof navigator !== 'undefined'
      ? `${navigator.userAgent} ${navigator.platform || ''}`.toLowerCase()
      : '';
  const want = probe.includes('mac')
    ? 'macos-amd64'
    : probe.includes('linux') || probe.includes('x11')
      ? 'linux-amd64'
      : 'windows-amd64';
  return HELPER_BUILDS.find((b) => b.key === want);
}

// A simple on/off switch styled to match the crimson pills.
const PrefToggle = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    role="switch"
    aria-checked={active}
    aria-label={label}
    className={`relative w-16 h-9 rounded-full border transition-all duration-300 active:scale-95 shrink-0 ${
      active
        ? 'bg-crimson-600 border-crimson-400 shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
        : 'bg-crimson-950/60 border-crimson-900/60'
    }`}
  >
    <span
      className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow-md transition-all duration-300 ${
        active ? 'left-8' : 'left-1'
      }`}
    />
  </button>
);

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

// Display-name card: the cosmetic name Luminas greets you by ("Recommended for
// you, {name}"). Saved server-side (PUT /account/username) so it follows the user
// across devices; clearing it falls back to a generic greeting.
const DisplayNameCard = () => {
  const profile = useProfile();
  const MAX = 20;
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Seed the field once the profile loads (and whenever the stored name changes,
  // e.g. after a successful save the profile refetches with the same value).
  useEffect(() => { setName(profile?.username || ''); }, [profile?.username]);

  const dirty = (profile?.username || '') !== name.trim();

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await updateUsername(name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message || 'Could not save your name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>
      <div className="space-y-3 relative z-10">
        <div className="flex items-center gap-3 text-crimson-500">
          <UserRound className="w-6 h-6" />
          <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Your Name</h3>
        </div>
        <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
          What shall Luminas call you, darling? She'll whisper it when she lays your
          curated cravings before you — <span className="text-crimson-300">"Recommended for you, {name.trim() || 'mortal'}"</span>.
          Leave it empty to stay a nameless wanderer of the haven.
        </p>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={name}
          maxLength={MAX}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !saving) save(); }}
          placeholder="A name for the Queen to know you by…"
          className="flex-grow px-5 py-4 rounded-2xl bg-crimson-950/50 border border-crimson-900/60 text-crimson-50 placeholder-crimson-700 font-bold tracking-wide focus:outline-none focus:border-crimson-500/60 transition-colors"
        />
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-7 py-4 rounded-2xl bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 disabled:text-crimson-700 text-white font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Etching' : 'Save Name'}
        </button>
      </div>

      {error && (
        <p className="relative z-10 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-crimson-400">
          <AlertTriangle className="w-3.5 h-3.5 text-crimson-500" /> {error}
        </p>
      )}
      {saved && !error && (
        <p className="relative z-10 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-crimson-400">
          <Check className="w-3.5 h-3.5 text-green-500" /> Luminas will remember you as {name.trim() || 'a nameless wanderer'}.
        </p>
      )}
    </div>
  );
};

const UserSettings = () => {
  useTitle('Preferences');
  const [prefs, setPrefs] = usePlaybackPrefs();
  // Client-only, per-device perf preference (not part of the synced prefs blob).
  const lite = useLiteBackground();
  // Client-only, per-device visual theme (also not synced). See src/hooks/theme.js.
  const theme = useTheme();

  // Toggle semantics: tapping the active value clears it back to "Any".
  const setLanguage = (value) => setPrefs({ ...prefs, language: prefs.language === value ? '' : value });
  const setType = (value) => setPrefs({ ...prefs, type: prefs.type === value ? '' : value });
  const toggleDiscord = () => setPrefs({ ...prefs, discordPresence: !prefs.discordPresence });

  // Subtitle languages are a multi-select (any number on at once). Tapping a pill
  // adds/removes its code from the list the watch page fetches from OpenSubtitles.
  const subLangs = prefs.subtitleLanguages || [];
  const toggleSubtitleLang = (code) =>
    setPrefs({
      ...prefs,
      subtitleLanguages: subLangs.includes(code)
        ? subLangs.filter((c) => c !== code)
        : [...subLangs, code],
    });
  const toggleLite = () => setLiteBackground(!lite);

  // One-click helper download tailored to the visitor's OS.
  const helper = guessHelper();

  // Human description of the resulting auto-select behaviour.
  const summary = !prefs.language && !prefs.type
    ? 'No language preference — the first source to load plays by default.'
    : `Sources tagged ${[prefs.language, prefs.type].filter(Boolean).join(' ')} auto-play whenever one is available; otherwise the first source to load plays.`;

  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 space-y-2">
        <h2 className="text-4xl sm:text-5xl font-black text-crimson-50 uppercase tracking-tighter flex items-center gap-4">
          <SlidersHorizontal className="w-9 h-9 text-crimson-500 drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" />
          <span>Your <span className="text-crimson-500">Preferences</span></span>
        </h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">Tune how the haven picks your stream</p>
      </div>

      {/* Display name — how Luminas greets you across the haven. */}
      <DisplayNameCard />

      <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-10 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

        {/* Preferred language */}
        <div className="space-y-5 relative z-10">
          <div className="flex items-center gap-3 text-crimson-500">
            <Languages className="w-6 h-6" />
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Preferred Language</h3>
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
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Dub or Sub</h3>
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

        {/* Subtitle languages — external OpenSubtitles tracks shown in the player's
            CC menu. Multi-select; empty = off (no extra tracks fetched). */}
        <div className="space-y-5 relative z-10">
          <div className="flex items-center gap-3 text-crimson-500">
            <Subtitles className="w-6 h-6" />
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Subtitle Languages</h3>
          </div>
          <p className="text-xs text-crimson-300/60 font-medium leading-relaxed">
            Pull matching subtitles from OpenSubtitles into the player's caption menu —
            handy when a source ships none. Pick any number; leave all off to skip them.
          </p>
          <div className="flex flex-wrap gap-3">
            {SUBTITLE_LANGUAGES.map(({ code, label }) => (
              <PrefPill
                key={code}
                label={label}
                active={subLangs.includes(code)}
                onClick={() => toggleSubtitleLang(code)}
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

      {/* Discord Rich Presence */}
      <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

        <div className="flex items-start justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-crimson-500">
              <Gamepad2 className="w-6 h-6" />
              <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Discord Presence</h3>
            </div>
            <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
              Let Luminas whisper to Discord what you're watching — a little rich-presence
              card on your profile. Nothing leaves your machine, and you can banish it anytime.
              Because Discord only trusts its own site, this needs a tiny local bridge of
              Luminas' own making, summoned just below. No bridge, no presence — nothing breaks.
            </p>
          </div>
          <PrefToggle active={prefs.discordPresence} onClick={toggleDiscord} label="Toggle Discord Rich Presence" />
        </div>

        {/* The helper bridge is required for presence to actually reach Discord. */}
        <div className="relative z-10 flex items-start gap-4 p-6 bg-crimson-900/20 border border-crimson-700/30 rounded-3xl">
          <div className="p-2.5 rounded-2xl bg-crimson-900/30 shrink-0">
            <Download className="w-5 h-5 text-crimson-400" />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em]">
              Summon the Crimson Bridge
            </p>
            <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">
              For Luminas' whispers to reach Discord, a small familiar must keep watch on your
              machine. Call the little bridge down{' '}
              <a
                href={helperHref(helper.file)}
                download
                className="text-crimson-300 font-bold underline decoration-dotted underline-offset-2 hover:text-white"
              >
                here
              </a>{' '}
              ({helper.label}) and let it dwell in your taskbar beside Discord — without it, the
              toggle stirs but your profile stays silent.
            </p>
            <p className="text-[11px] text-crimson-400/70 leading-relaxed font-medium">
              Another machine?{' '}
              {HELPER_BUILDS.map((b, i) => (
                <span key={b.key}>
                  {i > 0 && <span className="text-crimson-700"> · </span>}
                  <a
                    href={helperHref(b.file)}
                    download
                    className="underline decoration-dotted underline-offset-2 hover:text-crimson-200"
                  >
                    {b.label}
                  </a>
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-start gap-4 p-6 bg-crimson-500/5 border border-crimson-500/20 rounded-3xl">
          <div className="p-2.5 rounded-2xl bg-crimson-900/20 shrink-0">
            <Gamepad2 className="w-5 h-5 text-crimson-500" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-500" /> Saved automatically
            </p>
            <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">
              {prefs.discordPresence
                ? 'Your Discord now flaunts "Watching …" while you stream, and "Browsing the archives…" while you wander.'
                : 'Your viewing stays unseen — no presence is broadcast to Discord.'}
            </p>
          </div>
        </div>
      </div>

      {/* Theme — a per-device visual theme (not account-synced). Adding a theme
          to src/hooks/theme.js makes it appear here automatically. */}
      <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-3 text-crimson-500">
            <Palette className="w-6 h-6" />
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Theme</h3>
          </div>
          <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
            Dress the haven to your taste. The choice lives on this device alone —
            it never leaves it, and never touches your account.
          </p>
        </div>

        <div className="relative z-10 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Theme">
          {THEME_LIST.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                role="radio"
                aria-checked={active}
                className={`text-left p-5 rounded-3xl border transition-all active:scale-[0.98] ${
                  active
                    ? 'bg-crimson-500/10 border-crimson-500/50 shadow-[0_8px_24px_rgba(255,0,60,0.15)]'
                    : 'bg-crimson-950/40 border-crimson-900/50 hover:border-crimson-700/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-crimson-50 uppercase tracking-tight">{t.label}</span>
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      active ? 'bg-crimson-500 border-crimson-400' : 'border-crimson-800'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 text-white" />}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-crimson-300/70 font-medium leading-relaxed">{t.tagline}</p>
              </button>
            );
          })}
        </div>

        <div className="relative z-10 flex items-start gap-4 p-6 bg-crimson-500/5 border border-crimson-500/20 rounded-3xl">
          <div className="p-2.5 rounded-2xl bg-crimson-900/20 shrink-0">
            <Palette className="w-5 h-5 text-crimson-500" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-500" /> Saved on this device
            </p>
            <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">
              The haven currently wears{' '}
              <span className="text-crimson-300 font-bold">
                {(THEME_LIST.find((t) => t.id === theme) || THEME_LIST[0]).label}
              </span>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Lite background — a per-device performance toggle (not account-synced). */}
      <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

        <div className="flex items-start justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-crimson-500">
              <Gauge className="w-6 h-6" />
              <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Lite Background</h3>
            </div>
            <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
              The living crimson mist is beautiful but hungry on weaker machines. Still it,
              and Luminas lets the glow rest as a calm, static gradient — gentler on the GPU
              and your battery. This choice stays on this device alone.
            </p>
          </div>
          <PrefToggle active={lite} onClick={toggleLite} label="Toggle Lite Background" />
        </div>

        <div className="relative z-10 flex items-start gap-4 p-6 bg-crimson-500/5 border border-crimson-500/20 rounded-3xl">
          <div className="p-2.5 rounded-2xl bg-crimson-900/20 shrink-0">
            <Gauge className="w-5 h-5 text-crimson-500" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-500" /> Saved on this device
            </p>
            <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">
              {lite
                ? 'The mist lies still — a calm crimson gradient, lightest on your hardware.'
                : "The crimson mist drifts as Luminas intended — full, living, and aglow."}
            </p>
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
