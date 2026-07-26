// Pure decision rule for the "sequential advance starts fresh" resume policy.
//
// A saved resume position is wanted when the viewer navigates INTO an episode
// directly (continue-watching banner, opening it cold from an overview): that's
// the "pick the show back up" case. It is NOT wanted when the viewer just
// finished the previous episode in this very session and rolls into the next
// one (Auto-Next, clicking the next episode over the credits): their intent is
// a fresh sequential watch, and any stored position for the target is by
// definition from an earlier watch-through — seeking to it yanks a re-watch
// into the middle of the episode.
//
// The wrappers stamp this decision at episode-change time (when the outgoing
// playback state is still known) and their resume lookups skip the saved
// position once for the stamped target.

// Same threshold the backend uses to infer status='completed' on a progress
// save (_resolve_status), so "finished enough to advance" means the same thing
// on both sides.
const FINISHED_RATIO = 0.9;

/**
 * Should the episode being navigated TO start at 0, ignoring any saved resume
 * position? True only for a sequential advance out of a just-finished episode:
 * the immediately following episode in the same season, or episode 1 of a
 * different season (season rollover / starting a season over). Gap-numbered
 * listings where "next" isn't literally +1 simply don't trigger the rule and
 * keep today's resume behaviour.
 *
 * @param playback  { position, duration } of the OUTGOING episode as last
 *                  reported this session, or null if it never played.
 */
export function startsFresh(playback, fromSeason, fromEpisode, toSeason, toEpisode) {
  const finished = !!playback
    && Number.isFinite(playback.duration) && playback.duration > 0
    && playback.position / playback.duration >= FINISHED_RATIO;
  if (!finished) return false;
  if (toSeason === fromSeason) return toEpisode === fromEpisode + 1;
  return toEpisode === 1;
}
