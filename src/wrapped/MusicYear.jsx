// Every number here was counted as it happened, so unlike the watching half none of
// it is ever an estimate.
import { CalendarHeart, Headphones, Mic2, Music, Play } from 'lucide-react';

import { Cover } from '../music/Cover';
import { playTracks } from '../music/player';
import StatCard from './StatCard';

const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default function MusicYear({ data, year }) {
  const tracks = data.top_tracks.map((t) => t.track);
  const source = { name: `Your top songs of ${year}`, path: '/wrapped' };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 text-crimson-500 pt-4">
        <Headphones className="w-6 h-6" />
        <h2 className="text-2xl sm:text-3xl font-black text-crimson-50 uppercase tracking-tighter">
          What you listened to
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Headphones} value={data.minutes.toLocaleString()} label="Minutes listened" />
        <StatCard
          icon={Music}
          value={data.plays.toLocaleString()}
          label="Songs played"
          detail={plural(data.songs, 'different song', 'different songs')}
        />
        <StatCard icon={Mic2} value={data.artists.toLocaleString()} label="Artists" />
        <StatCard icon={CalendarHeart} value={data.active_days} label="Days with music" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.top_tracks.length > 0 && (
          <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-7 sm:p-8 rounded-[2.5rem] space-y-5 shadow-2xl">
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Your top songs</h3>
            <ol className="space-y-2">
              {data.top_tracks.map(({ track, plays }, i) => (
                <li key={track.id}>
                  <button
                    onClick={() => playTracks(tracks, i, source, { shuffle: false })}
                    disabled={!track.stream_url}
                    className="group w-full flex items-center gap-4 p-2 -m-2 rounded-2xl text-left hover:bg-crimson-900/20 disabled:hover:bg-transparent transition-colors"
                  >
                    <span className="w-5 text-right text-sm font-black text-crimson-700 tabular-nums shrink-0">{i + 1}</span>
                    <div className="relative w-11 h-11 shrink-0">
                      <Cover src={track.cover_url} className="w-11 h-11 rounded-lg" />
                      {track.stream_url && (
                        <span className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="text-sm font-black text-crimson-50 truncate tracking-tight">{track.title}</div>
                      <div className="text-xs text-crimson-400/70 truncate">{(track.artists || []).join(', ')}</div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-crimson-500 shrink-0 tabular-nums">
                      {plural(plays, 'play', 'plays')}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {data.top_artists.length > 0 && (
          <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-7 sm:p-8 rounded-[2.5rem] space-y-5 shadow-2xl">
            <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Your top artists</h3>
            <ol className="space-y-3">
              {data.top_artists.map((artist, i) => {
                const widest = data.top_artists[0].minutes || 1;
                return (
                  <li key={artist.name} className="flex items-center gap-4">
                    <span className="w-5 text-right text-sm font-black text-crimson-700 tabular-nums shrink-0">{i + 1}</span>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-sm font-black text-crimson-50 truncate tracking-tight">{artist.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-crimson-500 shrink-0 tabular-nums">
                          {artist.minutes.toLocaleString()} min
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-crimson-950/60 overflow-hidden">
                        <div
                          className="h-full bg-crimson-500 rounded-full"
                          style={{ width: `${Math.max(4, (artist.minutes / widest) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
