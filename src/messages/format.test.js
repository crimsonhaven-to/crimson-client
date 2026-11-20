import { describe, expect, it } from 'vitest';

import {
  HANDLE_PATTERN, cardHref, formatWhen, memberName, normalizeHandle, preview, roomSubtitle, roomTitle, titleCard,
} from './format';

const ray = { handle: 'ray', username: 'Raymond' };
const ami = { handle: 'ami', username: null };
const direct = { kind: 'direct', name: null, members: [ray, ami] };
const group = { kind: 'group', name: 'Gang', members: [ray, ami] };

describe('handles', () => {
  it('normalizes what was typed the way the server stores it', () => {
    expect(normalizeHandle('  @Ray_9 ')).toBe('ray_9');
  });

  it('matches the server rule', () => {
    expect(HANDLE_PATTERN.test('ray')).toBe(true);
    expect(HANDLE_PATTERN.test('ra')).toBe(false);
    expect(HANDLE_PATTERN.test('9ray')).toBe(false);
    expect(HANDLE_PATTERN.test('ray.mond')).toBe(false);
  });
});

describe('rooms', () => {
  it('names a direct chat after the other person', () => {
    expect(roomTitle(direct, 'ray')).toBe('@ami');
    expect(roomTitle(direct, 'ami')).toBe('Raymond');
    expect(roomSubtitle(direct, 'ray')).toBe('@ami');
  });

  it('names a group after itself', () => {
    expect(roomTitle(group, 'ray')).toBe('Gang');
    expect(roomSubtitle(group, 'ray')).toBe('2 members');
  });

  it('survives the other person deleting their account', () => {
    expect(roomTitle({ kind: 'direct', members: [ray] }, 'ray')).toBe('A former member');
    expect(memberName(null)).toBe('A former member');
  });
});

describe('previews', () => {
  it('says who wrote the last message where it matters', () => {
    expect(preview(null, direct)).toBe('No messages yet');
    expect(preview({ body: 'hi', mine: true }, direct)).toBe('You: hi');
    expect(preview({ body: 'hi', mine: false, sender: ami }, direct)).toBe('hi');
    expect(preview({ body: 'hi', mine: false, sender: ami }, group)).toBe('@ami: hi');
  });

  it('describes a card sent without text', () => {
    const song = { kind: 'song', token: 't', title: 'Song', artists: [] };
    expect(preview({ body: '', mine: true, attachment: song }, direct)).toBe('You: Sent a song: Song');
  });
});

describe('cards', () => {
  it('links a card to its page', () => {
    expect(cardHref({ kind: 'song', token: '7.abc' })).toBe('/music/song/7.abc');
    expect(cardHref({ kind: 'title', media: 'movie', id: 5 })).toBe('/movie/5');
  });

  it('builds a card from each kind of watchlist item', () => {
    expect(titleCard({ anilist_id: 1, title: 'A', poster: 'https://p' }))
      .toEqual({ kind: 'title', media: 'anime', id: 1, title: 'A', poster: 'https://p' });
    expect(titleCard({ anilist_id: 2, media_type: 'manga', title: 'M' }).media).toBe('manga');
    expect(titleCard({ tmdb_id: 3, media_type: 'movie', title: 'F' })).toMatchObject({ media: 'movie', id: 3 });
    expect(titleCard({ tmdb_id: 4, title: 'S' })).toMatchObject({ media: 'show', id: 4, poster: null });
  });
});

describe('formatWhen', () => {
  it('shows only the time for today and the date otherwise', () => {
    const now = new Date(2026, 10, 20, 18, 0);
    expect(formatWhen(new Date(2026, 10, 20, 9, 5).toISOString(), now)).toMatch(/09.05|9.05/);
    expect(formatWhen(new Date(2026, 10, 2).toISOString(), now)).not.toMatch(/2026/);
    expect(formatWhen(new Date(2025, 10, 2).toISOString(), now)).toMatch(/2025/);
  });
});
