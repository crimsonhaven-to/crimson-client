// Admin › Music tab. The whole library on the share: every song, whose
// playlists hold it, how much room it takes, and whether the CDN has a copy.
// A song is stored once however many members hold it, so this is the one
// place that shows the library as the disk sees it. Grants live on Users.
import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, Clock, Cloud, CloudOff, Disc3, HardDrive, Music, Pause, Play, RefreshCw, Search,
} from 'lucide-react';

import { adminApi } from '../adminApi';
import { Cover } from '../music/Cover';
import { currentTrack, playTracks, toggle, useMusicPlayer } from '../music/player';
import { formatTime } from '../music/queue';
import { formatBytes } from './format';
import { StatCard } from './ui';

const PAGE = 50;

const STATUSES = [
  { id: '', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'pending', label: 'Queued' },
  { id: 'review', label: 'To pick' },
  { id: 'unmatched', label: 'Unmatched' },
  { id: 'failed', label: 'Failed' },
];

const STATUS_STYLES = {
  ready: 'bg-green-500/10 border-green-500/30 text-green-400',
  pending: 'bg-crimson-500/10 border-crimson-500/30 text-crimson-400',
  working: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  review: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  unmatched: 'bg-red-500/10 border-red-500/30 text-red-400',
  failed: 'bg-red-500/10 border-red-500/30 text-red-400',
};

const hours = (ms) => {
  const h = (ms || 0) / 3_600_000;
  return h >= 10 ? `${Math.round(h)} h` : `${h.toFixed(1)} h`;
};

const PREVIEW_SOURCE = { name: 'Admin › Music', path: '/admin' };

export default function MusicTab({ notify }) {
  const [data, setData] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const player = useMusicPlayer();
  const playing = currentTrack(player);

  // The spinners are switched on by whoever asks for the page (a filter, the
  // refresh button, "show more"), so the first load needs no state set here.
  const load = useCallback((offset = 0) => adminApi
    .musicLibrary({ q: search, status, limit: PAGE, offset })
    .then(
      (page) => {
        setData(page);
        setTracks((prev) => (offset ? [...prev, ...page.tracks] : page.tracks));
      },
      () => notify('Failed to load the music library', false),
    )
    .finally(() => {
      setLoading(false);
      setMore(false);
    }), [search, status, notify]);

  useEffect(() => { load(0); }, [load]);

  // Searching on every keystroke would query the whole table per letter.
  useEffect(() => {
    const next = query.trim();
    if (next === search) return undefined;
    const timer = setTimeout(() => { setLoading(true); setSearch(next); }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const chooseStatus = (next) => {
    if (next === status) return;
    setLoading(true);
    setStatus(next);
  };
  const refresh = () => { setLoading(true); load(0); };
  const showMore = () => { setMore(true); load(tracks.length); };

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Songs ready" value={s ? s.ready : null} sub={s ? `${s.total} known in all` : null} icon={Music} accent="text-crimson-400" />
        <StatCard label="On the share" value={s ? formatBytes(s.bytes) : null} sub={s ? `${hours(s.duration_ms)} of music` : null} icon={HardDrive} />
        <StatCard
          label="CDN copy"
          value={s ? (s.cdn ? `${s.mirrored}` : 'Off') : null}
          sub={s ? (s.cdn ? `of ${s.ready} ready songs` : 'MUSIC_CDN_URL not set') : null}
          icon={s?.cdn ? Cloud : CloudOff}
          accent={s?.cdn ? 'text-green-400' : undefined}
        />
        <StatCard
          label="Waiting"
          value={s ? s.queued : null}
          sub={s ? `${s.problems} need a person` : null}
          icon={s?.problems ? AlertCircle : Clock}
          accent={s?.problems ? 'text-amber-400' : undefined}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-grow min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-crimson-700" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, artist or album"
            className="w-full pl-11 pr-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-700 text-sm focus:outline-none focus:border-crimson-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((option) => (
            <button
              key={option.id}
              onClick={() => chooseStatus(option.id)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                status === option.id
                  ? 'bg-crimson-600 border-crimson-600 text-white'
                  : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button onClick={refresh} aria-label="Refresh" title="Refresh"
            className="p-2 rounded-xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !tracks.length ? (
        <div className="py-16 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Counting the records…</div>
      ) : tracks.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Disc3 className="w-8 h-8 text-crimson-800 mx-auto" />
          <p className="text-crimson-600 text-sm">{search || status ? 'No song matches.' : 'The library is empty.'}</p>
        </div>
      ) : (
        <div className="bg-crimson-950/30 border border-crimson-900/40 rounded-3xl overflow-hidden">
          <p className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-crimson-600 border-b border-crimson-900/40">
            {data.total} song{data.total === 1 ? '' : 's'}{search || status ? ' match' : ''}
          </p>
          <ul className="divide-y divide-crimson-900/30">
            {tracks.map((track) => {
              const isCurrent = playing?.id === track.id;
              return (
                <li key={track.id} className={`flex items-center gap-3 px-3 sm:px-5 py-2.5 ${isCurrent ? 'bg-crimson-600/10' : ''}`}>
                  <button
                    disabled={!track.stream_url}
                    onClick={() => (isCurrent ? toggle() : playTracks([track], 0, PREVIEW_SOURCE))}
                    aria-label={isCurrent && player.playing ? `Pause ${track.title}` : `Play ${track.title}`}
                    className="relative w-11 h-11 flex-shrink-0 group disabled:cursor-default"
                  >
                    <Cover src={track.cover_url} className="w-11 h-11 rounded-md" />
                    {track.stream_url && (
                      <span className={`absolute inset-0 rounded-md bg-black/50 flex items-center justify-center text-white transition-opacity ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isCurrent && player.playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                      </span>
                    )}
                  </button>
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-bold text-crimson-100 truncate">{track.title}</p>
                    <p className="text-xs text-crimson-500 truncate">
                      {track.artists.join(', ')}{track.album ? ` · ${track.album}` : ''}
                    </p>
                    <p className="text-[11px] text-crimson-700 truncate" title={track.error || track.rel_path || ''}>
                      {track.owners.length
                        ? `${track.owners.join(', ')} · ${track.playlist_count} playlist${track.playlist_count === 1 ? '' : 's'}`
                        : 'In no playlist'}
                      {track.error ? ` · ${track.error}` : ''}
                    </p>
                  </div>
                  <span className="hidden md:block w-16 text-right text-[11px] text-crimson-600 tabular-nums">{track.file_size ? formatBytes(track.file_size) : ''}</span>
                  <span className="hidden sm:block w-12 text-right text-[11px] text-crimson-600 tabular-nums">{formatTime(track.duration_ms / 1000)}</span>
                  <span title={track.mirrored ? 'Copied to the CDN' : 'Not on the CDN'} className="hidden sm:block w-5">
                    {track.mirrored ? <Cloud className="w-4 h-4 text-green-500/80" /> : <CloudOff className="w-4 h-4 text-crimson-900" />}
                  </span>
                  <span className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest flex-shrink-0 ${STATUS_STYLES[track.status] || STATUS_STYLES.pending}`}>
                    {track.status}
                  </span>
                </li>
              );
            })}
          </ul>
          {tracks.length < data.total && (
            <div className="p-4 border-t border-crimson-900/40 text-center">
              <button onClick={showMore} disabled={more}
                className="px-5 py-2.5 rounded-xl bg-crimson-950/60 border border-crimson-900/60 hover:border-crimson-600 text-crimson-200 text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
                {more ? 'Loading…' : `Show more (${data.total - tracks.length} left)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
