import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Clock, Flame, CalendarHeart, Film, BookOpen, Tv, Info, Trophy,
} from 'lucide-react';
import { useWrapped, useSessionToken, useTitle } from './hooks';

// A year of watching, as the backend counted it.
//
// The one thing this page must not do is present a reconstruction as a
// measurement. The payload carries `approximate` whenever part of the year
// predates the history table, and that is surfaced prominently rather than
// tucked into a tooltip: the first Wrapped covers a year that mostly happened
// before anything was recorded day by day.

const THIS_YEAR = new Date().getFullYear();
// Matches the backend's floor; older years have no exact source left.
const EARLIEST_YEAR = 2023;

const YEARS = Array.from(
  { length: THIS_YEAR - EARLIEST_YEAR + 1 },
  (_, i) => THIS_YEAR - i
);

const prettyDay = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : null;

const StatCard = ({ icon: Icon, value, label, detail }) => (
  <div className="relative overflow-hidden bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-7 rounded-[2rem] shadow-2xl">
    <div className="absolute -top-16 -right-16 w-40 h-40 bg-crimson-500/5 blur-[70px] rounded-full"></div>
    <div className="relative z-10 space-y-2">
      <Icon className="w-6 h-6 text-crimson-500" />
      <div className="text-4xl font-black text-crimson-50 tracking-tighter tabular-nums">{value}</div>
      <div className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em]">{label}</div>
      {detail && (
        <p className="text-xs text-crimson-300/60 font-medium leading-relaxed pt-1">{detail}</p>
      )}
    </div>
  </div>
);

