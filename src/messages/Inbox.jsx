import { Link } from 'react-router-dom';
import { MessageCirclePlus, Users } from 'lucide-react';

import { formatWhen, preview, roomTitle } from './format';

export default function Inbox({ rooms, me, activeId, onNewChat }) {
  return (
    <div className="h-full flex flex-col bg-crimson-950/30 border border-crimson-900/40 rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-crimson-900/40 flex-shrink-0">
        <h1 className="text-[11px] font-black uppercase tracking-widest text-crimson-400">Messages</h1>
        <button onClick={onNewChat} title="New chat" aria-label="New chat"
          className="p-2 rounded-xl text-crimson-400 hover:text-crimson-100 hover:bg-crimson-900/40 transition-colors">
          <MessageCirclePlus className="w-5 h-5" />
        </button>
      </div>
      {rooms.length === 0 ? (
        <div className="p-6 text-center text-sm text-crimson-400 space-y-3">
          <p>No chats yet.</p>
          <button onClick={onNewChat} className="text-[11px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300">
            Start one
          </button>
        </div>
      ) : (
        <ul className="flex-grow overflow-y-auto p-2 space-y-1">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link to={`/messages/${room.id}`}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${
                  String(room.id) === String(activeId) ? 'bg-crimson-500/15' : 'hover:bg-crimson-900/30'
                }`}>
                <div className="w-10 h-10 flex-shrink-0 rounded-full bg-crimson-900/60 flex items-center justify-center text-crimson-200 font-black uppercase">
                  {room.kind === 'group' ? <Users className="w-4 h-4" /> : roomTitle(room, me).replace('@', '').slice(0, 1)}
                </div>
                <div className="min-w-0 flex-grow">
                  <div className="flex items-baseline gap-2">
                    <p className={`truncate text-sm ${room.unread ? 'font-black text-crimson-50' : 'font-bold text-crimson-100'}`}>
                      {roomTitle(room, me)}
                    </p>
                    <span className="ml-auto flex-shrink-0 text-[10px] text-crimson-400 tabular-nums">
                      {room.last_message && formatWhen(room.last_message.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`truncate text-xs ${room.unread ? 'text-crimson-200' : 'text-crimson-400'}`}>
                      {preview(room.last_message, room)}
                    </p>
                    {room.unread > 0 && (
                      <span className="ml-auto flex-shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-crimson-600 text-white text-[10px] font-black flex items-center justify-center">
                        {room.unread > 99 ? '99+' : room.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
