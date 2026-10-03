// An hls.js loader that reads an offline copy from Cache Storage. Playing through
// the service worker would also work, but it is missing in dev and after a hard
// reload, and this needs neither.
import { read } from './videoStore';

function newStats() {
  return {
    aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 1, bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };
}

export default class CacheLoader {
  constructor(config) {
    this.config = config;
    this.stats = newStats();
    this.context = null;
    this.aborted = false;
  }

  destroy() {
    this.aborted = true;
  }

  abort() {
    this.aborted = true;
    this.stats.aborted = true;
  }

  getCacheAge() {
    return null;
  }

  getResponseHeader() {
    return null;
  }

  load(context, _config, callbacks) {
    this.context = context;
    const { stats } = this;
    stats.loading.start = performance.now();
    const path = new URL(context.url, window.location.href).pathname;
    read(path)
      .then(async (res) => {
        if (this.aborted) return;
        if (!res) {
          callbacks.onError({ code: 404, text: 'Missing from this device' }, context, null, stats);
          return;
        }
        const data = context.responseType === 'arraybuffer' ? await res.arrayBuffer() : await res.text();
        if (this.aborted) return;
        stats.loading.first = Math.max(stats.loading.start, performance.now());
        stats.loaded = data.byteLength ?? data.length;
        stats.total = stats.loaded;
        stats.loading.end = Math.max(stats.loading.first, performance.now());
        callbacks.onSuccess({ url: context.url, data, code: 200 }, stats, context, null);
      })
      .catch((err) => {
        if (!this.aborted) callbacks.onError({ code: 0, text: String(err?.message || err) }, context, null, stats);
      });
  }
}
