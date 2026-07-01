// Watchlists data layer (favorites + user-made lists). Lighter than useAccount (no
// profile/history fetches), so it's cheap to mount inside the per-show "add to
// list" button as well as the Watchlists page. Lifted verbatim from hooks.js.
import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch, useSessionToken } from './apiClient';

// The default list every account has (the original single "Favorites" tab). Any
// other list_name is a user-made watchlist (e.g. "Todo", "Done", "Paused").
export const DEFAULT_LIST = 'favorites';
// A virtual, read-only list surfaced only on the Watchlists page: the
// de-duplicated union of every list's shows. It is NOT a real list_name and is
// never sent to the server — keep it out of the hook's `lists` so it can't show
// up as an "add to list" target in WatchlistButton.
export const ALL_LIST = '__all__';
const CUSTOM_LISTS_KEY = 'crimson:watchlists';

// Human label for a list name — the default list reads as "Favorites", the
// virtual aggregate reads as "All".
export const listLabel = (name) =>
  name === DEFAULT_LIST ? 'Favorites' : name === ALL_LIST ? 'All' : name;

const loadCustomLists = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_LISTS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(n => typeof n === 'string') : [];
  } catch {
    return [];
  }
};
const saveCustomLists = (names) =>
  localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(names));

// True when a stored favorite row refers to the same show as `item`. Mirrors the
// backend dedup key (account_engine/routes.py:_favorite_item_key): AniList id is
// preferred, otherwise it's a TMDB-only row.
const rowMatchesItem = (row, item) => {
  if (item.anilist_id != null) return row.anilist_id === item.anilist_id;
  if (item.tmdb_id != null) {
    // Movies share the TMDB id space with shows, so a movie favorite must only
    // match movie rows (and vice-versa) — mirrors the backend's movie: namespace.
    if (item.media_type === 'movie') return String(row.tmdb_id) === String(item.tmdb_id) && row.media_type === 'movie';
    return String(row.tmdb_id) === String(item.tmdb_id) && row.anilist_id == null && row.media_type !== 'movie';
  }
  return false;
};

// Query params identifying one show for the DELETE endpoint (AniList preferred).
const itemQuery = (item, listName) => {
  const p = new URLSearchParams();
  if (item.anilist_id != null) p.set('anilist_id', item.anilist_id);
  else if (item.tmdb_id != null) {
    p.set('tmdb_id', item.tmdb_id);
    if (item.media_type === 'movie') p.set('media_type', 'movie');
  }
  if (listName != null) p.set('list_name', listName);
  return p;
};

