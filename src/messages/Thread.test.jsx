import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  messages: vi.fn(),
  send: vi.fn(),
  markRead: vi.fn(),
}));
vi.mock('./api', () => ({ messagesApi: api }));
vi.mock('./unread', () => ({ refreshUnread: vi.fn() }));

const { default: Thread } = await import('./Thread');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const room = { id: 10, kind: 'group', name: 'Gang', members: [{ handle: 'ray' }, { handle: 'ami' }] };
const msg = (id, extra = {}) => ({
  id, body: `m${id}`, attachment: null, created_at: '2026-11-20T10:00:00Z', mine: false,
  sender: { handle: 'ami', username: null }, ...extra,
});

let root;
let host;
let onRead;
let onSent;

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(
    <MemoryRouter>
      <Thread room={room} me="ray" onRead={onRead} onSent={onSent} onOpenSettings={() => {}} />
    </MemoryRouter>,
  ));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  onRead = vi.fn();
  onSent = vi.fn();
  api.markRead.mockResolvedValue({});
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.clearAllMocks();
});

const bodies = () => [...host.querySelectorAll('li p.whitespace-pre-wrap')].map((p) => p.textContent);

describe('Thread', () => {
  it('loads the newest page and marks it read', async () => {
    api.messages.mockResolvedValue([msg(1), msg(2)]);
    await render();
    expect(api.messages).toHaveBeenCalledWith(10, { limit: 50 });
    expect(bodies()).toEqual(['m1', 'm2']);
    expect(api.markRead).toHaveBeenCalledWith(10, 2);
    expect(onRead).toHaveBeenCalledWith(10);
  });

  it('names the sender in a group once per run of their messages', async () => {
    api.messages.mockResolvedValue([msg(1), msg(2), msg(3, { mine: true, sender: { handle: 'ray' } })]);
    await render();
    const names = [...host.querySelectorAll('li p.text-\\[10px\\].font-black')].map((p) => p.textContent);
    expect(names).toEqual(['@ami']);
  });

  it('polls for messages after the newest one and skips repeats', async () => {
    api.messages.mockResolvedValueOnce([msg(1)]);
    await render();
    api.messages.mockResolvedValueOnce([msg(1), msg(2)]);
    await act(async () => vi.advanceTimersByTime(4000));
    expect(api.messages).toHaveBeenLastCalledWith(10, { after: 1 });
    expect(bodies()).toEqual(['m1', 'm2']);
  });

  it('sends a message and shows it', async () => {
    api.messages.mockResolvedValue([]);
    api.send.mockResolvedValue(msg(5, { body: 'hello', mine: true, sender: { handle: 'ray' } }));
    await render();
    const input = host.querySelector('input');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '  hello ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(api.send).toHaveBeenCalledWith(10, 'hello');
    expect(bodies()).toEqual(['hello']);
    expect(input.value).toBe('');
    expect(onSent).toHaveBeenCalled();
  });

  it('offers older messages only when a full page came back', async () => {
    api.messages.mockResolvedValue(Array.from({ length: 50 }, (_, i) => msg(i + 1)));
    await render();
    expect(host.textContent).toContain('Earlier messages');
  });
});
