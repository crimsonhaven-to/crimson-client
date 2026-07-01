import { beforeEach, describe, it, expect } from 'vitest';

import { cleanSubtitleLanguages, getPlaybackPrefs, setPlaybackPrefs } from './playbackPrefs';

describe('cleanSubtitleLanguages', () => {
  it('keeps only known 2-letter codes, lower-cased and de-duped', () => {
    expect(cleanSubtitleLanguages(['en', 'DE', 'en', ' fr '])).toEqual(['en', 'de', 'fr']);
  });

  it('drops unknown codes and non-strings', () => {
    expect(cleanSubtitleLanguages(['en', 'xx', 'klingon', 42, null])).toEqual(['en']);
  });

  it('returns [] for anything that is not an array', () => {
    expect(cleanSubtitleLanguages('en')).toEqual([]);
    expect(cleanSubtitleLanguages(undefined)).toEqual([]);
    expect(cleanSubtitleLanguages(null)).toEqual([]);
  });

  it('caps the list at 8 entries', () => {
    const many = ['en', 'de', 'es', 'fr', 'it', 'pt-br', 'ja', 'ru', 'ar'];
    expect(cleanSubtitleLanguages(many)).toHaveLength(8);
  });
});

describe('getPlaybackPrefs / setPlaybackPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to an empty, well-typed shape when nothing is stored', () => {
    expect(getPlaybackPrefs()).toEqual({
      language: '',
      type: '',
      discordPresence: false,
      subtitleLanguages: [],
    });
  });

  it('round-trips a set preference through localStorage, sanitising as it goes', () => {
    const stored = setPlaybackPrefs({
      language: 'German',
      type: 'Dub',
      discordPresence: true,
      subtitleLanguages: ['en', 'de', 'xx'], // xx is dropped by the sanitiser
    });
    expect(stored.subtitleLanguages).toEqual(['en', 'de']);
    expect(getPlaybackPrefs()).toEqual({
      language: 'German',
      type: 'Dub',
      discordPresence: true,
      subtitleLanguages: ['en', 'de'],
    });
  });

  it('coerces malformed stored JSON back to the empty default', () => {
    localStorage.setItem('crimson:playback-prefs', '{ not json');
    expect(getPlaybackPrefs()).toEqual({
      language: '',
      type: '',
      discordPresence: false,
      subtitleLanguages: [],
    });
  });
});
