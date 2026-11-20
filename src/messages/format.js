import { kindOf } from '../library/watchlistItem';

// Lowercase, like the server stores it, so the check matches what it will accept.
export const HANDLE_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export const normalizeHandle = (raw) => raw.trim().replace(/^@/, '').toLowerCase();

export const memberName = (member) =>
  member ? member.username || `@${member.handle}` : 'A former member';

export const otherMembers = (room, me) => room.members.filter((m) => m.handle !== me);

export function roomTitle(room, me) {
  if (room.kind === 'group') return room.name;
  const [other] = otherMembers(room, me);
  return other ? memberName(other) : 'A former member';
}

export function roomSubtitle(room, me) {
  if (room.kind === 'group') return `${room.members.length} members`;
  const [other] = otherMembers(room, me);
  return other ? `@${other.handle}` : '';
}

export const MEDIA_LABEL = { anime: 'Anime', show: 'Show', movie: 'Movie', manga: 'Manga' };

export function cardHref(card) {
  return card.kind === 'song' ? `/music/song/${card.token}` : `/${card.media}/${card.id}`;
}

function cardText(card) {
  return card.kind === 'song' ? `a song: ${card.title}` : `${card.title}`;
}

export function preview(message, room) {
  if (!message) return 'No messages yet';
  const text = message.body || `Sent ${cardText(message.attachment)}`;
  if (message.mine) return `You: ${text}`;
  if (room.kind === 'group') return `${memberName(message.sender)}: ${text}`;
  return text;
}

// The card for a watchlist item, the shape every overview page already builds.
export function titleCard(item) {
  const media = kindOf(item);
  const id = media === 'anime' || media === 'manga' ? item.anilist_id : item.tmdb_id;
  return { kind: 'title', media, id: Number(id), title: item.title, poster: item.poster || null };
}

export function formatWhen(iso, now = new Date()) {
  const when = new Date(iso);
  if (when.toDateString() === now.toDateString()) {
    return when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = when.getFullYear() === now.getFullYear();
  return when.toLocaleDateString([], { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}
