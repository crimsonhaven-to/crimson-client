// One poll for the whole app, so the badge costs one small request however many
// places show it. It only runs while something is subscribed and the tab is visible.
import { useSyncExternalStore } from 'react';

import { messagesApi } from './api';

const POLL_MS = 20000;

let count = 0;
let timer = null;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export async function refreshUnread() {
  let next;
  try {
    next = await messagesApi.unread();
  } catch {
    return;
  }
  if (next !== count) {
    count = next;
    emit();
  }
}

function tick() {
  if (document.visibilityState === 'visible') refreshUnread();
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refreshUnread();
    timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', tick);
    // The next account to sign in on this device must not see this one's count.
    count = 0;
  };
}

export function useUnreadCount() {
  return useSyncExternalStore(subscribe, () => count);
}
