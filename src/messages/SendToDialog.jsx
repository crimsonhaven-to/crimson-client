// Sends a song or show card to one of your chats, or straight to a handle.
// `makeCard` is async because a song's card needs a share token minted first.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Send, Users } from 'lucide-react';

import Dialog from '../library/Dialog';
import { useProfile } from '../account/profile';
import { messagesApi } from './api';
import { roomTitle } from './format';
import HandleSetup from './HandleSetup';

const INPUT = 'w-full px-4 py-3 rounded-2xl bg-crimson-950/50 border border-crimson-900/60 text-crimson-50 placeholder-crimson-400 text-sm font-bold focus:outline-none focus:border-crimson-500/60';

export default function SendToDialog({ subject, makeCard, onClose }) {
  const navigate = useNavigate();
  const profile = useProfile();
  const me = profile?.handle;
  const [rooms, setRooms] = useState(null);
  const [needsHandle, setNeedsHandle] = useState(false);
  const [handle, setHandle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    messagesApi.rooms().then(
      (list) => { setNeedsHandle(false); setRooms(list); },
      (err) => (err.status === 409 ? setNeedsHandle(true) : setError(err.message)),
    );
  }, [me]);

  const deliver = async (key, openRoom) => {
    setBusy(key);
    setError(null);
    try {
      const card = await makeCard();
      const room = await openRoom();
      await messagesApi.send(room.id, note.trim(), card);
      setSent({ id: room.id, title: roomTitle(room, me) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const toHandle = (e) => {
    e.preventDefault();
    if (handle.trim()) deliver('handle', () => messagesApi.openDirect(handle.trim()));
  };

  if (sent) {
    return (
      <Dialog icon={Check} title="Sent" subtitle={subject} onClose={onClose}>
        <p className="text-sm text-crimson-300">On its way to {sent.title}.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-crimson-400 hover:text-crimson-100">
            Done
          </button>
          <button onClick={() => { onClose(); navigate(`/messages/${sent.id}`); }}
            className="px-5 py-3 rounded-2xl bg-crimson-600 hover:bg-crimson-500 text-white text-[11px] font-black uppercase tracking-widest">
            Open chat
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog icon={Send} title="Send to a member" subtitle={subject} onClose={onClose}>
      {needsHandle ? (
        <HandleSetup />
      ) : (
        <div className="space-y-4">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
            placeholder="Add a note (optional)" aria-label="Note" className={INPUT} />
          {rooms === null && !error ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-crimson-500 animate-spin" /></div>
          ) : rooms?.length > 0 && (
            <ul className="max-h-56 overflow-y-auto space-y-1 -mx-1 px-1">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button onClick={() => deliver(room.id, async () => room)} disabled={busy !== null}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-crimson-900/30 text-left disabled:opacity-50">
                    <span className="w-8 h-8 flex-shrink-0 rounded-full bg-crimson-900/60 flex items-center justify-center text-crimson-200 text-xs font-black uppercase">
                      {room.kind === 'group' ? <Users className="w-3.5 h-3.5" /> : roomTitle(room, me).replace('@', '').slice(0, 1)}
                    </span>
                    <span className="flex-grow truncate text-sm font-bold text-crimson-100">{roomTitle(room, me)}</span>
                    {busy === room.id && <Loader2 className="w-4 h-4 text-crimson-400 animate-spin" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={toHandle} className="flex gap-2">
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Or a @handle"
              aria-label="Handle" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className={`${INPUT} flex-grow min-w-0`} />
            <button type="submit" disabled={busy !== null || !handle.trim()}
              className="px-4 rounded-2xl bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white">
              {busy === 'handle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
          {error && <p className="text-xs font-bold text-amber-400">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
