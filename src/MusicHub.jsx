// The Music hub: the member's imported playlists, the Spotify connection, and
// the ways to add more. Deny by default like Lumi, so a member without the
// grant sees why instead of an empty page.
import { Link } from 'react-router-dom';
import { CircleAlert, Music, Play } from 'lucide-react';

import { HubShell } from './hubKit';
import { useMusicPlaylists, useMusicStatus } from './hooks';
import { Cover } from './music/Cover';
import ImportPanel from './music/ImportPanel';
import SpotifyCard from './music/SpotifyCard';

function Blocked({ error }) {
  const message = error.status === 403
    ? 'Music has not been switched on for your account yet. Ask the operator to grant it.'
    : error.status === 503
      ? 'Music is not set up on this server.'
      : error.message;
  return (
    <div className="max-w-xl mx-auto py-32 px-6 text-center space-y-4">
      <Music className="w-10 h-10 text-crimson-700 mx-auto" />
      <p className="text-crimson-300 font-bold">{message}</p>
    </div>
  );
}

function Notice({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs font-bold text-amber-200/90">
      <CircleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{children}</span>
    </div>
  );
}

function PlaylistTile({ playlist }) {
  const total = playlist.track_count + playlist.removed_count;
  const pending = total - playlist.ready_count - playlist.review_count - playlist.problem_count;
  return (
    <Link to={`/music/playlist/${playlist.id}`} className="group space-y-3">
      <div className="relative">
        <Cover src={playlist.cover_url} className="w-full aspect-square rounded-2xl shadow-xl group-hover:scale-[1.02] transition-transform" />
        <span className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-crimson-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          <Play className="w-5 h-5 translate-x-px" fill="currentColor" />
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-crimson-50 truncate group-hover:text-crimson-300">{playlist.name}</p>
        <p className="text-[11px] text-crimson-600 truncate">
          {playlist.ready_count} / {total} ready
          {pending > 0 && ` · ${pending} queued`}
          {playlist.review_count > 0 && <span className="text-amber-400"> · {playlist.review_count} to pick</span>}
        </p>
      </div>
    </Link>
  );
}

export default function MusicHub() {
  const status = useMusicStatus();
  const { playlists, reload } = useMusicPlaylists();

  if (status.loading) {
    return <div className="py-32 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Tuning the strings...</div>;
  }
  if (status.error) return <Blocked error={status.error} />;

  const s = status.data;
  const counts = s.counts || {};
  const refresh = () => { status.reload(); reload(); };
  const subtitle = [
    `${counts.ready || 0} songs on the share`,
    (counts.pending || 0) + (counts.working || 0) > 0 && `${(counts.pending || 0) + (counts.working || 0)} queued`,
    counts.review > 0 && `${counts.review} waiting for you`,
  ].filter(Boolean).join(' · ');

  return (
    <HubShell title="Your" accent="Music" icon={<Music className="w-4 h-4" />} subtitle={subtitle}>
      <div className="space-y-4">
        {!s.provider && <Notice>This server can import playlists but has no download source, so nothing downloads yet.</Notice>}
        {s.provider && !s.share_ready && <Notice>The music share is not reachable right now. Downloads resume once it is back.</Notice>}
      </div>

      {playlists.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {playlists.map((p) => <PlaylistTile key={p.id} playlist={p} />)}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <SpotifyCard status={s} onChanged={refresh} />
        <ImportPanel connected={s.spotify.connected} />
      </div>
    </HubShell>
  );
}
