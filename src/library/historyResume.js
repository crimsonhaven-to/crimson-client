import { isFutureDate } from './historyDates';

// A finished episode resumes into the next one only when it exists (no phantom "E13"
// after a 12-episode finale) and has aired. Older payloads lack next_episode_exists,
// so fall back to season_episode_count, then to always advancing.
export const resumeInfo = (item) => {
  const finished = item.status === 'completed';
  const percent = item.duration_seconds
    ? Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100))
    : 0;
  // The resume route (/read/:anilistId, no chapter id) maps the saved ordinal to a
  // chapter id itself, since history rows don't carry the MangaDex chapter id.
  if (item.media_type === 'manga') {
    return {
      finished, ep: item.episode_number || 1, href: `/read/${item.anilist_id}`, percent,
      mode: finished ? 'rewatch' : 'resume',
      actionLabel: finished ? 'Read Again' : 'Continue Reading',
      nextAirDate: null,
    };
  }
  // Episodes dedup on local_id server-side (one card per title), so no next-episode logic.
  if (item.media_type === 'local') {
    return {
      finished, ep: item.episode_number || 1, href: `/local/${item.local_id}`, percent,
      mode: finished ? 'rewatch' : 'resume',
      actionLabel: finished ? 'Watch Again' : 'Resume Journey',
      nextAirDate: null,
    };
  }
  if (item.media_type === 'movie') {
    return {
      finished, ep: 1, href: `/watch-movie/${item.tmdb_id}`, percent,
      mode: finished ? 'rewatch' : 'resume',
      actionLabel: finished ? 'Watch Again' : 'Resume Journey',
      nextAirDate: null,
    };
  }
  const cur = item.episode_number;

  const count = item.season_episode_count;
  const nextExists = item.next_episode_exists != null
    ? item.next_episode_exists
    : (count != null ? cur + 1 <= count : true);
  const nextAired = !isFutureDate(item.next_episode_air_date);
  const advance = finished && nextExists && nextAired;
  const ep = advance ? cur + 1 : cur;

  const href = item.anilist_id
    ? `/watch/${item.anilist_id}/${item.season_number}/${ep}`
    : `/watch-show/${item.tmdb_id}/${item.season_number}/${ep}`;

  // 'upcoming': finished everything aired, the next episode hasn't dropped yet.
  // 'rewatch': finished the finale, no further episodes.
  let mode = 'resume';
  if (finished) mode = advance ? 'next' : (nextExists ? 'upcoming' : 'rewatch');
  const actionLabel = {
    resume: 'Resume Journey',
    next: `Next Episode (E${ep})`,
    upcoming: 'All Caught Up',
    rewatch: 'Watch Again',
  }[mode];

  return { finished, ep, href, percent, mode, actionLabel, nextAirDate: item.next_episode_air_date };
};