// Watchlists data layer. Lighter than useAccount (no profile/history fetches), so
// it's cheap to mount inside the per-show "add to list" button as well as the
// Watchlists page. Empty lists (created but not yet populated) live in
// localStorage, since the server only knows a list once it has ≥1 item.
export function useWatchlists() {
  const sessionToken = useSessionToken();
  const [items, setItems] = useState([]);        // every favorite row, all lists
  const [serverLists, setServerLists] = useState([]); // [{list_name, count}]
  const [customLists, setCustomLists] = useState(loadCustomLists);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionToken) { setItems([]); setServerLists([]); return; }
    setLoading(true);
    try {
      const [favRes, listRes] = await Promise.all([
        apiFetch(`/account/favorites`),
        apiFetch(`/account/watchlists`),
      ]);
      if (favRes.ok) setItems((await favRes.json()).favorites || []);
      if (listRes.ok) setServerLists((await listRes.json()).watchlists || []);
    } catch (e) {
      console.error("Watchlists fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { refresh(); }, [refresh]);

  // Union of the default list, server lists (with counts) and any empty
  // client-side lists, ordered with "Favorites" first then alphabetical.
  const lists = useMemo(() => {
    const map = new Map();
    map.set(DEFAULT_LIST, { name: DEFAULT_LIST, count: 0 });
    customLists.forEach(n => { if (!map.has(n)) map.set(n, { name: n, count: 0 }); });
    serverLists.forEach(l => map.set(l.list_name, { name: l.list_name, count: l.count }));
    return Array.from(map.values()).sort((a, b) => {
      if (a.name === DEFAULT_LIST) return -1;
      if (b.name === DEFAULT_LIST) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [serverLists, customLists]);

  // Names of the lists a given show currently belongs to.
  const listsForItem = useCallback(
    (item) => items.filter(r => rowMatchesItem(r, item)).map(r => r.list_name),
    [items]
  );

  const addToList = useCallback(async (item, listName) => {
    if (!sessionToken) return false;
    try {
      const res = await apiFetch(`/account/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: item.tmdb_id ?? null,
          anilist_id: item.anilist_id ?? null,
          media_type: item.media_type ?? null,
          title: item.title || item.name,
          poster: item.poster,
          list_name: listName,
        }),
      });
      if (res.ok) { await refresh(); return true; }
    } catch (e) {
      console.error("Add to list error:", e);
    }
    return false;
  }, [sessionToken, refresh]);

  const removeFromList = useCallback(async (item, listName) => {
    if (!sessionToken) return false;
    try {
      const res = await apiFetch(`/account/favorites?${itemQuery(item, listName)}`, {
        method: 'DELETE',
      });
      if (res.ok) { await refresh(); return true; }
    } catch (e) {
      console.error("Remove from list error:", e);
    }
    return false;
  }, [sessionToken, refresh]);

  const toggleInList = useCallback(async (item, listName) => {
    const inList = items.some(r => rowMatchesItem(r, item) && r.list_name === listName);
    return inList ? removeFromList(item, listName) : addToList(item, listName);
  }, [items, addToList, removeFromList]);

  // Create an (initially empty) list. Persists client-side until it gets items.
  const createList = useCallback((name) => {
    const clean = (name || '').trim().slice(0, 100);
    if (!clean || clean === DEFAULT_LIST) return false;
    setCustomLists(prev => {
      if (prev.includes(clean)) return prev;
      const next = [...prev, clean];
      saveCustomLists(next);
      return next;
    });
    return true;
  }, []);

  // Remove a whole list: delete its server rows, then drop the client entry. The
  // default list can be emptied but not removed.
  const deleteList = useCallback(async (name) => {
    if (name === DEFAULT_LIST) return false;
    const rows = items.filter(r => r.list_name === name);
    await Promise.all(rows.map(r =>
      apiFetch(`/account/favorites?${itemQuery(r, name)}`, { method: 'DELETE' }).catch(() => {})
    ));
    setCustomLists(prev => {
      const next = prev.filter(n => n !== name);
      saveCustomLists(next);
      return next;
    });
    await refresh();
    return true;
  }, [items, refresh]);

  // Download every watchlist as one file. `format` is 'csv' (spreadsheet-friendly,
  // default) or 'json' (a round-trippable backup). The export is auth-gated, so we
  // fetch it through apiFetch (which attaches the bearer token) and trigger the
  // save from the resulting blob — a plain <a download> wouldn't carry the token.
  const exportWatchlists = useCallback(async (format = 'csv') => {
    if (!sessionToken) return false;
    try {
      const res = await apiFetch(`/account/favorites/export?format=${format}`);
      if (!res.ok) return false;
      const blob = await res.blob();
      // Honour the server's filename (Content-Disposition) when present.
      const disp = res.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `crimson-watchlists.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('Export watchlists error:', e);
      return false;
    }
  }, [sessionToken]);

  // Restore watchlists from an exported CSV/JSON file. The file is sent as the
  // raw request body (the backend sniffs CSV vs JSON from the content). `mode` is
  // 'merge' (default — add to existing lists) or 'replace' (wipe all lists first).
  // Resolves to the server's summary ({ imported, skipped, total, ... }) so the
  // UI can report what happened; refreshes so imported lists/items show at once.
  const importWatchlists = useCallback(async (file, mode = 'merge') => {
    if (!sessionToken) return { ok: false, error: 'You need to be signed in.' };
    if (!file) return { ok: false, error: 'No file selected.' };
    try {
      const text = await file.text();
      const isJson = (file.name || '').toLowerCase().endsWith('.json');
      const res = await apiFetch(`/account/favorites/import?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': isJson ? 'application/json' : 'text/csv' },
        body: text,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.detail || 'Import failed.' };
      await refresh();
      return { ok: true, ...data };
    } catch (e) {
      console.error('Import watchlists error:', e);
      return { ok: false, error: e.message || 'Import failed.' };
    }
  }, [sessionToken, refresh]);

  return {
    items, lists, loading,
    listsForItem, addToList, removeFromList, toggleInList,
    createList, deleteList, exportWatchlists, importWatchlists,
    refresh,
  };
}
