import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('./player', () => ({ playAt: vi.fn() }));

const { default: UpNext } = await import('./UpNext');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

const track = (id) => ({ id, title: `Song ${id}`, artists: ['Band'], duration_ms: 60_000, cover_url: null });

function render(count, position = 0) {
  const tracks = Array.from({ length: count }, (_, i) => track(i));
  const state = { tracks, order: tracks.map((_, i) => i), position };
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<UpNext state={state} />));
  return host;
}

const hiddenOnPhones = (host) => [...host.querySelectorAll('li')].filter((li) => li.className.includes('max-lg:hidden'));

describe('UpNext', () => {
  it('shows a phone only the next three songs until the queue is opened', () => {
    const host = render(500);
    expect(host.querySelectorAll('li button').length).toBe(100);
    expect(hiddenOnPhones(host).length).toBe(100 - 3 + 1);
    expect(host.textContent).toContain('499 songs');

    act(() => [...host.querySelectorAll('button')].find((b) => b.textContent.includes('whole queue')).click());
    expect(hiddenOnPhones(host).length).toBe(0);
    expect(host.querySelector('ol').className).toContain('max-lg:overflow-y-auto');
  });

  it('needs no toggle for a short queue', () => {
    const host = render(3);
    expect(host.textContent).not.toContain('whole queue');
    expect(host.textContent).toContain('2 songs');
  });

  it('says when the queue ends', () => {
    expect(render(1).textContent).toContain('The queue ends after this track.');
  });
});
