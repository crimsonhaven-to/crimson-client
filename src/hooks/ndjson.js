// Reads one /watch NDJSON stream, invoking onLine for each JSON line. Shared by
// the show + movie streamers (the anime streamer keeps its own inline copy
// unchanged). Lifted verbatim from hooks.js.
import { apiFetch } from './apiClient';

export async function streamWatchNdjson(path, { signal, onLine }) {
  const res = await apiFetch(path, { signal, headers: { Accept: 'application/x-ndjson' } });
  if (!res.ok || !res.body) throw new Error('Could not resolve streaming sources.');
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
      onLine(line);
    }
  }
  if (buffer.trim()) onLine(buffer); // trailing, non-newline-terminated line
}
