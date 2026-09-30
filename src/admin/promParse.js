// Samples are keyed by their exact name: prometheus_client emits a `_created` twin per
// counter holding a birth timestamp, and histogram _bucket/_sum/_count siblings must
// stay individually addressable.

const NAME_RE = /^[a-zA-Z_:][a-zA-Z0-9_:]*/;
// Operator-named sources and client-supplied telemetry names may contain escaped
// quotes, so the value group skips over `\"` instead of stopping at the first quote.
const LABEL_RE = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;

const unescapeLabel = (v) =>
  v.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));

// "+Inf" bounds every histogram's last bucket and must not collapse to NaN.
export const parseValue = (raw) => {
  if (raw === '+Inf') return Infinity;
  if (raw === '-Inf') return -Infinity;
  return Number(raw);
};

// Returns { samples: name -> [{ labels, value }], meta: family -> { type, help } }.
// Malformed lines are skipped, not thrown: one bad line should cost that line, not
// the whole tab.
export function parseMetrics(text) {
  const samples = new Map();
  const meta = new Map();

  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line[0] === '#') {
      const m = /^#\s+(HELP|TYPE)\s+(\S+)\s*(.*)$/.exec(line);
      if (!m) continue;
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
      // Route template label values contain "}".
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

    const value = parseValue(rest.trim().split(/\s+/)[0]);
    if (Number.isNaN(value)) continue;

    const list = samples.get(name);
    if (list) list.push({ labels, value });
    else samples.set(name, [{ labels, value }]);
  }

  return { samples, meta };
}

// Every lookup tolerates a missing metric: DB pool gauges vanish when the pool is
// closed, process_* is Linux only, so "absent" is a normal state, not an error.

const matches = (labels, filter) =>
  Object.keys(filter).every((k) => labels[k] === filter[k]);

export const samplesOf = (parsed, name, filter) => {
  const list = parsed?.samples?.get(name) || [];
  return filter ? list.filter((s) => matches(s.labels, filter)) : list;
};

export const sumOf = (parsed, name, filter) =>
  samplesOf(parsed, name, filter).reduce((acc, s) => acc + s.value, 0);

export const valueOf = (parsed, name, filter) => {
  const list = samplesOf(parsed, name, filter);
  return list.length ? list[0].value : null;
};

/** For 1-valued info metrics such as crimson_build_info{version}. */
export const infoLabel = (parsed, name, label) => {
  const list = samplesOf(parsed, name);
  return list.length ? (list[0].labels[label] ?? null) : null;
};

/** Returns [{ key, value }] summed by `label`, biggest first. */
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

// Same linear interpolation as Prometheus's histogram_quantile(). Null when there are
// no observations; Infinity when the quantile lands in the +Inf bucket, where
// interpolating would invent a number.
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

export function histogramMean(parsed, base, filter) {
  const count = sumOf(parsed, `${base}_count`, filter);
  if (!count) return null;
  return sumOf(parsed, `${base}_sum`, filter) / count;
}

export const histogramCount = (parsed, base, filter) =>
  sumOf(parsed, `${base}_count`, filter);

// Null when there were no attempts, so "never tried" differs from "always failed".
export function outcomeRatio(parsed, name, keyLabel, key, goodOutcomes) {
  const rows = samplesOf(parsed, name, { [keyLabel]: key });
  const total = rows.reduce((a, s) => a + s.value, 0);
  if (!total) return null;
  const good = rows
    .filter((s) => goodOutcomes.includes(s.labels.outcome))
    .reduce((a, s) => a + s.value, 0);
  return good / total;
}
