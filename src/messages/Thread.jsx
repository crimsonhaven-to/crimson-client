// One open chat. Mounted with key={room.id}, so switching chats starts clean
// instead of carrying the last chat's messages and read marker over.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Settings2 } from 'lucide-react';

import { messagesApi } from './api';
import { formatWhen, memberName, roomSubtitle, roomTitle } from './format';
import MessageCard from './MessageCard';
import { useVisiblePoll } from './poll';
import { refreshUnread } from './unread';

const PAGE = 50;
const POLL_MS = 4000;
// Within this of the bottom counts as reading the newest, so new messages scroll in.
const NEAR_BOTTOM_PX = 120;
// A gap this long between two messages gets a time stamp between them.
const STAMP_GAP_MS = 10 * 60 * 1000;

export default function Thread({ room, me, onRead, onSent, onOpenSettings }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const atBottom = useRef(true);
  const restoreFrom = useRef(null);
  const readUpTo = useRef(0);

  const lastId = messages.length ? messages[messages.length - 1].id : 0;

  const append = (incoming) => setMessages((prev) => {
    const seen = new Set(prev.map((m) => m.id));
    const fresh = incoming.filter((m) => !seen.has(m.id));
    return fresh.length ? [...prev, ...fresh] : prev;
  });

  useEffect(() => {
    let live = true;
    messagesApi.messages(room.id, { limit: PAGE }).then(
      (page) => {
        if (!live) return;
        setMessages(page);
        setHasOlder(page.length === PAGE);
      },
      (err) => { if (live) setError(err.message); },
    ).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [room.id]);

  useVisiblePoll(() => {
    if (loading) return;
    messagesApi.messages(room.id, { after: lastId }).then(append, () => {});
  }, POLL_MS);

  // Older messages go in above, so the scroll keeps its place instead of jumping
  // to whatever now sits at the old offset.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreFrom.current !== null) {
      el.scrollTop += el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!lastId || lastId <= readUpTo.current || document.visibilityState !== 'visible') return;
    readUpTo.current = lastId;
    messagesApi.markRead(room.id, lastId).then(() => {
      refreshUnread();
      onRead(room.id);
    }, () => {});
  }, [lastId, room.id, onRead]);

  const onScroll = () => {
    const el = scrollRef.current;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const page = await messagesApi.messages(room.id, { before: messages[0].id, limit: PAGE });
      restoreFrom.current = scrollRef.current.scrollHeight;
      setHasOlder(page.length === PAGE);
      setMessages((prev) => [...page, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await messagesApi.send(room.id, text);
      atBottom.current = true;
      append([message]);
      setDraft('');
      onSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-crimson-950/30 border border-crimson-900/40 rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-crimson-900/40 flex-shrink-0">
        <Link to="/messages" aria-label="All chats"
          className="lg:hidden p-2 rounded-xl text-crimson-400 hover:text-crimson-100 hover:bg-crimson-900/40">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h2 className="font-black text-crimson-50 truncate">{roomTitle(room, me)}</h2>
          <p className="text-xs text-crimson-400 truncate">{roomSubtitle(room, me)}</p>
        </div>
        <button onClick={onOpenSettings} title="Chat settings" aria-label="Chat settings"
          className="ml-auto p-2 rounded-xl text-crimson-400 hover:text-crimson-100 hover:bg-crimson-900/40 transition-colors">
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-grow overflow-y-auto px-3 sm:px-5 py-4">
        {loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 text-crimson-500 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <p className="h-full flex items-center justify-center text-sm text-crimson-400 italic">Say hello, or send a song or a show.</p>
        ) : (
          <ol className="space-y-1.5">
            {hasOlder && (
              <li className="flex justify-center pb-3">
                <button onClick={loadOlder} disabled={loadingOlder}
                  className="text-[11px] font-black uppercase tracking-widest text-crimson-500 hover:text-crimson-300 disabled:opacity-50">
                  {loadingOlder ? 'Loading…' : 'Earlier messages'}
                </button>
              </li>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const stamp = !prev || new Date(m.created_at) - new Date(prev.created_at) > STAMP_GAP_MS;
              const showSender = room.kind === 'group' && !m.mine
                && (stamp || prev.mine || prev.sender?.handle !== m.sender?.handle);
              return (
                <li key={m.id}>
                  {stamp && <p className="text-center text-[10px] font-bold text-crimson-400 my-3">{formatWhen(m.created_at)}</p>}
                  <div className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                    {showSender && <p className="text-[10px] font-black text-crimson-400 mt-2 mb-1 ml-2">{memberName(m.sender)}</p>}
                    <div className={`max-w-[85%] space-y-2 px-3.5 py-2.5 rounded-2xl text-sm ${
                      m.mine
                        ? 'bg-crimson-600 text-white rounded-br-sm'
                        : 'bg-crimson-950/60 border border-crimson-900/60 text-crimson-100 rounded-bl-sm'
                    }`}>
                      {m.attachment && <MessageCard card={m.attachment} />}
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {error && <p className="px-5 pb-2 text-xs font-bold text-amber-400">{error}</p>}
      <form onSubmit={send} className="flex items-center gap-2 px-3 sm:px-4 py-3 border-t border-crimson-900/40 flex-shrink-0">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          maxLength={2000}
          aria-label="Message"
          className="flex-grow min-w-0 px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-400 text-sm font-medium focus:outline-none focus:border-crimson-500 transition-all"
        />
        <button type="submit" disabled={sending || !draft.trim()} aria-label="Send"
          className="p-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl transition-all disabled:opacity-40 disabled:hover:bg-crimson-600">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
