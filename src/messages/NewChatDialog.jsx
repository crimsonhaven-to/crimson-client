import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageCirclePlus } from 'lucide-react';

import Dialog from '../library/Dialog';
import { messagesApi } from './api';

const INPUT = 'w-full px-4 py-3 rounded-2xl bg-crimson-950/50 border border-crimson-900/60 text-crimson-50 placeholder-crimson-400 text-sm font-bold focus:outline-none focus:border-crimson-500/60';

// Commas, spaces or new lines all separate handles, however they were pasted.
const splitHandles = (raw) => raw.split(/[\s,]+/).filter(Boolean);

export default function NewChatDialog({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [group, setGroup] = useState(false);
  const [handles, setHandles] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = splitHandles(handles);
  const ready = group ? name.trim() && list.length > 0 : list.length === 1;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = group
        ? await messagesApi.createGroup(name.trim(), list)
        : await messagesApi.openDirect(list[0]);
      onCreated();
      onClose();
      navigate(`/messages/${room.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const tab = (isGroup, label) => (
    <button type="button" onClick={() => setGroup(isGroup)}
      className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${
        group === isGroup ? 'bg-crimson-600 text-white' : 'text-crimson-400 hover:text-crimson-100'
      }`}>
      {label}
    </button>
  );

  return (
    <Dialog icon={MessageCirclePlus} title="New chat" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-1 p-1 rounded-2xl bg-crimson-950/60 border border-crimson-900/60">
          {tab(false, 'One person')}
          {tab(true, 'Group')}
        </div>
        {group && (
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
            placeholder="Group name" aria-label="Group name" className={INPUT} />
        )}
        <input value={handles} onChange={(e) => setHandles(e.target.value)}
          placeholder={group ? '@ami, @bo, @cy' : '@handle'} aria-label="Handles"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus className={INPUT} />
        {!group && list.length > 1 && (
          <p className="text-xs text-crimson-400">One handle for a private chat, or switch to Group.</p>
        )}
        {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-crimson-400 hover:text-crimson-100">
            Cancel
          </button>
          <button type="submit" disabled={!ready || busy}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white text-[11px] font-black uppercase tracking-widest">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Start
          </button>
        </div>
      </form>
    </Dialog>
  );
}
