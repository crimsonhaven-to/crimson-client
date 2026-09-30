// Per-device like the lite-background toggle, never synced to the account.
//
// Every colour is a Tailwind v4 CSS variable (--color-crimson-*) from index.css.
// The default theme is the bare @theme block and sets no `data-theme` attribute;
// every other theme is one `:root[data-theme="<id>"]` block re-pointing those
// variables, so all `crimson-*` utilities re-skin with no JSX changes.
//
// To add a theme:
//   1. add an entry to THEMES (id + label + optional image overrides),
//   2. add its `:root[data-theme="<id>"]` block in index.css,
//   3. (optional) add a mobile chrome colour to THEME_COLORS,
//   4. drop any override art in /public and point the image keys at it.
import { useEffect, useState } from 'react';
// Unlike the other Lumi art in /public, the welcome-tour avatar is a
// Vite-hashed bundled asset.
import lumiCuty from '../assets/lumi_cuty.png';

export const DEFAULT_THEME = 'crimson';

// Any image key a theme omits falls back to the default theme's asset, so a theme
// whose art is not drawn yet still renders.
export const THEMES = {
  crimson: {
    id: 'crimson',
    label: 'Crimson',
    tagline: 'The original dark sanctuary.',
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
    tagline: 'Light, with a mischievous crimson wink.',
    images: {
      lumi_404: '/catgirl/lumi_404_cat.png',
      lumi_nobackground: '/catgirl/lumi_nobackground_cat.png',
      lumi_avatar: '/catgirl/lumi_secret_lumi_cuty_cat.png',
      secret_peace: '/catgirl/lumi_secret_lumi_peace_cat.png',
      secret_mascot: '/catgirl/lumi_secret_nobackgroundmascot_cat.png',
      secret_cuty: '/catgirl/lumi_secret_lumi_cuty_cat.png',
      // secret_sideways has no catgirl art yet, so that shrine pose shows normal Lumi.
      secret_annoyed: '/catgirl/lumi_secret_annoyed_lumi_cat.png',
    },
  },
};

export const THEME_LIST = Object.values(THEMES);

const THEME_KEY = 'crimson:theme';

// Mobile browser-chrome colour, so the PWA status bar matches the theme.
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

// index.html has an inline copy of this that runs before first paint.
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
    /* private mode or storage blocked: the live DOM update below still applies */
  }
  applyThemeToDom(theme);
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

export function themedAsset(key, themeId = getTheme()) {
  const theme = THEMES[normalize(themeId)];
  return (theme.images && theme.images[key]) || THEMES[DEFAULT_THEME].images[key];
}

export function useThemedAsset(key) {
  const theme = useTheme();
  return themedAsset(key, theme);
}
