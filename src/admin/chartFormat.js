/*
 * Geometry and formatting for the Admin › Metrics history charts.
 *
 * Pure functions only, no JSX: the chart's maths is the part that is worth
 * pinning down with tests, and it is far easier to assert a path string than to
 * dig one out of a mounted SVG. TimeChart.jsx is then a thin renderer over these.
 *
 * The chart draws in a normalised 0..100 by 0..100 box and is stretched to fit
 * its container with preserveAspectRatio="none", which is why nothing here knows
 * about pixels. Strokes are kept honest at render time with
 * vector-effect="non-scaling-stroke"; without it the horizontal stretch would
 * make vertical lines fatter than horizontal ones.
 */

// Distinct enough to tell apart at 1.5px, and starting with the house crimson so
// a single-series panel looks like it belongs to the rest of the dashboard.
export const SERIES_COLORS = [
  '#ff003c', // crimson-500
  '#38bdf8', // sky-400
  '#fbbf24', // amber-400
  '#4ade80', // green-400
  '#c084fc', // purple-400
  '#fb923c', // orange-400
  '#2dd4bf', // teal-400
  '#f472b6', // pink-400
];

export const colorFor = (index) => SERIES_COLORS[index % SERIES_COLORS.length];

// ---------- formatting ----------

export const formatBytes = (n) => {
  if (n == null || !Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

// Enough precision to distinguish 0.02 from 0.05 requests per second without
// printing 0.0200000001 anywhere.
const formatNumber = (v) => {
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  if (abs < 0.01) return v.toFixed(3);
  if (abs < 1) return v.toFixed(2);
  if (abs < 10) return v.toFixed(1);
  // 10..100 is exactly where request rates and connection counts live, so keep a
  // decimal there rather than rounding 12.5/s to 13/s. Trailing .0 is dropped so
  // a whole number of database connections does not read as "12.0".
  if (abs < 100) return v.toFixed(1).replace(/\.0$/, '');
  if (abs < 10000) return Math.round(v).toLocaleString();
  if (abs < 1e6) return `${(v / 1000).toFixed(1)}k`;
  return `${(v / 1e6).toFixed(1)}M`;
};

export const formatSeconds = (v) => {
  if (v < 1) return `${Math.round(v * 1000)} ms`;
  if (v < 60) return `${v.toFixed(v < 10 ? 2 : 1)} s`;
  return `${Math.floor(v / 60)}m ${Math.round(v % 60)}s`;
};

/** One sample, formatted the way its panel's unit wants to be read. */
export const formatValue = (unit, v) => {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  switch (unit) {
    case 'ratio': {
      const pct = v * 100;
      return `${pct > 0 && pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
    }
    case 'seconds': return formatSeconds(v);
    case 'bytes': return formatBytes(v);
    case 'rps': return `${formatNumber(v)}/s`;
    default: return formatNumber(v);
  }
};

/**
 * An x-axis label. Which half of the clock a point falls in matters on an hour
 * range and is noise on a month range, so the format follows the span.
 */
export const formatTime = (unixSeconds, spanSeconds) => {
  const d = new Date(unixSeconds * 1000);
  if (spanSeconds <= 86400) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (spanSeconds <= 604800) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Prometheus reports its retention as its own flag string ("45d", "15d", "6h").
// The tab compares it against the selected range so a month-long view of a
// fortnight-long database says so instead of silently drawing half a chart.
const DURATION_UNITS = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 };

export const parseDuration = (text) => {
  if (typeof text !== 'string') return null;
  const parts = text.trim().toLowerCase().match(/\d+[smhdwy]/g);
  if (!parts) return null;
  return parts.reduce((total, part) => total + parseInt(part, 10) * DURATION_UNITS[part.slice(-1)], 0);
};

export const formatTimestamp = (unixSeconds) =>
  new Date(unixSeconds * 1000).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

// ---------- domain ----------

/**
 * Round a peak up to a number a human would have picked for the top gridline.
 * 0.37 becomes 0.4, 1340 becomes 1500. An axis topping out at exactly the peak
 * puts the highest point on the frame, where it is hard to see.
 */
export const niceCeil = (v) => {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const exponent = Math.floor(Math.log10(v));
  const base = 10 ** exponent;
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5]) {
    if (v <= step * base * (1 + 1e-9)) return step * base;
  }
  return 10 * base;
};

/**
 * The y range to draw in.
 *
 * Ratios are pinned to 0..1 rather than scaled to their peak, deliberately: a
 * success rate wobbling between 97% and 99% autoscaled to fill the box looks
 * like a catastrophe, and the whole point of the panel is to show that it is
 * sitting near the top.
 */
export const domainOf = (rows, { unit, stacked } = {}) => {
  if (unit === 'ratio') return { min: 0, max: 1 };

  let peak = 0;
  if (stacked && rows.length) {
    const columns = rows[0].values.length;
    for (let i = 0; i < columns; i += 1) {
      let total = 0;
      for (const row of rows) total += row.values[i] ?? 0;
      if (total > peak) peak = total;
    }
  } else {
    for (const row of rows) {
      for (const v of row.values) {
        if (v != null && v > peak) peak = v;
      }
    }
  }
  return { min: 0, max: niceCeil(peak) };
};

/** Three gridline values, top first, matching how they are drawn. */
export const axisTicks = ({ min, max }) => [max, (max + min) / 2, min];

// ---------- shaping ----------

/**
 * Put every series on one shared time grid.
 *
 * Series do NOT arrive sharing a set of timestamps. `sum by (status) (rate(...))`
 * emits nothing at all for a status nobody hit during part of the window, so a
 * 500 line legitimately has fewer points than the 200 line next to it. Indexing
 * one against the other would slide the whole series sideways in time. The grid
 * is rebuilt from the start/end/step the backend reports and each sample is
 * placed by its own timestamp.
 */
export const alignSeries = (series, { start, end, step }) => {
  if (!Array.isArray(series) || !step || !Number.isFinite(start) || !Number.isFinite(end)) {
    return { times: [], rows: [] };
  }
  const columns = Math.max(1, Math.round((end - start) / step) + 1);
  const times = Array.from({ length: columns }, (_, i) => start + i * step);
  const rows = series.map((s) => {
    const values = new Array(columns).fill(null);
    for (const point of s.points || []) {
      const [ts, value] = point;
      if (value == null || !Number.isFinite(value)) continue;
      const i = Math.round((ts - start) / step);
      if (i >= 0 && i < columns) values[i] = value;
    }
    return { label: s.label, values };
  });
  return { times, rows };
};

/**
 * Cumulative tops for a stacked panel, plus the base each band sits on.
 *
 * A null in a stacked rate panel means "this outcome did not occur in this
 * step", which is a real zero rather than missing data, so it contributes 0 to
 * the stack instead of tearing a hole in it.
 */
export const stackRows = (rows) => {
  if (!rows.length) return [];
  const running = new Array(rows[0].values.length).fill(0);
  return rows.map((row) => {
    const base = [...running];
    const top = row.values.map((v, i) => {
      running[i] += v ?? 0;
      return running[i];
    });
    return { label: row.label, base, top };
  });
};

// ---------- paths ----------

const X = (i, n) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
const Y = (v, { min, max }) => {
  const span = max - min;
  if (!(span > 0)) return 100;
  return 100 - ((v - min) / span) * 100;
};

const round = (n) => Math.round(n * 100) / 100;

/**
 * A line, with nulls breaking it into separate subpaths rather than being
 * bridged. Bridging a gap invents data across an outage, which on a latency
 * chart is exactly the interval you were trying to look at.
 *
 * An isolated sample (nulls either side) is emitted as a zero-length segment so
 * a round linecap renders it as a dot; without that it would be invisible.
 */
export const toLinePath = (values, domain) => {
  const n = values.length;
  const parts = [];
  let open = false;
  for (let i = 0; i < n; i += 1) {
    const v = values[i];
    if (v == null) { open = false; continue; }
    const point = `${round(X(i, n))},${round(Y(v, domain))}`;
    if (!open) {
      const isolated = (i === 0 || values[i - 1] == null) && (i === n - 1 || values[i + 1] == null);
      parts.push(`M${point}${isolated ? `L${point}` : ''}`);
      open = true;
    } else {
      parts.push(`L${point}`);
    }
  }
  return parts.join('');
};

/**
 * A filled band between two boundaries (or between a line and the floor, when
 * `base` is omitted). Used for the stacked panels.
 */
export const toAreaPath = (top, base, domain) => {
  const n = top.length;
  if (!n) return '';
  const up = [];
  const down = [];
  for (let i = 0; i < n; i += 1) {
    const x = round(X(i, n));
    up.push(`${up.length ? 'L' : 'M'}${x},${round(Y(top[i] ?? 0, domain))}`);
    const j = n - 1 - i;
    down.push(`L${round(X(j, n))},${round(Y(base ? base[j] ?? 0 : domain.min, domain))}`);
  }
  return `${up.join('')}${down.join('')}Z`;
};

/**
 * Which column a pointer at `fraction` (0..1 across the plot) is nearest to.
 * Returns null for an empty chart or a container jsdom has not laid out.
 */
export const nearestIndex = (fraction, columns) => {
  if (!columns || columns < 1 || !Number.isFinite(fraction)) return null;
  if (columns === 1) return 0;
  const i = Math.round(fraction * (columns - 1));
  return Math.min(columns - 1, Math.max(0, i));
};
