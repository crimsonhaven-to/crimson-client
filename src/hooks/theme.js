// --- Theme (client-only visual preference) ---------------------------------
// Per-DEVICE, localStorage-only — deliberately the exact same shape as the
// lite-background toggle (see useLiteBackground): a weak phone and a desktop can
// disagree, and it NEVER touches the account-synced /account/preferences
// contract. Nothing here talks to the backend.
//
// HOW THEMING WORKS — and how to add a new theme
// ----------------------------------------------------------------------------
// Every colour in the app is a Tailwind v4 CSS variable (--color-crimson-950 …
// --color-crimson-50), defined once in index.css. The DEFAULT theme (the
// original "crimson" dark look) is simply that bare @theme block. Every OTHER
// theme is ONE `:root[data-theme="<id>"]` block in index.css that re-points
// those same variables — so all ~1,200 `crimson-*` utilities and the animated
// mesh background re-skin for free, with no JSX changes.
//
// We switch themes by stamping `data-theme` on <html>. The default theme sets NO
// attribute, so first paint / anyone without the pref sees the untouched dark
// look with zero risk. Optional per-theme image swaps (e.g. the Catgirl-Lumi
// art) are declared in THEMES below and resolved via themedAsset/useThemedAsset.
//
// To add a theme:
//   1. add an entry to THEMES (id + label + optional image overrides),
//   2. add its `:root[data-theme="<id>"]` block in index.css,
//   3. (optional) add a mobile chrome colour to THEME_COLORS,
//   4. drop any override art in /public and point the image keys at it.
import { useEffect, useState } from 'react';
// The welcome-tour avatar is a bundled asset (hashed by Vite), unlike the other
// Lumi art which lives in /public. Import it so the crimson default resolves to
// the exact same file it always used — the default theme stays pixel-identical.
import lumiCuty from '../assets/lumi_cuty.png';

export const DEFAULT_THEME = 'crimson';

// Registry — the single source of truth for which themes exist. `images` maps a
// logical key to a public URL; ANY key a theme omits transparently falls back to
// the default theme's asset (see themedAsset), so a half-finished theme whose art
// hasn't been drawn yet still renders correctly instead of showing broken images.
export const THEMES = {
  crimson: {
    id: 'crimson',
    label: 'Crimson',
    tagline: 'The original dark sanctuary.',
    // The canonical Lumi art — also the fallback for every other theme.
    images: {
      lumi_404: '/lumi_404.png',
      lumi_nobackground: '/lumi_nobackground.png',
      lumi_avatar: lumiCuty,
      secret_peace: '/lumi_secret_lumi_peace.png',
      secret_mascot: '/lumi_secret_nobackgroundmascot.png',
      secret_cuty: '/lumi_secret_lumi_cuty.png',
      secret_sideways: '/lumi_secret_lumi_sideways.png',
      secret_annoyed: '/lumi_secret_annoyed_lumi.png',
    },
  },
  catgirl: {
    id: 'catgirl',
    label: 'Catgirl Lumi',
    tagline: 'Light — with a mischievous crimson wink.',
    // Colours live in index.css (:root[data-theme="catgirl"]). Her catgirl art
    // lives in /public/catgirl/. Any key omitted here transparently falls back
    // to the crimson art above — `secret_sideways` has no catgirl variant yet,
    // so that one shrine pose intentionally shows the normal Lumi.
    images: {
      lumi_404: '/catgirl/lumi_404_cat.png',
      lumi_nobackground: '/catgirl/lumi_nobackground_cat.png',
      lumi_avatar: '/catgirl/lumi_secret_lumi_cuty_cat.png',
      secret_peace: '/catgirl/lumi_secret_lumi_peace_cat.png',
      secret_mascot: '/catgirl/lumi_secret_nobackgroundmascot_cat.png',
      secret_cuty: '/catgirl/lumi_secret_lumi_cuty_cat.png',
      // secret_sideways — no catgirl art yet; falls back to the crimson pose.
      secret_annoyed: '/catgirl/lumi_secret_annoyed_lumi_cat.png',
    },
  },
};

// Stable, render-friendly list for building the theme picker UI.
export const THEME_LIST = Object.values(THEMES);

const THEME_KEY = 'crimson:theme';

// Mobile browser-chrome colour per theme (keeps the PWA status bar on-brand).
// Falls back to the default theme's colour for anything unlisted.
const THEME_COLORS = {
  crimson: '#1a0005',
  catgirl: '#fff5f7',
};

function normalize(id) {
  return Object.prototype.hasOwnProperty.call(THEMES, id) ? id : DEFAULT_THEME;
}

export function getTheme() {
  try {
    return normalize(localStorage.getItem(THEME_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

// Reflect the active theme into the DOM: `data-theme` on <html> (which drives
// the CSS-variable overrides) plus the mobile theme-color meta. The default
// theme CLEARS the attribute, so the untouched dark look needs no CSS override
// to exist — it is the baseline. Kept as a plain function (no React) so the
// boot path and the inline FOUC guard in index.html can both use the same logic.
export function applyThemeToDom(id) {
  const theme = normalize(id);
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS[DEFAULT_THEME]);
}

export function setTheme(id) {
  const theme = normalize(id);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode / storage blocked — the live DOM update below still applies */
  }
  applyThemeToDom(theme);
  // Same event/broadcast pattern as the lite-background toggle so every mounted
  // useTheme() re-renders the instant the choice flips, in this tab and others.
  window.dispatchEvent(new Event('crimson-theme'));
}

export function useTheme() {
  const [theme, setThemeState] = useState(getTheme);
  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    window.addEventListener('crimson-theme', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-theme', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return theme;
}

// --- Themed images ---------------------------------------------------------
// Resolve a logical image key to a URL for a given theme, falling back to the
// default theme's asset when the theme hasn't overridden that key.
export function themedAsset(key, themeId = getTheme()) {
  const theme = THEMES[normalize(themeId)];
  return (theme.images && theme.images[key]) || THEMES[DEFAULT_THEME].images[key];
}

// Hook form for function components — re-resolves when the theme changes.
export function useThemedAsset(key) {
  const theme = useTheme();
  return themedAsset(key, theme);
}
