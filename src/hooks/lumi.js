// Lumi chat client: availability probe plus the NDJSON reply stream.
//
// The backend streams chat over NDJSON on a POST rather than SSE, because
// EventSource cannot send an Authorization header or a request body. That is the
// same transport /watch already uses, so this is the ndjson.js reader adapted to
// a POST and a typed line protocol.
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch, extractError } from './apiClient';

// Line types the backend emits, one JSON object per line:
//   start  { conversation_id }        once, first
//   delta  { text }                   incremental reply text
//   action { action }                 a UI affordance, currently a play link
//   done   { actions }                terminal, success
//   error  { message }                terminal, already phrased for the viewer
export async function streamChat({ message, conversationId }, { signal, onLine }) {
  const res = await apiFetch('/chat', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify({ message, conversation_id: conversationId ?? null }),
  });

  // Failures before the stream opens are ordinary JSON error bodies (403 for a
  // missing grant, 429 for the budget or rate limit). Once the body starts, the
  // backend can no longer change the status code, so everything after this point
  // arrives as an `error` line instead.
  if (!res.ok || !res.body) {
    let detail = 'Lumi is not answering.';
    try {
      detail = extractError(await res.json(), detail);
    } catch { /* non-JSON body; keep the default */ }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim()) onLine(JSON.parse(line));
    }
  }
  if (buffer.trim()) onLine(JSON.parse(buffer));
}

// Whether this viewer may chat at all. Answers flags rather than a 403 so the
// drawer can decide not to render without treating it as an error.
export function useLumiStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    apiFetch('/chat/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (alive) setStatus(s); })
      .catch(() => { if (alive) setStatus({ available: false }); });
    return () => { alive = false; };
  }, []);
  return status;
}

// One conversation's worth of state. Messages are {role, content, actions}; the
// in-flight assistant reply is the last entry and grows as deltas arrive.
export function useLumiChat() {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const conversationId = useRef(null);
  const abortRef = useRef(null);

  // Abort any in-flight reply when the drawer unmounts, so a closed panel does
  // not keep a stream (and a paid-for generation) running.
  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    conversationId.current = null;
    setMessages([]);
    setBusy(false);
  }, []);

  const send = useCallback(async (text) => {
    const message = text.trim();
    if (!message || busy) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message },
      { role: 'assistant', content: '', actions: [], pending: true },
    ]);

    // Mutating the last message on every delta would re-render the whole list
    // per token; updating only the tail entry keeps that to one row.
    const patchLast = (patch) =>
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        next[next.length - 1] = typeof patch === 'function' ? patch(last) : { ...last, ...patch };
        return next;
      });

    try {
      await streamChat(
        { message, conversationId: conversationId.current },
        {
          signal: controller.signal,
          onLine: (line) => {
            if (line.type === 'start') {
              conversationId.current = line.conversation_id;
            } else if (line.type === 'delta') {
              patchLast((last) => ({ ...last, content: last.content + line.text }));
            } else if (line.type === 'action') {
              patchLast((last) => ({ ...last, actions: [...(last.actions || []), line.action] }));
            } else if (line.type === 'done') {
              patchLast({ pending: false });
            } else if (line.type === 'error') {
              patchLast({ pending: false, error: true, content: line.message });
            }
          },
        },
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        patchLast({ pending: false, error: true, content: err.message });
      }
    } finally {
      patchLast({ pending: false });
      setBusy(false);
      abortRef.current = null;
    }
  }, [busy]);

  return { messages, busy, send, reset };
}
