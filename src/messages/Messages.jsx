// The inbox beside the open chat on a wide screen; one or the other on a phone,
// where the route decides which.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MessageCircle } from 'lucide-react';

import { useProfile } from '../account/profile';
import { useTitle } from '../useTitle';
import { messagesApi } from './api';
import HandleSetup from './HandleSetup';
import Inbox from './Inbox';
import NewChatDialog from './NewChatDialog';
import { useVisiblePoll } from './poll';
import RoomDialog from './RoomDialog';
import Thread from './Thread';

const INBOX_POLL_MS = 15000;

function Spinner() {
  return <div className="py-32 flex justify-center"><Loader2 className="w-8 h-8 text-crimson-500 animate-spin" /></div>;
}

export default function Messages() {
  const { roomId } = useParams();
  const profile = useProfile();
  const me = profile?.handle;
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  useTitle('Messages');

  const reload = useCallback(() => {
    if (!me) return;
    messagesApi.rooms().then(
      (list) => { setRooms(list); setError(null); },
      (err) => setError(err.message),
    );
  }, [me]);

  useEffect(() => { reload(); }, [reload]);
  useVisiblePoll(reload, INBOX_POLL_MS);

  // A chat just opened from elsewhere may be newer than the last inbox load. Once
  // per chat, so one that really is gone does not reload forever.
  const room = rooms?.find((r) => String(r.id) === String(roomId));
  const retried = useRef(null);
  useEffect(() => {
    if (!roomId || !rooms || room || retried.current === roomId) return;
    retried.current = roomId;
    reload();
  }, [roomId, rooms, room, reload]);

  const markRead = useCallback((id) => {
    setRooms((list) => list?.map((r) => (r.id === id ? { ...r, unread: 0 } : r)));
  }, []);

  if (!profile) return <Spinner />;
  if (!me) {
    return (
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-16">
        <HandleSetup />
      </div>
    );
  }
  if (!rooms) {
    return error
      ? <p className="py-32 text-center text-crimson-300 font-bold">{error}</p>
      : <Spinner />;
  }

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 lg:py-8">
      <div className="grid lg:grid-cols-[22rem_minmax(0,1fr)] gap-4 lg:gap-6 h-[calc(100dvh-7rem-var(--music-bar,0px))] min-h-[24rem]">
        <aside className={`min-h-0 ${roomId ? 'max-lg:hidden' : ''}`}>
          <Inbox rooms={rooms} me={me} activeId={roomId} onNewChat={() => setDialog('new')} />
        </aside>
        <section className={`min-h-0 ${roomId ? '' : 'max-lg:hidden'}`}>
          {room ? (
            <Thread key={room.id} room={room} me={me} onRead={markRead} onSent={reload}
              onOpenSettings={() => setDialog('room')} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center bg-crimson-950/30 border border-crimson-900/40 rounded-3xl p-6">
              <MessageCircle className="w-10 h-10 text-crimson-500" />
              <p className="text-sm text-crimson-300 font-bold">
                {roomId ? 'This chat is gone, or you left it.' : 'Pick a chat, or start a new one.'}
              </p>
              <p className="text-xs text-crimson-400">You are @{me}</p>
            </div>
          )}
        </section>
      </div>

      {dialog === 'new' && <NewChatDialog onClose={() => setDialog(null)} onCreated={reload} />}
      {dialog === 'room' && room && (
        <RoomDialog room={room} me={me} onChanged={reload} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
