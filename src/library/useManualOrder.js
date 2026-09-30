import { useState } from 'react';
import { kindOf, itemKey } from './watchlistItem';

const ORDER_KEY = 'crimson:watchlist-order'; // { [listName]: [itemKey, ...] }

const loadOrders = () => {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY)) || {}; } catch { return {}; }
};

// The per-list manual order and the drag gesture that edits it. `sequence` is the
// list as currently shown, which callers only allow dragging when it is complete
// (no search or type filter), so a reorder always describes the full order we persist.
export function useManualOrder(listName) {
  const [orders, setOrders] = useState(loadOrders);
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);

  const saveOrders = (o) => { setOrders(o); localStorage.setItem(ORDER_KEY, JSON.stringify(o)); };

  const commitReorder = (sequence, from, to) => {
    if (!from || !to || from === to) return;
    const byKey = new Map(sequence.map(s => [itemKey(s), s]));
    // Cross-kind drops would have no visible effect (sections render separately)
    // and would only muddy the order.
    if (kindOf(byKey.get(from)) !== kindOf(byKey.get(to))) return;
    const seq = sequence.map(itemKey);
    const fi = seq.indexOf(from);
    seq.splice(fi, 1);
    const ti = seq.indexOf(to);
    seq.splice(ti, 0, from);
    saveOrders({ ...orders, [listName]: seq });
  };

  const dragPropsFor = (item, sequence) => {
    const k = itemKey(item);
    return {
      draggable: true,
      onDragStart: (e) => { setDragKey(k); e.dataTransfer.effectAllowed = 'move'; },
      onDragEnter: () => { if (dragKey && dragKey !== k) setOverKey(k); },
      onDragOver: (e) => e.preventDefault(),
      onDrop: (e) => { e.preventDefault(); commitReorder(sequence, dragKey, k); setDragKey(null); setOverKey(null); },
      onDragEnd: () => { setDragKey(null); setOverKey(null); },
    };
  };

  const isDragOver = (key) => overKey === key && dragKey !== key;

  return { order: orders[listName], dragPropsFor, isDragOver };
}
