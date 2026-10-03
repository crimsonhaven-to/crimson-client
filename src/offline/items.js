// Helpers for the watch pages, which describe what they can save: one item per
// movie or episode, carrying everything the queue needs to find a fresh link
// for it later without the page (see store.js for the shape).

const today = () => new Date().toISOString().slice(0, 10);

// The episode on screen first, then every aired one after it in the season.
// The current one is kept even before the season's list has loaded.
export function episodesFrom(list, current) {
  const later = list
    .filter((ep) => ep.episode_number > current && (!ep.air_date || ep.air_date <= today()))
    .sort((a, b) => a.episode_number - b.episode_number);
  return [list.find((ep) => ep.episode_number === current) || { episode_number: current }, ...later];
}

export function episodeTitle(ep) {
  return ep.title && ep.title !== `Episode ${ep.episode_number}` ? ep.title : null;
}

export function itemLabel(item) {
  if (item.kind === 'movie') return item.titleName;
  return [`S${item.season}E${item.episode}`, item.episodeTitle].filter(Boolean).join(' · ');
}
