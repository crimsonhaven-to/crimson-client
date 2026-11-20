// A group's name, members and leaving it; for a private chat, blocking.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, Settings2, UserX } from 'lucide-react';

import Dialog from '../library/Dialog';
import { messagesApi } from './api';
import { memberName, otherMembers } from './format';

const INPUT = 'flex-grow min-w-0 px-4 py-3 rounded-2xl bg-crimson-950/50 border border-crimson-900/60 text-crimson-50 placeholder-crimson-400 text-sm font-bold focus:outline-none focus:border-crimson-500/60';
const BUTTON = 'px-4 py-3 rounded-2xl bg-crimson-900/40 hover:bg-crimson-900/70 text-crimson-100 text-[11px] font-black uppercase tracking-widest disabled:opacity-40';

function GroupSettings({ room, me, onChanged, onClose }) {
  const navigate = useNavigate();
  const [name, setName] = useState(room.name);
  const [handle, setHandle] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rename = (e) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== room.name) run(() => messagesApi.rename(room.id, name.trim()));
  };
  const add = (e) => {
    e.preventDefault();
    if (handle.trim()) run(async () => { await messagesApi.addMembers(room.id, [handle.trim()]); setHandle(''); });
  };
  const leave = () => run(async () => {
    await messagesApi.leave(room.id);
    onClose();
    navigate('/messages');
  });

  return (
    <div className="space-y-5">
      <form onSubmit={rename} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Group name" className={INPUT} />
        <button type="submit" disabled={busy || !name.trim() || name.trim() === room.name} className={BUTTON}>Rename</button>
      </form>
      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-crimson-500">{room.members.length} members</p>
        <ul className="max-h-48 overflow-y-auto space-y-1">
          {room.members.map((m) => (
            <li key={m.handle} className="flex items-baseline gap-2 text-sm">
              <span className="font-bold text-crimson-100 truncate">{memberName(m)}{m.handle === me && ' (you)'}</span>
              <span className="text-xs text-crimson-400">@{m.handle}</span>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" aria-label="Add a member"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} className={INPUT} />
        <button type="submit" disabled={busy || !handle.trim()} className={BUTTON}>Add</button>
      </form>
      {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
      <button onClick={confirmLeave ? leave : () => setConfirmLeave(true)} disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-crimson-900/60 text-crimson-400 hover:text-white hover:bg-crimson-600/20 text-[11px] font-black uppercase tracking-widest">
        <LogOut className="w-4 h-4" /> {confirmLeave ? 'Tap again to leave' : 'Leave group'}
      </button>
    </div>
  );
}

function DirectSettings({ room, me }) {
  const [other] = otherMembers(room, me);
  const [blocked, setBlocked] = useState(null);
  const [error, setError] = useState(null);

  const handle = other?.handle;
  useEffect(() => {
    if (!handle) return;
    messagesApi.findMember(handle).then((m) => setBlocked(m.blocked), (err) => setError(err.message));
  }, [handle]);

  if (!other) return <p className="text-sm text-crimson-400">This member deleted their account.</p>;

  const toggle = async () => {
    setError(null);
    try {
      if (blocked) await messagesApi.unblock(other.handle);
      else await messagesApi.block(other.handle);
      setBlocked(!blocked);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-crimson-300">
        {blocked
          ? `You blocked @${other.handle}. Neither of you can write here until you unblock them.`
          : `Blocking @${other.handle} stops their messages here and stops them adding you to groups.`}
      </p>
      {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
      <button onClick={toggle} disabled={blocked === null}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-crimson-900/60 text-crimson-400 hover:text-white hover:bg-crimson-600/20 text-[11px] font-black uppercase tracking-widest disabled:opacity-40">
        {blocked === null ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
        {blocked ? 'Unblock' : 'Block'}
      </button>
    </div>
  );
}

export default function RoomDialog({ room, me, onChanged, onClose }) {
  return (
    <Dialog icon={Settings2} title={room.kind === 'group' ? 'Group' : 'Chat'} onClose={onClose}>
      {room.kind === 'group'
        ? <GroupSettings room={room} me={me} onChanged={onChanged} onClose={onClose} />
        : <DirectSettings room={room} me={me} />}
    </Dialog>
  );
}
