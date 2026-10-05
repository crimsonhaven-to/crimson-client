// What only the desktop app needs from the stores: whether closing the window
// would stop something (it then goes to the tray instead), the tray's music
// buttons, and a notification when a download finishes.
import { getState as getMusicDownloads, subscribe as subscribeMusicDownloads } from '../music/downloads';
import { getState as getPlayer, next, previous, subscribe as subscribePlayer, toggle } from '../music/player';
import { itemLabel } from '../offline/items';
import { getState as getVideoDownloads, subscribe as subscribeVideoDownloads } from '../offline/store';

const TRAY_ACTIONS = { toggle, next, previous };
const RUNNING = new Set(['queued', 'downloading']);

export function activityOf(player, videos, music) {
  return {
    playing: Boolean(player.playing),
    downloading: Boolean(music.progress) || Object.values(videos.entries).some((e) => RUNNING.has(e.status)),
  };
}

// Entries that were saving before and are kept now.
export function newlySaved(before, after) {
  return Object.values(after).filter((e) => e.status === 'done' && before[e.id] && before[e.id].status !== 'done');
}

export function startDesktopBridge() {
  const desktop = window.CrimsonNative?.desktop;
  if (!desktop) return;

  let reported = '';
  const report = () => {
    const activity = activityOf(getPlayer(), getVideoDownloads(), getMusicDownloads());
    const key = JSON.stringify(activity);
    if (key === reported) return;
    reported = key;
    desktop.report(activity).catch(() => {});
  };

  let videos = getVideoDownloads().entries;
  subscribeVideoDownloads(() => {
    const now = getVideoDownloads().entries;
    for (const entry of newlySaved(videos, now)) {
      const label = entry.kind === 'movie' ? entry.titleName : `${entry.titleName} ${itemLabel(entry)}`;
      desktop.notify('Saved for offline', label).catch(() => {});
    }
    videos = now;
    report();
  });

  let musicProgress = getMusicDownloads().progress;
  subscribeMusicDownloads(() => {
    const { progress, failed } = getMusicDownloads();
    if (musicProgress && !progress) {
      desktop.notify('Songs downloaded', failed ? `${failed} could not be downloaded.` : 'Your playlists are ready offline.').catch(() => {});
    }
    musicProgress = progress;
    report();
  });

  subscribePlayer(report);
  desktop.onTrayAction((action) => TRAY_ACTIONS[action]?.());
  report();
}
