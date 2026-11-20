// The two ways into SendToDialog: a song from the player, a title from its overview.
import { useState } from 'react';
import { Send } from 'lucide-react';

import { musicApi } from '../music/hooks';
import { titleCard } from './format';
import SendToDialog from './SendToDialog';

// A friend who opened a shared song has its token but cannot mint one, so a
// token already in hand is used first.
async function songCard(track) {
  const token = track.share_token || (await musicApi.share(track.id)).token;
  return { kind: 'song', token };
}

export function SendSongButton({ track, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Send to a member" title="Send to a member"
        className={`p-2 text-crimson-100/50 hover:text-crimson-200 transition-colors ${className}`}>
        <Send className="w-5 h-5" />
      </button>
      {open && (
        <SendToDialog subject={track.title} makeCard={() => songCard(track)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export function SendTitleButton({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-3 font-black uppercase tracking-[0.2em] text-xs px-8 py-4 rounded-2xl border transition-all active:scale-95 bg-crimson-950/40 border-crimson-900/60 text-crimson-300 hover:text-white hover:border-crimson-600 hover:bg-crimson-900/30 backdrop-blur-sm">
        <Send className="w-4 h-4 transition-transform group-hover:scale-110" />
        <span>Send to a friend</span>
      </button>
      {open && (
        <SendToDialog subject={item.title} makeCard={async () => titleCard(item)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
