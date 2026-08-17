// How an overview page lays out a show's extras — its specials, OVAs, ONAs and
// films. Pure helpers, kept out of OverviewView.jsx so they can be unit-tested
// (and so that file keeps exporting only its component).
//
// The backend hands these over as one list sorted by type then year
// (web/queries.get_show_extras). For a franchise like Overlord that is three
// films interleaved with six shorts, which reads as a jumble; a viewer wants the
// films together, in the order they came out.

/** An extra's own name, falling back to its id so a row is never blank while the
 *  mapping still has no AniList titles for it. */
export const extraTitle = (x) => x.title_english || x.title_romaji || `Entry ${x.anilist_id}`;

/** A film is anything AniList calls a MOVIE, plus anything carrying a TMDB movie
 *  id — that id is what routes an entry through the movie watch path, so the two
 *  must never disagree. Everything else is a short. */
export const isFilmExtra = (x) => x.anime_type === 'MOVIE' || x.tmdb_movie_id != null;

/**
 * Split the extras into the two kinds a viewer actually distinguishes, each in
 * release order, dropping a kind entirely when it is empty (so a show with only
 * specials never grows a stray "Movies" heading). Entries with no known year
 * sort last rather than jumping to the front on a null.
 *
 * @returns {{key: string, label: string, items: object[]}[]}
 */
export const groupExtras = (extras) => {
  const byYear = (a, b) => (a.start_year || 9999) - (b.start_year || 9999);
  return [
    { key: 'films', label: 'Movies', items: extras.filter(isFilmExtra).sort(byYear) },
    { key: 'shorts', label: 'Specials & OVAs', items: extras.filter((x) => !isFilmExtra(x)).sort(byYear) },
  ].filter((group) => group.items.length > 0);
};
