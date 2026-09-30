// There is deliberately no src/hooks/index.js, so './hooks' resolves to this barrel.
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
export * from './hooks/resumeRules';
export * from './hooks/useAnimeStreamer';
export * from './hooks/anime';
export * from './hooks/ndjson';
export * from './hooks/shows';
export * from './hooks/movies';
export * from './hooks/manga';
export * from './hooks/local';
export * from './hooks/liveTv';
export * from './hooks/browse';
export * from './hooks/misc';
export * from './hooks/lumi';
export * from './hooks/airing';
export * from './hooks/security';
export * from './hooks/wrapped';
export * from './hooks/music';
