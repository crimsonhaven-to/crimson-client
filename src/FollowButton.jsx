import { useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { useSubscriptions, useSessionToken } from './hooks';

// Per-title "tell me when the next episode airs" toggle, sitting beside the
// watchlist control on an anime overview.
//
// Only anime: the schedule comes from AniList, so a title with no anilist_id has
// nothing to be notified about and the control simply does not render. Following
// is not the same as a watchlist, which is why it is its own button rather than
// another row in that popover: one is "I mean to watch this", the other is
// "wake me when it lands".
const FollowButton = ({ item, variant = 'overview' }) => {
  const sessionToken = useSessionToken();
  const { isFollowing, follow, unfollow, emailNotifications, loading } = useSubscriptions();
  const [busy, setBusy] = useState(false);

  if (!item || item.anilist_id == null || !sessionToken) return null;

  const following = isFollowing(item.anilist_id);

  const toggle = async () => {
    setBusy(true);
    if (following) await unfollow(item.anilist_id);
    else await follow(item);
    setBusy(false);
  };

  // Following still works without a verified address: the calendar highlights it
  // either way. The label says so rather than promising an email that cannot be
  // sent.
  const hint = following
    ? emailNotifications
      ? 'We will write when a new episode airs'
      : 'Verify your email to be notified'
    : 'Get told when a new episode airs';

  const isOverview = variant === 'overview';
  const Icon = busy || loading ? Loader2 : following ? BellRing : Bell;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={hint}
      aria-pressed={following}
      className={`group inline-flex items-center gap-3 font-black uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-60 ${
        isOverview ? 'text-xs px-6 py-4 rounded-2xl' : 'text-[10px] px-4 py-2.5 rounded-xl'
      } ${
        following
          ? 'bg-crimson-500/15 border border-crimson-500/50 text-crimson-200 hover:border-crimson-400'
          : 'bg-crimson-950/50 border border-crimson-900/60 text-crimson-400 hover:border-crimson-600 hover:text-crimson-200'
      }`}
    >
      <Icon className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
      <span>{following ? 'Following' : 'Follow'}</span>
    </button>
  );
};

export default FollowButton;
