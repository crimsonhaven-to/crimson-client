// The language/type preference is the only auto-select key: ties fall back to
// arrival order, with no provider ranking underneath. localStorage is the
// synchronous cache the ranker reads; the account sync is best-effort, so an
// unreachable backend never breaks ranking.
import { useCallback, useEffect, useState } from 'react';

import { SESSION_KEY, apiFetch } from './apiClient';

const PLAYBACK_PREFS_KEY = 'crimson:playback-prefs';
const EMPTY_PLAYBACK_PREFS = { language: '', type: '', discordPresence: false, subtitleLanguages: [] };

// Matched as case-insensitive substrings of the scraper's language tag
// ("German Dub", "English Sub"), so minor label variations still match.
export const PREF_LANGUAGES = ['German', 'English', 'Japanese', 'Spanish', 'French', 'Italian'];
export const PREF_TYPES = ['Dub', 'Sub'];

// Unlike PREF_LANGUAGES (which picks the source by audio), these only choose which
// OpenSubtitles .vtt tracks to fetch. `code` is what the backend passes on.
export const SUBTITLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'pt-br', label: 'Portuguese (BR)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
];
const SUBTITLE_LANGUAGE_CODES = new Set(SUBTITLE_LANGUAGES.map((l) => l.code));

// The list round-trips through the synced prefs blob and the URL, so it is never
// trusted as-is.
export function cleanSubtitleLanguages(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value) {
    const code = typeof v === 'string' ? v.trim().toLowerCase() : '';
    if (SUBTITLE_LANGUAGE_CODES.has(code) && !out.includes(code)) out.push(code);
    if (out.length >= 8) break;
  }
  return out;
}

export function getPlaybackPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAYBACK_PREFS_KEY) || '{}');
    return {
      language: typeof raw.language === 'string' ? raw.language : '',
      type: typeof raw.type === 'string' ? raw.type : '',
      discordPresence: typeof raw.discordPresence === 'boolean' ? raw.discordPresence : false,
      subtitleLanguages: cleanSubtitleLanguages(raw.subtitleLanguages),
    };
  } catch {
    return { ...EMPTY_PLAYBACK_PREFS };
  }
}

export function setPlaybackPrefs(prefs) {
  const clean = {
    language: typeof prefs?.language === 'string' ? prefs.language : '',
    type: typeof prefs?.type === 'string' ? prefs.type : '',
    discordPresence: typeof prefs?.discordPresence === 'boolean' ? prefs.discordPresence : false,
    subtitleLanguages: cleanSubtitleLanguages(prefs?.subtitleLanguages),
  };
  localStorage.setItem(PLAYBACK_PREFS_KEY, JSON.stringify(clean));
  window.dispatchEvent(new Event('crimson-playback-prefs'));
  return clean;
}

// Fire-and-forget: the local cache is already updated, and the next change or
// login re-syncs. Skipped when signed out because the PUT would just 401.
function persistPlaybackPrefsRemote(prefs) {
  if (!localStorage.getItem(SESSION_KEY)) return;
  apiFetch('/account/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  }).catch(() => {});
}

// The server wins when it has a value. When it has none, the local choice is
// pushed up once, migrating users who set a preference before syncing existed.
export function syncPlaybackPrefsFromAccount(remote) {
  const r = remote && typeof remote === 'object' ? remote : {};
  // A stored `discordPresence: false` counts, so a deliberate opt-out is not
  // clobbered by a stale local default.
  const hasRemote = r.language || r.type || typeof r.discordPresence === 'boolean' || Array.isArray(r.subtitleLanguages);
  if (hasRemote) {
    const next = {
      language: r.language || '',
      type: r.type || '',
      discordPresence: !!r.discordPresence,
      subtitleLanguages: cleanSubtitleLanguages(r.subtitleLanguages),
    };
    const local = getPlaybackPrefs();
    const subsChanged = local.subtitleLanguages.join(',') !== next.subtitleLanguages.join(',');
    if (local.language !== next.language || local.type !== next.type || local.discordPresence !== next.discordPresence || subsChanged) {
      setPlaybackPrefs(next);
    }
  } else {
    const local = getPlaybackPrefs();
    if (local.language || local.type || local.discordPresence || local.subtitleLanguages.length) persistPlaybackPrefsRemote(local);
  }
}

// Hydration from the account happens in useProfile, which is always mounted and
// fires the same event this listens to.
export function usePlaybackPrefs() {
  const [prefs, setPrefs] = useState(getPlaybackPrefs);
  useEffect(() => {
    const sync = () => setPrefs(getPlaybackPrefs());
    window.addEventListener('crimson-playback-prefs', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crimson-playback-prefs', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const update = useCallback((next) => {
    const clean = setPlaybackPrefs(next);
    persistPlaybackPrefsRemote(clean);
    return clean;
  }, []);
  return [prefs, update];
}
