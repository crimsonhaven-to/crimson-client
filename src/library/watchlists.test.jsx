import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { useWatchlists } from './watchlists';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiFetch = vi.fn();
vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal()),
  apiFetch: (...a) => apiFetch(...a),
  useSessionToken: () => 'token',
}));

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

async function mountHook() {
  let hook;
  function Probe() {
    hook = useWatchlists();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => { root.render(<Probe />); });
  return hook;
}

describe('importWatchlists', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (path) => {
      if (path.startsWith('/account/favorites/import')) {
        return jsonResponse(400, { success: false, error: 'Unrecognised CSV header', status_code: 400 });
      }
      return jsonResponse(200, {});
    });
  });

  // The backend's exception handler answers with {error}, not FastAPI's {detail}.
  it('surfaces the server error message', async () => {
    const hook = await mountHook();
    const file = { name: 'lists.csv', text: async () => 'bad' };
    let result;
    await act(async () => { result = await hook.importWatchlists(file); });
    expect(result).toEqual({ ok: false, error: 'Unrecognised CSV header' });
  });
});
