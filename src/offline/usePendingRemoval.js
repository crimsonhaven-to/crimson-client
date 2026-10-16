import { useCallback, useEffect, useRef, useState } from 'react';

import { removeDownload } from './queue';

const UNDO_FOR_MS = 6000;

async function removeAll(ids) {
  for (const id of ids) await removeDownload(id);
}

// A removal waits a few seconds so a misclick can be taken back. Removing
// something else, or leaving the page, carries out the waiting one at once.
export function usePendingRemoval() {
  const [pending, setPending] = useState(null);
  const waiting = useRef(null);

  const commit = useCallback(() => {
    const removal = waiting.current;
    if (!removal) return;
    waiting.current = null;
    clearTimeout(removal.timer);
    setPending(null);
    removeAll(removal.ids);
  }, []);

  const remove = useCallback((ids, label) => {
    commit();
    waiting.current = { ids, label, timer: setTimeout(commit, UNDO_FOR_MS) };
    setPending(waiting.current);
  }, [commit]);

  const undo = useCallback(() => {
    clearTimeout(waiting.current?.timer);
    waiting.current = null;
    setPending(null);
  }, []);

  useEffect(() => commit, [commit]);

  return { pending, remove, undo };
}
