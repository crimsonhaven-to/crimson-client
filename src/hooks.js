// Barrel for the app's hooks + data layer.
//
// This file used to be one ~2,400-line module holding config, the API client,
// auth, watchlists, the account layer and the anime/show/movie streamers all at
// once. It has been split by concern into the `src/hooks/` directory; this barrel
// re-exports every public symbol so the ~30 existing `import { … } from './hooks'`
// call sites keep working byte-for-byte. (There is deliberately no
// `src/hooks/index.js`, so `./hooks` resolves unambiguously to THIS file.)
//
// Pure stream ranking/grouping lives in streamUtils.js; the grouping/label helpers
// are re-exported here for the importers (WatchView, CrimsonPlayer) that pull them
// from './hooks'. `streamRank` stays internal to the streamer hooks (as before).
export { groupStreams, streamVariantLabel, streamProviderLabel } from './streamUtils';

export * from './hooks/config';
export * from './hooks/apiClient';
export * from './hooks/playbackPrefs';
export * from './hooks/media';
export * from './hooks/liteBackground';
export * from './hooks/theme';
export * from './hooks/useAuth';
export * from './hooks/watchlists';
export * from './hooks/useAccount';
export * from './hooks/useAnimeStreamer';
export * from './hooks/anime';
export * from './hooks/ndjson';
export * from './hooks/shows';
export * from './hooks/movies';
export * from './hooks/manga';
export * from './hooks/local';
export * from './hooks/browse';
export * from './hooks/misc';
