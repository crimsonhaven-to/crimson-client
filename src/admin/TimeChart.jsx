// A time series chart, hand rolled in SVG.
//
// No charting library on purpose. The whole Metrics tab exists to answer "is the
// haven healthy", and pulling ~200KB of recharts/chart.js into the bundle to draw
// what amounts to a polyline and three gridlines would cost every visitor of the
// site for a page only the keepers ever open. Same reasoning that keeps the
// Prometheus parser hand written in promParse.js.
//
// The maths lives in ./chartFormat so it can be tested without a DOM; this file
// is the renderer. It draws into a normalised 0..100 box stretched to fit with
// preserveAspectRatio="none", so it needs no measurement of its own container
// and no ResizeObserver. Strokes carry vector-effect="non-scaling-stroke", which
// is what stops that stretch from making vertical lines fatter than horizontal
// ones.
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  alignSeries, axisTicks, colorFor, domainOf, formatTime, formatTimestamp,
  formatValue, nearestIndex, stackRows, toAreaPath, toLinePath,
} from './chartFormat';

// Where the value at 0..100 in chart space sits as a CSS percentage from the top.
const topPct = (value, domain) => {
  const span = domain.max - domain.min;
  if (!(span > 0)) return 100;
  return 100 - ((value - domain.min) / span) * 100;
};

const leftPct = (index, columns) => (columns <= 1 ? 50 : (index / (columns - 1)) * 100);

// The last sample a series actually has, which is what the legend shows when
// nothing is hovered. Skips trailing nulls: Prometheus' most recent step is often
// still empty, and reading "n/a" off an otherwise healthy line is alarming.
const latestOf = (values) => {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] != null) return values[i];
  }
  return null;
};

export default function TimeChart({ series, unit, stacked, start, end, step }) {
  const plotRef = useRef(null);
  const [hover, setHover] = useState(null);

  const { times, rows } = useMemo(
    () => alignSeries(series, { start, end, step }),
    [series, start, end, step],
  );
  const domain = useMemo(() => domainOf(rows, { unit, stacked }), [rows, unit, stacked]);
  const bands = useMemo(() => (stacked ? stackRows(rows) : []), [stacked, rows]);

  const columns = times.length;

  const onMove = useCallback((event) => {
    const box = plotRef.current?.getBoundingClientRect();
    // jsdom (and a container mid-layout) reports zero width; guard rather than
    // dividing by it and parking the crosshair at NaN.
    if (!box || !box.width) return;
    setHover(nearestIndex((event.clientX - box.left) / box.width, columns));
  }, [columns]);

  const clearHover = useCallback(() => setHover(null), []);

  if (!rows.length || !columns) {
    return (
      <div className="h-40 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.25em] text-crimson-700">
        Nothing recorded in this window
      </div>
    );
  }

  const ticks = axisTicks(domain);
  const span = (end || 0) - (start || 0);
  const hoveredAt = hover != null ? times[hover] : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Axis labels are HTML rather than <text>, so they stay crisp and level
            no matter how far the SVG next to them is stretched. */}
        <div className="w-14 shrink-0 h-40 flex flex-col justify-between items-end py-0 text-[9px] font-black tabular-nums text-crimson-700">
          {ticks.map((t, i) => <span key={i}>{formatValue(unit, t)}</span>)}
        </div>

        <div
          ref={plotRef}
          onPointerMove={onMove}
          onPointerLeave={clearHover}
          className="relative flex-grow h-40 rounded-xl bg-crimson-950/40 border border-crimson-900/50 overflow-hidden cursor-crosshair"
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {[0, 50, 100].map((y) => (
              <line
                key={y} x1="0" x2="100" y1={y} y2={y}
                stroke="currentColor" className="text-crimson-900/60"
                strokeWidth="1" vectorEffect="non-scaling-stroke"
              />
            ))}

            {stacked
              ? bands.map((band, i) => (
                <path
                  key={band.label}
                  d={toAreaPath(band.top, band.base, domain)}
                  fill={colorFor(i)}
                  fillOpacity="0.45"
                  stroke="none"
                />
              ))
              : rows.map((row, i) => (
                <path
                  key={row.label}
                  d={toLinePath(row.values, domain)}
                  fill="none"
                  stroke={colorFor(i)}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </svg>

          {hover != null && (
            <>
              <div
                className="absolute top-0 bottom-0 w-px bg-crimson-300/40 pointer-events-none"
                style={{ left: `${leftPct(hover, columns)}%` }}
              />
              {(stacked ? bands.map((b) => b.top[hover]) : rows.map((r) => r.values[hover]))
                .map((value, i) => (value == null ? null : (
                  <div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 ring-1 ring-black/40"
                    style={{
                      left: `${leftPct(hover, columns)}%`,
                      top: `${topPct(value, domain)}%`,
                      backgroundColor: colorFor(i),
                    }}
                  />
                )))}
            </>
          )}
        </div>
      </div>

      <div className="ml-16 flex justify-between text-[9px] font-black tabular-nums text-crimson-700">
        <span>{formatTime(times[0], span)}</span>
        {columns > 2 && <span>{formatTime(times[Math.floor(columns / 2)], span)}</span>}
        <span>{formatTime(times[columns - 1], span)}</span>
      </div>

      <div className="ml-16 flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {rows.map((row, i) => {
          const value = hover != null ? row.values[hover] : latestOf(row.values);
          return (
            <div key={row.label} className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorFor(i) }} />
              <span className="text-[10px] font-bold text-crimson-400 truncate max-w-[11rem]" title={row.label}>{row.label}</span>
              <span className="text-[10px] font-black tabular-nums text-crimson-100 shrink-0">
                {formatValue(unit, value)}
              </span>
            </div>
          );
        })}
        <span className="text-[9px] font-bold text-crimson-700 ml-auto tabular-nums">
          {/* Which instant the legend is quoting. Without it the numbers are just
              floating, and "latest" and "where my cursor is" look identical. */}
          {hoveredAt != null ? formatTimestamp(hoveredAt) : 'latest'}
        </span>
      </div>
    </div>
  );
}
