// --- User language / dub-sub preference -------------------------------------
// A purely client-side preference (stored in localStorage) that biases which
// source auto-plays. It layers ON TOP of the global source priority: streams whose
// `language` tag matches the user's preferred language/type are ranked first, and
// WITHIN that matching tier the global source order (Cache > Voe > Jellyfin) still
// decides — so "Cache German Dub" still beats "Voe German Dub". With no preference
// set, every stream scores equal on language and pure source priority is restored.
//
// localStorage is the synchronous cache the ranker reads; the choice is also synced
// to the account (see persistPlaybackPrefsRemote / syncPlaybackPrefsFromAccount) so
// it follows the user across devices. The sync is best-effort — if the backend is
// unreachable the local cache stays authoritative, so ranking never breaks.
import { useCallback, useEffect, useState } from 'react';

import { SESSION_KEY, apiFetch } from './apiClient';

const PLAYBACK_PREFS_KEY = 'crimson:playback-prefs';
// `discordPresence` opts the viewer into broadcasting a Discord Rich Presence
// (see discordPresence.js). It rides in the same client-preferences blob as the
// language/dub-sub choice so it persists locally AND syncs to the account exactly
// like them — one PUT carries all three.
const EMPTY_PLAYBACK_PREFS = { language: '', type: '', discordPresence: false, subtitleLanguages: [] };

// The languages/types offered in the settings UI. `value` is matched as a
// case-insensitive substring against the scraper's language tag ("German Dub",
// "English Sub", …), so it stays robust to minor label variations.
export const PREF_LANGUAGES = ['German', 'English', 'Japanese', 'Spanish', 'French', 'Italian'];
export const PREF_TYPES = ['Dub', 'Sub'];

// Languages offered for OpenSubtitles external subtitle tracks (player CC menu).
// `code` is the 2-letter code the backend passes to OpenSubtitles; `label` is what
// the settings UI shows. Distinct from PREF_LANGUAGES (which biases SOURCE choice
// by audio language) — these only pick which downloadable .vtt tracks to fetch.
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

// Defensive sanitiser for the subtitle-language list: keep only known 2-letter
// codes, de-duped, capped — the value is round-tripped through the synced prefs
// blob and the URL, so we never trust it blindly.
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
  // Broadcast so any open watch page / other tab can pick up the change live.
  window.dispatchEvent(new Event('crimson-playback-prefs'));
  return clean;
}

// Durably persist the preference to the account so it follows the user across
// devices. Fire-and-forget: the local cache (read by the ranker) is already
// updated, so a failed/offline write never blocks the UI — the next change or the
// next login re-syncs. Skipped when signed out (the PUT would just 401).
function persistPlaybackPrefsRemote(prefs) {
  if (!localStorage.getItem(SESSION_KEY)) return;
  apiFetch('/account/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  }).catch(() => {});
}

// Reconcile the account's server-side preference (from /account/me) with the local
// cache the stream ranker reads. The server is authoritative when it has a value
// (mirror it down so the choice follows the user to a fresh device); when it has
// none yet, push any existing local choice up so it becomes the account default —
// a one-time, silent migration for users who set a preference before this synced.
export function syncPlaybackPrefsFromAccount(remote) {
  const r = remote && typeof remote === 'object' ? remote : {};
  // The account holds a value once any preference has ever been saved — note a
  // stored `discordPresence: false` still counts, so we don't clobber a deliberate
  // opt-out by pushing a stale local default back up.
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

// Reactive accessor for the settings page. Returns [prefs, update] where update
// writes the local cache (read synchronously by the ranker), broadcasts to other
// tabs, and persists to the account. Hydration from the account happens in
// useProfile (always mounted), which broadcasts the same event this listens to.
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
    const clean = setPlaybackPrefs(next); // local cache + 'crimson-playback-prefs' event
    persistPlaybackPrefsRemote(clean);    // durable, cross-device (best-effort)
    return clean;
  }, []);
  return [prefs, update];
}
