// Pins how a show's extras (specials, OVAs, ONAs and films) are laid out on an
// overview page, using the real Overlord set as the fixture: three films that
// arrive interleaved with six shorts, which is exactly the case the flat list
// could not render legibly.
import { describe, it, expect } from 'vitest';
import { groupExtras } from './overviewExtras';

// Shaped like a /overview `extras` row (web/queries.get_show_extras).
const row = (anilist_id, anime_type, title_english, start_year, tmdb_movie_id = null) =>
  ({ anilist_id, anime_type, title_english, title_romaji: title_english, start_year, tmdb_movie_id });

const OVERLORD_EXTRAS = [
  row(98873, 'MOVIE', 'Overlord: The Undead King', 2017),
  row(21305, 'SPECIAL', 'Overlord: Ple Ple Pleiades', 2015),
  row(133845, 'MOVIE', 'OVERLORD: The Sacred Kingdom', 2024, 1014505),
  row(87489, 'OVA', 'Overlord: Ple Ple Pleiades - Nazarick Saidai no Kiki', 2016),
  row(98874, 'MOVIE', 'Overlord: The Dark Hero', 2017),
  row(101083, 'ONA', 'Overlord: Ple Ple Pleiades 2', 2018),
];

describe('groupExtras', () => {
  it('splits films from shorts and orders each by release year', () => {
    const groups = groupExtras(OVERLORD_EXTRAS);

    expect(groups.map((g) => g.key)).toEqual(['films', 'shorts']);
    expect(groups[0].items.map((x) => x.anilist_id)).toEqual([98873, 98874, 133845]);
    expect(groups[1].items.map((x) => x.anilist_id)).toEqual([21305, 87489, 101083]);
  });

  it('counts a TMDB-tracked film as a film even when its type says otherwise', () => {
    // tmdb_movie_id is what routes an entry through the movie watch path, so it
    // decides the grouping too — the two must never disagree on screen.
    const [films] = groupExtras([row(1, 'SPECIAL', 'Mislabelled Feature', 2020, 555)]);
    expect(films.key).toBe('films');
  });

  it('drops a kind entirely rather than showing an empty heading', () => {
    const groups = groupExtras([row(21305, 'SPECIAL', 'Ple Ple Pleiades', 2015)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('shorts');
  });

  it('sorts entries with no known year last instead of first', () => {
    const groups = groupExtras([
      row(2, 'OVA', 'Undated', null),
      row(1, 'OVA', 'Dated', 2001),
    ]);
    expect(groups[0].items.map((x) => x.anilist_id)).toEqual([1, 2]);
  });

  it('returns nothing for a show with no extras', () => {
    expect(groupExtras([])).toEqual([]);
  });
});
