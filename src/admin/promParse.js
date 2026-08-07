// Prometheus text-exposition parser plus the handful of aggregation helpers the
// Metrics tab needs. A plain .js module (no components) so it stays unit-testable
// and Vite fast-refresh stays happy, exactly like ./format.
//
// This is Phase 0 of the metrics story: the dashboard reads the backend's
// /metrics endpoint directly, with the admin bearer it already holds, so there is
// no Prometheus server in the picture yet. The consequence is that everything here
// reports CURRENT VALUES ONLY, with no history and no rates over time. Phase 1
// puts a real scrape behind an /admin/metrics proxy and adds the time axis; this
// parser keeps its job either way.
//
// The format is documented at https://prometheus.io/docs/instrumenting/exposition_formats/
// and looks like this (a counter family, verbatim from our own backend):
//
//   # HELP crimson_http_requests_total HTTP requests completed, by route ...
//   # TYPE crimson_http_requests_total counter
//   crimson_http_requests_total{method="GET",route="/health",status="200"} 3.0
//   crimson_http_requests_created{method="GET",route="/health",status="200"} 1.78e+09
//
// Note the `_created` twin: prometheus_client emits one per counter, holding the
// unix timestamp the series was born at rather than anything countable. We key
// samples by their EXACT name so those never get mistaken for data, and so a
// histogram's _bucket / _sum / _count siblings stay individually addressable.

const NAME_RE = /^[a-zA-Z_:][a-zA-Z0-9_:]*/;
// Label values may contain escaped quotes and backslashes, so the value group has
// to skip over `\"` rather than stopping at the first quote it sees. Our own
// route labels ("/watch/{tmdb_id}/...") are tame, but an operator-named local
// source or a client-supplied telemetry source name need not be.
const LABEL_RE = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;

const unescapeLabel = (v) =>
  v.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));

// "+Inf" is the upper bound of every histogram's last bucket, so it has to survive
// as a real Infinity rather than collapsing to NaN.
export const parseValue = (raw) => {
  if (raw === '+Inf') return Infinity;
  if (raw === '-Inf') return -Infinity;
  return Number(raw);
};

/**
 * Parse a Prometheus text exposition into { samples, meta }.
 *
 * `samples` maps an exact sample name to its list of { labels, value }.
 * `meta` maps a declared family name to its { type, help }.
 *
 * Unparseable lines are skipped rather than thrown on: this renders a dashboard,
 * and one malformed line from a future exporter should cost that line, not the
 * whole tab.
 */
export function parseMetrics(text) {
  const samples = new Map();
  const meta = new Map();

  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line[0] === '#') {
      const m = /^#\s+(HELP|TYPE)\s+(\S+)\s*(.*)$/.exec(line);
      if (!m) continue; // a plain comment, not metadata
      const entry = meta.get(m[2]) || { type: 'untyped', help: '' };
      if (m[1] === 'TYPE') entry.type = m[3].trim();
      else entry.help = m[3].trim();
      meta.set(m[2], entry);
      continue;
    }

    const nameMatch = NAME_RE.exec(line);
    if (!nameMatch) continue;
    const name = nameMatch[0];
    let rest = line.slice(name.length);

    const labels = {};
    if (rest[0] === '{') {
      // lastIndexOf, not indexOf: a label VALUE may legitimately contain "}"
      // (our route templates are full of them).
      const close = rest.lastIndexOf('}');
      if (close === -1) continue;
      const labelPart = rest.slice(1, close);
      LABEL_RE.lastIndex = 0;
      let lm;
      while ((lm = LABEL_RE.exec(labelPart)) !== null) {
        labels[lm[1]] = unescapeLabel(lm[2]);
      }
      rest = rest.slice(close + 1);
    }

    // Trailing field is an optional millisecond timestamp we have no use for.
    const value = parseValue(rest.trim().split(/\s+/)[0]);
    if (Number.isNaN(value)) continue;

    const list = samples.get(name);
    if (list) list.push({ labels, value });
    else samples.set(name, [{ labels, value }]);
  }

  return { samples, meta };
}

