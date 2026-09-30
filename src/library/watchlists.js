import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch, useSessionToken } from '../api/client';

export const DEFAULT_LIST = 'favorites';
// Virtual union of every list, shown only on the Watchlists page. Never sent to
// the server and kept out of `lists` so it is not an "add to list" target.
export const ALL_LIST = '__all__';
const CUSTOM_LISTS_KEY = 'crimson:watchlists';

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

// Mirrors the backend dedup key (account_engine/routes.py:_favorite_item_key).
const rowMatchesItem = (row, item) => {
  if (item.anilist_id != null) return row.anilist_id === item.anilist_id;
  if (item.tmdb_id != null) {
    // Movies share the TMDB id space with shows (the backend's movie: namespace).
    if (item.media_type === 'movie') return String(row.tmdb_id) === String(item.tmdb_id) && row.media_type === 'movie';
    return String(row.tmdb_id) === String(item.tmdb_id) && row.anilist_id == null && row.media_type !== 'movie';
  }
  return false;
};

// media_type must be sent for the namespaced kinds (movie:, manga:) so the backend
// rebuilds the same item_key; otherwise a manga delete computes `anilist:{id}`
// and 404s.
const itemQuery = (item, listName) => {
  const p = new URLSearchParams();
  if (item.anilist_id != null) {
    p.set('anilist_id', item.anilist_id);
    if (item.media_type === 'manga') p.set('media_type', 'manga');
  } else if (item.tmdb_id != null) {
    p.set('tmdb_id', item.tmdb_id);
    if (item.media_type === 'movie') p.set('media_type', 'movie');
  }
  if (listName != null) p.set('list_name', listName);
  return p;
};

// Cheap enough to mount inside every "add to list" button. Empty lists live in
// localStorage because the server only knows a list once it has an item.
export function useWatchlists() {
  const sessionToken = useSessionToken();
  const [items, setItems] = useState([]);
  const [serverLists, setServerLists] = useState([]);
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

  // `format` is 'csv' or 'json'. A plain <a download> would not carry the bearer
  // token, so the save is triggered from a fetched blob.
  const exportWatchlists = useCallback(async (format = 'csv') => {
    if (!sessionToken) return false;
    try {
      const res = await apiFetch(`/account/favorites/export?format=${format}`);
      if (!res.ok) return false;
      const blob = await res.blob();
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

  // `mode` is 'merge' or 'replace' (wipe all lists first). Resolves to the
  // server's summary ({ imported, skipped, total, ... }).
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
