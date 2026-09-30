// Rolling from a just-finished episode into the next one is a fresh sequential
// watch: any saved position for the target is from an earlier watch-through, and
// seeking to it would drop a re-watch into the middle of the episode. Opening an
// episode directly still resumes. Callers stamp the decision at episode change,
// while the outgoing playback state is still known.

// Same threshold the backend uses to infer status='completed' on a progress
// save (_resolve_status), so "finished enough to advance" means the same thing
// on both sides.
const FINISHED_RATIO = 0.9;

// `playback` is the outgoing episode's { position, duration }, or null if it never
// played. Gap-numbered listings where "next" is not literally +1 keep resuming.
export function startsFresh(playback, fromSeason, fromEpisode, toSeason, toEpisode) {
  const finished = !!playback
    && Number.isFinite(playback.duration) && playback.duration > 0
    && playback.position / playback.duration >= FINISHED_RATIO;
  if (!finished) return false;
  if (toSeason === fromSeason) return toEpisode === fromEpisode + 1;
  return toEpisode === 1;
}
