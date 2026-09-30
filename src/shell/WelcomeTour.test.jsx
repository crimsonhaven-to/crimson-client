import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import WelcomeTour from './WelcomeTour';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let publicConfig = {};
let lumiStatus = null;
vi.mock('../api/client', () => ({ usePublicConfig: () => publicConfig }));
vi.mock('../lumi/hooks', () => ({ useLumiStatus: () => lumiStatus }));
vi.mock('../account/theme', () => ({ useThemedAsset: () => '/lumi.png' }));

let root;
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

function titles({ musicEnabled = false } = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(<MemoryRouter><WelcomeTour musicEnabled={musicEnabled} onClose={() => {}} /></MemoryRouter>);
  });
  const dots = host.querySelectorAll('button[aria-label^="Go to step"]');
  const seen = [];
  for (const dot of dots) {
    act(() => dot.click());
    seen.push(host.querySelector('h2').textContent);
  }
  return seen;
}

describe('WelcomeTour', () => {
  it('leaves out the steps for features this viewer does not have', () => {
    publicConfig = {};
    lumiStatus = { available: false };
    const seen = titles();
    expect(seen).not.toContain('A Song for the Dark');
    expect(seen).not.toContain('Whisper to Me');
    expect(seen[0]).toBe('Welcome to the Haven');
    expect(seen.at(-1)).toBe('The Night Is Yours');
  });

  it('introduces music and the Lumi chat when both are live', () => {
    publicConfig = { live_tv_enabled: true, local_library_enabled: true };
    lumiStatus = { available: true };
    const seen = titles({ musicEnabled: true });
    expect(seen).toContain('A Song for the Dark');
    expect(seen).toContain('Whisper to Me');
    expect(seen).toHaveLength(11);
  });
});