// --- lookups ---------------------------------------------------------------
// Every one of these tolerates a missing metric. Half of what the backend can
// export is conditional (the DB pool gauges vanish when the pool is closed,
// process_* only exists on Linux, crimson_schema_version only once migrations
// have run), so "absent" is a normal state the tab has to render, not an error.

const matches = (labels, filter) =>
  Object.keys(filter).every((k) => labels[k] === filter[k]);

export const samplesOf = (parsed, name, filter) => {
  const list = parsed?.samples?.get(name) || [];
  return filter ? list.filter((s) => matches(s.labels, filter)) : list;
};

/** Total across every series of a metric, optionally narrowed by labels. */
export const sumOf = (parsed, name, filter) =>
  samplesOf(parsed, name, filter).reduce((acc, s) => acc + s.value, 0);

/** A single unlabelled (or uniquely matching) value, or null when absent. */
export const valueOf = (parsed, name, filter) => {
  const list = samplesOf(parsed, name, filter);
  return list.length ? list[0].value : null;
};

/** The label attached to a 1-valued info metric, e.g. crimson_build_info{version}. */
export const infoLabel = (parsed, name, label) => {
  const list = samplesOf(parsed, name);
  return list.length ? (list[0].labels[label] ?? null) : null;
};

/**
 * Fold a metric into [{ key, value }] summed by one label, biggest first.
 * This is what turns crimson_resolve_total{source,outcome} into a per-source row.
 */
export function groupSum(parsed, name, label, filter) {
  const totals = new Map();
  for (const s of samplesOf(parsed, name, filter)) {
    const key = s.labels[label];
    if (key === undefined) continue;
    totals.set(key, (totals.get(key) || 0) + s.value);
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Estimate a quantile from a histogram's cumulative buckets, the same linear
 * interpolation Prometheus's own histogram_quantile() uses.
 *
 * Returns null when the histogram has no observations, and Infinity when the
 * quantile lands in the open-ended +Inf bucket (i.e. it is genuinely larger than
 * the biggest bound we defined, and interpolation would be a lie). Callers render
 * that as "off the scale" rather than inventing a number.
 */
export function histogramQuantile(parsed, base, q, filter) {
  const buckets = samplesOf(parsed, `${base}_bucket`, filter)
    .map((s) => ({ le: parseValue(s.labels.le), count: s.value }))
    .sort((a, b) => a.le - b.le);
  if (!buckets.length) return null;

  const total = buckets[buckets.length - 1].count;
  if (!total) return null;

  const target = q * total;
  let prevLe = 0;
  let prevCount = 0;
  for (const b of buckets) {
    if (b.count >= target) {
      if (!Number.isFinite(b.le)) return Infinity;
      const span = b.count - prevCount;
      if (span <= 0) return b.le;
      return prevLe + ((target - prevCount) / span) * (b.le - prevLe);
    }
    if (Number.isFinite(b.le)) prevLe = b.le;
    prevCount = b.count;
  }
  return null;
}

/** Mean observation of a histogram (_sum / _count), or null when unobserved. */
export function histogramMean(parsed, base, filter) {
  const count = sumOf(parsed, `${base}_count`, filter);
  if (!count) return null;
  return sumOf(parsed, `${base}_sum`, filter) / count;
}

/** Observation count of a histogram across the matching series. */
export const histogramCount = (parsed, base, filter) =>
  sumOf(parsed, `${base}_count`, filter);

/**
 * Success ratio from a two-outcome counter, e.g.
 * crimson_resolve_total{source,outcome} with outcome ok|empty|error.
 * Returns null when the source has no attempts at all, so the UI can distinguish
 * "never tried" from "tried and failed every time".
 */
export function outcomeRatio(parsed, name, keyLabel, key, goodOutcomes) {
  const rows = samplesOf(parsed, name, { [keyLabel]: key });
  const total = rows.reduce((a, s) => a + s.value, 0);
  if (!total) return null;
  const good = rows
    .filter((s) => goodOutcomes.includes(s.labels.outcome))
    .reduce((a, s) => a + s.value, 0);
  return good / total;
}
