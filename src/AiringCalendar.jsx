import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Bell, BellRing, BellOff, Mail, MailWarning, Loader2, Clock } from 'lucide-react';
import { useAiringCalendar, useSubscriptions, useSessionToken, useTitle } from './hooks';
import { dayLabel, timeLabel, hasAired } from './airingFormat';

// The week's broadcast schedule, with the titles this viewer follows lit up.
//
// Both halves arrive in one response (GET /calendar), so the page draws the whole
// schedule and highlights your own rather than making two requests to render one
// view. Times are the browser's: an episode airing at 17:00 JST belongs to a
// different day depending on where it is being read, and grouping server-side
// would put it on the wrong one.

const AiringRow = ({ item, following, onToggle, busy }) => {
  const navigate = useNavigate();
  const aired = hasAired(item.airing_at);

  return (
    <div
      className={`group flex items-center gap-4 p-3 pr-4 rounded-2xl border backdrop-blur-md transition-[border-color,box-shadow] duration-300 ${
        following
          ? 'bg-crimson-500/10 border-crimson-500/40 shadow-[0_10px_25px_rgba(255,0,60,0.08)]'
          : 'bg-crimson-950/30 border-crimson-900/40 hover:border-crimson-700/60'
      }`}
    >
      <div className="w-14 shrink-0 text-center">
        <div className={`text-sm font-black tabular-nums ${aired ? 'text-crimson-600' : 'text-crimson-300'}`}>
          {timeLabel(item.airing_at)}
        </div>
        {aired && (
          <div className="text-[9px] font-black uppercase tracking-widest text-crimson-700">Aired</div>
        )}
      </div>

      <button
        onClick={() => navigate(`/anime/${item.anilist_id}`)}
        className="flex-grow min-w-0 text-left"
      >
        <h4 className="text-sm sm:text-base font-black text-crimson-50 truncate group-hover:text-crimson-400 transition-colors tracking-tight">
          {item.title || `AniList #${item.anilist_id}`}
        </h4>
        <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-crimson-600">
          Episode {item.episode}
        </div>
      </button>

      <button
        onClick={() => onToggle(item)}
        disabled={busy}
        aria-pressed={following}
        aria-label={following ? 'Stop following' : 'Follow this title'}
        className={`shrink-0 p-2.5 rounded-full border transition-all active:scale-90 disabled:opacity-60 ${
          following
            ? 'bg-crimson-500 border-crimson-400 text-white shadow-[0_0_12px_rgba(255,0,60,0.4)]'
            : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-600 hover:text-crimson-200 hover:border-crimson-600'
        }`}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : following ? (
          <BellRing className="w-4 h-4" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};

// Everything this viewer follows, whether or not it airs this week. Without it a
// show between seasons is invisible on this page and cannot be unfollowed, which
// is the state a long-running follow spends most of its life in.
const FollowingList = ({ subscriptions, onUnfollow, busyId }) => {
  if (!subscriptions.length) return null;
  return (
    <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl">
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-crimson-500">
          <BellRing className="w-6 h-6" />
          <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">
            Everything you follow
          </h3>
        </div>
        <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
          Including titles between seasons, which have nothing on the schedule above.
        </p>
      </div>

      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <div
            key={sub.anilist_id}
            className="flex items-center gap-4 p-4 rounded-2xl bg-crimson-950/40 border border-crimson-900/50"
          >
            <div className="flex-grow min-w-0">
              <div className="text-sm font-black text-crimson-50 truncate tracking-tight">
                {sub.title || `AniList #${sub.anilist_id}`}
              </div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-crimson-600">
                {sub.next_airing_at
                  ? `Episode ${sub.next_episode} on ${new Date(sub.next_airing_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : 'Nothing scheduled yet'}
              </div>
            </div>
            <button
              onClick={() => onUnfollow(sub.anilist_id)}
              disabled={busyId === sub.anilist_id}
              aria-label={`Stop following ${sub.title || sub.anilist_id}`}
              className="shrink-0 p-2.5 rounded-full text-crimson-600 hover:text-white hover:bg-crimson-900/50 transition-all active:scale-90 disabled:opacity-50"
            >
              {busyId === sub.anilist_id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const AiringCalendar = () => {
  const navigate = useNavigate();
  const sessionToken = useSessionToken();
  useTitle('Airing Calendar');

  const { byDay, items, loading, error } = useAiringCalendar();
  const { isFollowing, follow, unfollow, emailNotifications, subscriptions } = useSubscriptions();
  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const toggle = async (item) => {
    setBusyId(item.anilist_id);
    if (isFollowing(item.anilist_id)) await unfollow(item.anilist_id);
    else await follow({ anilist_id: item.anilist_id, title: item.title, poster: item.poster });
    setBusyId(null);
  };

  const drop = async (anilistId) => {
    setBusyId(anilistId);
    await unfollow(anilistId);
    setBusyId(null);
  };

  if (!sessionToken) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <CalendarDays className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-crimson-50 uppercase">Authentication Required</h2>
          <p className="text-crimson-300 mt-2">
            The schedule is yours to keep, so it needs a link to your account.
          </p>
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

  if (loading && items.length === 0) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">
          Reading the broadcast schedule...
        </p>
      </div>
    );
  }

  const days = onlyFollowed
    ? byDay
        .map((d) => ({ ...d, items: d.items.filter((i) => isFollowing(i.anilist_id)) }))
        .filter((d) => d.items.length)
    : byDay;

  const followedCount = subscriptions.length;

  return (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-10 animate-in fade-in duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-black text-crimson-50 uppercase tracking-tighter leading-none">
            Airing <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">Calendar</span>
          </h1>
          <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
            <CalendarDays className="w-4 h-4 text-crimson-500" />
            {followedCount
              ? `Following ${followedCount} title${followedCount === 1 ? '' : 's'}`
              : 'Ring the bell on a title to follow it'}
          </p>
        </div>

        {followedCount > 0 && (
          <button
            onClick={() => setOnlyFollowed((v) => !v)}
            className={`shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
              onlyFollowed
                ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
                : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-400 hover:border-crimson-600'
            }`}
          >
            {onlyFollowed ? 'Showing yours' : 'Only mine'}
          </button>
        )}
      </div>

      {/* Whether a follow can actually reach this account. Said once, here, rather
          than on every bell. */}
      {followedCount > 0 && (
        <div
          className={`flex items-start gap-4 p-5 rounded-3xl border ${
            emailNotifications
              ? 'bg-crimson-500/5 border-crimson-500/20'
              : 'bg-amber-500/5 border-amber-500/30'
          }`}
        >
          <div className="p-2.5 rounded-2xl bg-crimson-900/20 shrink-0">
            {emailNotifications ? (
              <Mail className="w-5 h-5 text-crimson-500" />
            ) : (
              <MailWarning className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <p className="text-xs text-crimson-300/70 leading-relaxed font-medium">
            {emailNotifications
              ? 'A new episode of a title you follow brings a note to your inbox, shortly after it airs in Japan.'
              : 'Your follows are kept and lit up here, but nothing can be mailed until this account has a verified email address.'}
          </p>
        </div>
      )}

      {error && (
        <div className="p-6 rounded-3xl border border-crimson-500/40 bg-crimson-900/20 text-crimson-200 font-medium text-sm">
          {error}
        </div>
      )}

      {days.length === 0 && !error && (
        <div className="text-center py-20 space-y-3">
          <Clock className="w-10 h-10 text-crimson-700 mx-auto" />
          <p className="text-crimson-500 font-black uppercase tracking-widest text-sm">
            {onlyFollowed ? 'Nothing you follow airs this week' : 'The schedule is empty just now'}
          </p>
          <p className="text-crimson-700 text-xs font-medium max-w-sm mx-auto leading-relaxed">
            {onlyFollowed
              ? 'Your titles are between seasons, or their next episodes are further out than a week.'
              : 'The schedule is refreshed a few times a day. If this stays empty, the calendar may not have been filled yet.'}
          </p>
        </div>
      )}

      {days.map((day) => (
        <div key={day.key} className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">
              {dayLabel(day.date)}
            </h2>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700">
              {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="space-y-2">
            {day.items.map((item) => (
              <AiringRow
                key={`${item.anilist_id}-${item.episode}`}
                item={item}
                following={isFollowing(item.anilist_id)}
                onToggle={toggle}
                busy={busyId === item.anilist_id}
              />
            ))}
          </div>
        </div>
      ))}

      <FollowingList subscriptions={subscriptions} onUnfollow={drop} busyId={busyId} />

      <p className="text-[10px] text-crimson-700 font-black uppercase tracking-[0.25em] text-center leading-relaxed">
        Times are your own · Schedule from AniList · A follow can be dropped at any time
      </p>
    </div>
  );
};

export default AiringCalendar;
