import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

// The picker also lives inside the player so episodes can be switched in fullscreen.
// Other seasons' episode lists are fetched lazily on first expand. Null when there is
// nothing to pick (movies, or no season or episode data yet).
export function useEpisodePicker({
  isMovie, currentSeason, currentEpisode, episodesList, availableSeasons,
  onEpisodeChange, onSelectEpisode,
}) {
  const [pickerSeason, setPickerSeason] = useState(currentSeason);
  const [episodesBySeason, setEpisodesBySeason] = useState({});
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => { setPickerSeason(currentSeason); }, [currentSeason]);

  useEffect(() => {
    if (episodesList.length) setEpisodesBySeason((m) => ({ ...m, [currentSeason]: episodesList }));
  }, [currentSeason, episodesList]);

  useEffect(() => {
    if (isMovie || pickerSeason == null || episodesBySeason[pickerSeason]) return undefined;
    const season = availableSeasons.find((s) => s.season_number === pickerSeason);
    if (!season?.tmdb_id) return undefined;
    let cancelled = false;
    setPickerLoading(true);
    apiFetch(`/info/${season.tmdb_id}?season=${season.tmdb_season}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = Array.isArray(data.episodes_list) ? data.episodes_list : [];
        setEpisodesBySeason((m) => ({ ...m, [pickerSeason]: list }));
      })
      .catch(() => { /* the panel shows an empty state on failure */ })
      .finally(() => { if (!cancelled) setPickerLoading(false); });
    return () => { cancelled = true; };
  }, [isMovie, pickerSeason, availableSeasons, episodesBySeason]);

  // Without onSelectEpisode, fall back to an in-season change so a click never dead-ends.
  const handlePickEpisode = useCallback((seasonNumber, episodeNumber) => {
    if (seasonNumber === currentSeason) onEpisodeChange?.(episodeNumber);
    else if (onSelectEpisode) onSelectEpisode(seasonNumber, episodeNumber);
    else onEpisodeChange?.(episodeNumber);
  }, [currentSeason, onEpisodeChange, onSelectEpisode]);

  return !isMovie && (availableSeasons.length > 0 || episodesList.length > 0)
    ? {
        seasons: availableSeasons,
        currentSeason,
        currentEpisode,
        expandedSeason: pickerSeason,
        onExpandSeason: setPickerSeason,
        episodes: episodesBySeason[pickerSeason] || [],
        episodesLoading: pickerLoading && !episodesBySeason[pickerSeason],
        onSelectEpisode: handlePickEpisode,
      }
    : null;
}