const CrimsonWrapped = () => {
  const navigate = useNavigate();
  const sessionToken = useSessionToken();
  const [year, setYear] = useState(THIS_YEAR);
  const { data, loading, error } = useWrapped(year);
  useTitle('Crimson Wrapped');

  if (!sessionToken) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <Sparkles className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-crimson-50 uppercase">Authentication Required</h2>
          <p className="text-crimson-300 mt-2">Your year is counted from your own account.</p>
          <button
            onClick={() => navigate('/account')}
            className="mt-6 px-6 py-2 bg-crimson-500 hover:bg-crimson-400 text-white font-bold rounded-xl transition-all"
          >
            Establish Link
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">
          Gathering your year...
        </p>
      </div>
    );
  }

  const nothingWatched =
    data && !data.episodes && !data.movies && !data.manga_titles;

  return (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-10 animate-in fade-in duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-black text-crimson-50 uppercase tracking-tighter leading-none">
            Crimson <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">Wrapped</span>
          </h1>
          <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
            <Sparkles className="w-4 h-4 text-crimson-500" />
            Everything you watched in {year}
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-crimson-950/40 border border-crimson-900/60 shrink-0">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 tabular-nums ${
                y === year
                  ? 'bg-crimson-600 text-white shadow-[0_4px_12px_rgba(255,0,60,0.25)]'
                  : 'text-crimson-500 hover:text-white'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-6 rounded-3xl border border-crimson-500/40 bg-crimson-900/20 text-crimson-200 font-medium text-sm">
          {error}
        </div>
      )}

      {/* Not a footnote. A number reconstructed from when a row was last touched
          is not the same kind of fact as one counted on the day. */}
      {data?.approximate && (
        <div className="flex items-start gap-4 p-6 rounded-3xl border border-amber-500/30 bg-amber-500/5">
          <div className="p-2.5 rounded-2xl bg-amber-900/20 shrink-0">
            <Info className="w-5 h-5 text-amber-500" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">
              Part of this year is an estimate
            </p>
            <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">
              {data.events_since
                ? `Day-by-day history has only been kept since ${prettyDay(data.events_since.slice(0, 10))}. Anything before that is reconstructed from when a title was last touched, so dates and streaks from that span are approximate.`
                : 'Day-by-day history was not being kept during this year, so all of this is reconstructed from when each title was last touched. The totals are close; the dates are not exact.'}
            </p>
          </div>
        </div>
      )}

      {nothingWatched && !error && (
        <div className="text-center py-20 space-y-3">
          <Sparkles className="w-10 h-10 text-crimson-700 mx-auto" />
          <p className="text-crimson-500 font-black uppercase tracking-widest text-sm">
            Nothing recorded for {year}
          </p>
          <p className="text-crimson-700 text-xs font-medium max-w-sm mx-auto leading-relaxed">
            Watch something and come back. The year fills itself in as you go.
          </p>
        </div>
      )}

      {data && !nothingWatched && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={Tv}
              value={data.episodes}
              label="Episodes watched"
              detail={
                data.distinct_titles?.anime || data.distinct_titles?.show
                  ? `Across ${(data.distinct_titles.anime || 0) + (data.distinct_titles.show || 0) + (data.distinct_titles.local || 0)} titles`
                  : null
              }
            />
            <StatCard
              icon={Clock}
              value={`${data.hours}h`}
              label="Hours watched"
              detail="Counted once per episode, at the furthest point you reached"
            />
            <StatCard
              icon={CalendarHeart}
              value={data.active_days}
              label="Days you watched something"
            />
            <StatCard
              icon={Flame}
              value={data.longest_streak?.days || 0}
              label="Longest streak"
              detail={
                data.longest_streak?.from
                  ? `${prettyDay(data.longest_streak.from)} to ${prettyDay(data.longest_streak.to)}`
                  : null
              }
            />
            <StatCard
              icon={Film}
              value={data.movies}
              label="Films"
            />
            <StatCard
              icon={BookOpen}
              value={data.manga_titles}
              label="Manga followed"
              detail="Counted per title, not per chapter"
            />
          </div>

          {data.busiest_day?.day && (
            <div className="relative overflow-hidden bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl">
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>
              <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-3 text-crimson-500">
                  <Trophy className="w-6 h-6" />
                  <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">
                    Your busiest day
                  </h3>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-crimson-50 tracking-tighter">
                  {prettyDay(data.busiest_day.day)}
                </p>
                <p className="text-xs text-crimson-300/60 font-medium">
                  {data.busiest_day.items} thing{data.busiest_day.items === 1 ? '' : 's'} watched, in your own timezone
                </p>
              </div>
            </div>
          )}

          {data.top_titles?.length > 0 && (
            <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl">
              <div className="flex items-center gap-3 text-crimson-500">
                <Trophy className="w-6 h-6" />
                <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">
                  Where your hours went
                </h3>
              </div>
              <div className="space-y-2">
                {data.top_titles.map((t, i) => {
                  const widest = data.top_titles[0].minutes || 1;
                  return (
                    <div key={t.title} className="flex items-center gap-4">
                      <span className="w-6 text-right text-sm font-black text-crimson-700 tabular-nums">
                        {i + 1}
                      </span>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-sm font-black text-crimson-50 truncate tracking-tight">
                            {t.title}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-crimson-500 shrink-0 tabular-nums">
                            {t.minutes >= 60 ? `${Math.round(t.minutes / 60)}h` : `${t.minutes}m`}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-crimson-950/60 overflow-hidden">
                          <div
                            className="h-full bg-crimson-500 rounded-full"
                            style={{ width: `${Math.max(4, (t.minutes / widest) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.top_genres?.length > 0 && (
            <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-crimson-500">
                  <Sparkles className="w-6 h-6" />
                  <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">
                    What you were drawn to
                  </h3>
                </div>
                <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
                  One vote per title, not per episode, so a long-running series does not
                  drown out everything else.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {data.top_genres.map((g) => (
                  <span
                    key={g.genre}
                    className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border bg-crimson-950/40 border-crimson-900/60 text-crimson-300"
                  >
                    {g.genre}
                    <span className="ml-2 text-crimson-600 tabular-nums">{g.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(data.first_title || data.last_title) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.first_title && (
                <div className="bg-crimson-950/30 border border-crimson-900/40 p-7 rounded-[2rem] space-y-1">
                  <div className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em]">
                    You opened the year with
                  </div>
                  <div className="text-xl font-black text-crimson-50 tracking-tighter">
                    {data.first_title}
                  </div>
                </div>
              )}
              {data.last_title && (
                <div className="bg-crimson-950/30 border border-crimson-900/40 p-7 rounded-[2rem] space-y-1">
                  <div className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em]">
                    And left it on
                  </div>
                  <div className="text-xl font-black text-crimson-50 tracking-tighter">
                    {data.last_title}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-crimson-700 font-black uppercase tracking-[0.25em] text-center leading-relaxed">
        Counted in your own timezone · Yours alone · Never shared
      </p>
    </div>
  );
};

export default CrimsonWrapped;
