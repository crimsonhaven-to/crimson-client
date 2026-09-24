// Lumi's chat drawer: a floating summon button plus a slide-out panel, mounted
// once at the app root so she is reachable from any page.
//
// It renders nothing at all unless the backend says this viewer may chat
// (feature switched on, a provider key configured, and this account granted
// access on the Admin › Users tab). Chat access is deny-by-default, so for most
// accounts this component is invisible and costs one small request on mount.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, ChevronLeft, Play, RotateCcw, Send, Sparkles, X } from 'lucide-react';

import { useLumiChat, useLumiStatus } from './hooks';

// The watch pages own the whole viewport and their controls sit exactly where
// the summon button would. Hiding it there beats floating a button over the
// player's seek bar.
const HIDDEN_ON = [/^\/watch/, /^\/watch-show/, /^\/watch-movie/, /^\/watch-local/, /^\/watch-live/];

// The manga reader keeps its own controls near the bottom edge, and on a phone
// the summon button lands on top of them. Rather than hide her there too, the
// button tucks itself off the right edge once it has been ignored this long,
// leaving a sliver to tap when she is actually wanted.
const TUCK_AFTER_MS = 4000;

function Bubble({ msg, onOpen }) {
  const mine = msg.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] space-y-2 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed whitespace-pre-wrap break-words ${
            mine
              ? 'bg-crimson-600 text-white rounded-br-sm'
              : msg.error
                ? 'bg-crimson-950/60 border border-crimson-700/50 text-crimson-300 rounded-bl-sm'
                : 'bg-crimson-950/50 border border-crimson-900/60 text-crimson-100 rounded-bl-sm'
          }`}
        >
          {msg.content}
          {/* A caret while the reply is still streaming, so a slow first token
              reads as "thinking" rather than "broken". */}
          {msg.pending && !msg.content && (
            <span className="inline-flex gap-1 items-center text-crimson-500">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
            </span>
          )}
          {msg.pending && msg.content && <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-crimson-500 animate-pulse" />}
        </div>

        {/* Tool results that resolved to something playable. The backend hands
            over a route, never a navigation: the client owns its own router. */}
        {(msg.actions || []).filter((a) => a.type === 'open').map((a) => (
          <button
            key={a.route}
            onClick={() => onOpen(a.route)}
            className="flex items-center gap-2 px-4 py-2.5 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_8px_20px_rgba(255,0,60,0.2)]"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="truncate max-w-[14rem]">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Lumi() {
  const status = useLumiStatus();
  const [open, setOpen] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [draft, setDraft] = useState('');
  const [greeting, setGreeting] = useState(null);
  const { messages, busy, send, reset } = useLumiChat();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // The greeting is picked when the drawer is summoned rather than during render:
  // Math.random() is impure, and calling it in a render path is both a lint error
  // and a correctness trap under concurrent rendering. Picking it here also means
  // a fresh line every time she is summoned, which is what you want anyway.
  const summon = () => {
    const pool = status?.greetings || [];
    if (pool.length) setGreeting(pool[Math.floor(Math.random() * pool.length)]);
    setTucked(false);
    setOpen(true);
  };

  useEffect(() => {
    if (open || tucked) return undefined;
    const timer = setTimeout(() => setTucked(true), TUCK_AFTER_MS);
    return () => clearTimeout(timer);
  }, [open, tucked]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape closes, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!status?.available) return null;
  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;

  const openRoute = (route) => {
    setOpen(false);
    navigate(route);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    send(draft);
    setDraft('');
  };

  return (
    <>
      {!open && (
        <button
          onClick={tucked ? () => setTucked(false) : summon}
          title={tucked ? 'Bring Lumi back' : 'Summon Lumi'}
          // --music-bar is the music player's height while it shows, so this sits above it.
          className={`fixed bottom-[calc(1.5rem+var(--music-bar,0px))] right-6 z-[80] w-14 h-14 rounded-full bg-crimson-600 hover:bg-crimson-500 text-white shadow-[0_10px_30px_rgba(255,0,60,0.35)] flex items-center transition-all duration-500 ${
            tucked ? 'translate-x-14 opacity-70 justify-start pl-1.5' : 'justify-center hover:scale-105'
          }`}
        >
          {tucked ? <ChevronLeft className="w-4 h-4" /> : <Sparkles className="w-6 h-6" />}
        </button>
      )}

      {open && (
        <div className="fixed inset-y-0 right-0 z-[90] w-full sm:w-[26rem] bg-crimson-950/95 backdrop-blur-xl border-l border-crimson-900/60 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-crimson-900/60 flex-shrink-0">
            <Bot className="w-4 h-4 text-crimson-500" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-crimson-400">Luminas Crimsonveil</h2>
            <button
              onClick={reset}
              title="Start a new conversation"
              className="ml-auto p-2 rounded-xl text-crimson-500 hover:text-crimson-300 hover:bg-crimson-900/40 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Dismiss"
              className="p-2 rounded-xl text-crimson-500 hover:text-crimson-300 hover:bg-crimson-900/40 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-grow overflow-y-auto px-5 py-5 space-y-4">
            {messages.length === 0 && greeting && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-crimson-950/50 border border-crimson-900/60 text-crimson-100 text-sm font-medium leading-relaxed italic">
                  {greeting}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              // Index is a safe key here: the list is strictly append-only and the
              // tail entry is mutated in place rather than reordered.
              <Bubble key={i} msg={m} onOpen={openRoute} />
            ))}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 px-4 py-4 border-t border-crimson-900/60 flex-shrink-0">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask the empress…"
              maxLength={2000}
              disabled={busy}
              className="flex-grow px-4 py-3 bg-crimson-950/60 border border-crimson-900/60 rounded-2xl text-crimson-50 placeholder-crimson-700 text-sm font-bold focus:outline-none focus:border-crimson-500 transition-all disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="p-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl transition-all disabled:opacity-40 disabled:hover:bg-crimson-600"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
