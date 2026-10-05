// Downloads go to Cache Storage in a browser, which may evict them when space
// runs low. The desktop app keeps them as real files instead. Both sit behind
// the small part of the Cache API the music and video stores use, with the
// same keys, so the stores do not care which one they get.
const native = () => globalThis.CrimsonNative?.media;

export const supported = () => Boolean(native()) || typeof caches !== 'undefined';

export const openCache = (name) => (native() ? fileCache(native(), name) : caches.open(name));

export const deleteCache = (name) => (native() ? native().clear(name) : caches.delete(name));

// Stored files are served on this origin, so a film can play straight from
// disk instead of through a blob.
export const servesFiles = () => Boolean(native());

// { usage, quota } in bytes, or null when the browser does not say.
export async function estimate() {
  if (native()) {
    const { used, free } = await native().usage();
    return { usage: used, quota: used + free };
  }
  return (await navigator.storage?.estimate?.()) ?? null;
}

// One IPC round trip per network chunk would be thousands per film.
const BATCH_BYTES = 1 << 20;

function quotaError(err) {
  if (!/ENOSPC/.test(String(err?.message))) return err;
  return new DOMException('Not enough space on the download drive.', 'QuotaExceededError');
}

async function writeBody(media, id, body) {
  if (!body) return;
  const reader = body.getReader();
  let parts = [];
  let size = 0;
  const flush = async () => {
    if (!size) return;
    const chunk = new Uint8Array(size);
    let at = 0;
    for (const part of parts) {
      chunk.set(part, at);
      at += part.byteLength;
    }
    parts = [];
    size = 0;
    await media.append(id, chunk);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.byteLength;
    if (size >= BATCH_BYTES) await flush();
  }
  await flush();
}

function fileCache(media, name) {
  return {
    async put(key, response) {
      const id = await media.begin(name, key);
      try {
        await writeBody(media, id, response.body);
        await media.finish(id);
      } catch (err) {
        await media.abort(id).catch(() => {});
        throw quotaError(err);
      }
    },
    // The app serves stored files on this origin, with Range support, so the
    // response streams from disk like a Cache Storage match does.
    async match(key) {
      const res = await fetch(`${key}?cache=${encodeURIComponent(name)}`);
      return res.ok ? res : undefined;
    },
    async keys() {
      return (await media.keys(name)).map((key) => new Request(new URL(key, window.location.href)));
    },
    async delete(key) {
      await media.remove(name, key);
      return true;
    },
  };
}
