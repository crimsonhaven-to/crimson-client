// A song or show inside a message. It opens the song's share page or the show's
// overview, both of which any signed-in member can see.
import { Link } from 'react-router-dom';
import { Music, Clapperboard } from 'lucide-react';

import { MEDIA_LABEL, cardHref } from './format';

export default function MessageCard({ card }) {
  const song = card.kind === 'song';
  const image = song ? card.cover : card.poster;
  const Fallback = song ? Music : Clapperboard;
  return (
    <Link
      to={cardHref(card)}
      className="flex items-center gap-3 p-2 pr-4 rounded-xl bg-black/25 hover:bg-black/40 border border-white/5 transition-colors min-w-0 max-w-xs"
    >
      {image ? (
        <img src={image} alt="" loading="lazy"
          className={`flex-shrink-0 object-cover rounded-lg ${song ? 'w-12 h-12' : 'w-10 h-14'}`} />
      ) : (
        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-crimson-900/50 flex items-center justify-center">
          <Fallback className="w-5 h-5 text-crimson-400" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
          {song ? 'Song' : MEDIA_LABEL[card.media]}
        </p>
        <p className="text-sm font-bold truncate">{card.title}</p>
        {song && <p className="text-xs opacity-70 truncate">{card.artists.join(', ')}</p>}
      </div>
    </Link>
  );
}
