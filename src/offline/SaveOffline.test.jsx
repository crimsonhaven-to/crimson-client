import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./queue', () => ({ saveOffline: vi.fn(async () => 1) }));
vi.mock('./videoStore', () => ({ supported: () => true }));

import { saveOffline } from './queue';
import SaveOffline from './SaveOffline';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const streams = [
  { source: 'Embed', type: 'iframe', url: 'https://e/1' },
  { source: 'PlayIMDb', type: 'hls', url: 'https://cdn/1.m3u8', language: null },
  { source: 'HDRezka', type: 'mp4', url: 'https://cdn/de.mp4', language: 'German' },
];
const item = (episode) => ({ id: `tv-1-s1-e${episode}`, kind: 'episode', season: 1, episode, titleKey: 'tv-1', titleName: 'Show' });

let root;
let card;

// The watch page's info card: its backdrop blur is what used to trap and clip the dialog.
function openInBlurredCard() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <MemoryRouter>
        <div data-card className="backdrop-blur-xl relative overflow-hidden">
          <SaveOffline streams={streams} activeStreamIdx={1} items={[item(1), item(2), item(3)]} />
        </div>
      </MemoryRouter>,
    );
  });
  card = host.querySelector('[data-card]');
  act(() => card.querySelector('button').click());
  return document.querySelector('[role="dialog"]');
}

const button = (dialog, label) => [...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === label);

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

describe('SaveOffline', () => {
  it('opens the dialog outside the card, so the card cannot clip it', () => {
    const dialog = openInBlurredCard();
    expect(dialog).not.toBeNull();
    expect(card.contains(dialog)).toBe(false);
  });

  it('lists only sources that can be saved', () => {
    const dialog = openInBlurredCard();
    expect(dialog.textContent).not.toContain('Embed');
    expect(dialog.textContent).toContain('HDRezka');
  });

  it('saves the picked source for the picked scope', async () => {
    const dialog = openInBlurredCard();
    act(() => button(dialog, 'HDRezkamp4 · German').click());
    act(() => button(dialog, 'This and the next 2').click());
    await act(async () => button(dialog, 'Save 3 episodes').click());
    const [items, { stream, wanted }] = saveOffline.mock.calls[0];
    expect(items.map((i) => i.episode)).toEqual([1, 2, 3]);
    expect(stream.url).toBe('https://cdn/de.mp4');
    expect(wanted).toEqual({ source: 'HDRezka', language: 'German' });
  });

  it('saves only the episode on screen by default', async () => {
    const dialog = openInBlurredCard();
    await act(async () => button(dialog, 'Save episode').click());
    expect(saveOffline.mock.calls[0][0]).toHaveLength(1);
  });
});
