import { describe, it, expect } from 'vitest';

import {
  alignSeries, axisTicks, colorFor, domainOf, formatValue, nearestIndex,
  niceCeil, parseDuration, stackRows, toAreaPath, toLinePath,
} from './chartFormat';

describe('alignSeries', () => {
  // The trap this exists for: Prometheus emits NO sample for a step where a
  // labelled series had nothing, so a "500" line genuinely has fewer points than
  // the "200" line beside it. Zipping them by array index would slide one of them
  // sideways in time and quietly misattribute every spike.
  const grid = { start: 1000, end: 1060, step: 15 }; // 5 columns

  it('places samples by timestamp, not by position', () => {
    const { times, rows } = alignSeries(
      [{ label: 'sparse', points: [[1030, 7]] }],
      grid,
    );
    expect(times).toEqual([1000, 1015, 1030, 1045, 1060]);
    expect(rows[0].values).toEqual([null, null, 7, null, null]);
  });

  it('keeps two series of different lengths on the same axis', () => {
    const { rows } = alignSeries([
      { label: 'dense', points: [[1000, 1], [1015, 2], [1030, 3], [1045, 4], [1060, 5]] },
      { label: 'sparse', points: [[1045, 9]] },
    ], grid);
    expect(rows[0].values).toHaveLength(5);
    expect(rows[1].values).toEqual([null, null, null, 9, null]);
  });

  it('drops samples outside the grid rather than wrapping them in', () => {
    const { rows } = alignSeries([{ label: 'x', points: [[500, 1], [9999, 2]] }], grid);
    expect(rows[0].values).toEqual([null, null, null, null, null]);
  });

  it('treats a null value as a gap', () => {
    const { rows } = alignSeries([{ label: 'x', points: [[1000, null], [1015, 3]] }], grid);
    expect(rows[0].values).toEqual([null, 3, null, null, null]);
  });

  it('returns empty structures for junk input', () => {
    expect(alignSeries(null, grid).rows).toEqual([]);
    expect(alignSeries([], { start: 0, end: 0, step: 0 }).times).toEqual([]);
  });
});

describe('domainOf', () => {
  const rows = (...sets) => sets.map((values, i) => ({ label: `s${i}`, values }));

  it('pins ratios to 0..1 instead of autoscaling', () => {
    // A success rate wobbling between 97% and 99% stretched to fill the box reads
    // as a catastrophe. Showing it pressed against the top is the whole point.
    expect(domainOf(rows([0.97, 0.99]), { unit: 'ratio' })).toEqual({ min: 0, max: 1 });
  });

  it('rounds the peak up to a readable ceiling', () => {
    expect(domainOf(rows([0.37, 0.12]), { unit: 'rps' })).toEqual({ min: 0, max: 0.4 });
    expect(domainOf(rows([1340]), { unit: 'count' })).toEqual({ min: 0, max: 1500 });
  });

  it('measures the stacked total, not the tallest single series', () => {
    const plain = domainOf(rows([3, 3], [4, 4]), { unit: 'rps' });
    const stacked = domainOf(rows([3, 3], [4, 4]), { unit: 'rps', stacked: true });
    expect(plain.max).toBe(4);
    expect(stacked.max).toBe(7.5);
  });

  it('survives a chart with nothing in it', () => {
    expect(domainOf([], { unit: 'rps' })).toEqual({ min: 0, max: 1 });
    expect(domainOf(rows([null, null]), { unit: 'rps' })).toEqual({ min: 0, max: 1 });
  });
});

describe('niceCeil', () => {
  it('never returns zero, so nothing ever divides by the span', () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(NaN)).toBe(1);
  });

  it('leaves a value that is already round alone', () => {
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(2.5)).toBe(2.5);
  });
});

describe('axisTicks', () => {
  it('reads top to bottom, matching the order they are drawn in', () => {
    expect(axisTicks({ min: 0, max: 10 })).toEqual([10, 5, 0]);
  });
});

describe('stackRows', () => {
  it('accumulates each band on top of the last', () => {
    const out = stackRows([
      { label: 'a', values: [1, 2] },
      { label: 'b', values: [3, 4] },
    ]);
    expect(out[0]).toMatchObject({ base: [0, 0], top: [1, 2] });
    expect(out[1]).toMatchObject({ base: [1, 2], top: [4, 6] });
  });

  it('counts a null as a real zero', () => {
    // In a stacked RATE panel a missing sample means "this outcome did not occur",
    // which is zero. Leaving a hole would tear the band apart for no reason.
    const out = stackRows([
      { label: 'a', values: [null, 2] },
      { label: 'b', values: [5, null] },
    ]);
    expect(out[0].top).toEqual([0, 2]);
    expect(out[1].top).toEqual([5, 2]);
  });
});

describe('toLinePath', () => {
  const domain = { min: 0, max: 10 };

  it('maps values into the normalised box, inverted so up is more', () => {
    expect(toLinePath([0, 5, 10], domain)).toBe('M0,100L50,50L100,0');
  });

  it('breaks the line at a gap rather than bridging it', () => {
    // Bridging invents data across an outage, and on a latency chart that is
    // exactly the interval you opened the chart to look at. Both survivors here
    // are stranded, so each becomes its own dot (see the isolated case below).
    expect(toLinePath([10, null, 10], domain)).toBe('M0,0L0,0M100,0L100,0');
    expect(toLinePath([10, 10, null, 10], domain)).toBe('M0,0L33.33,0M100,0L100,0');
  });

  it('emits a zero-length segment for an isolated sample so a dot renders', () => {
    // A lone M with no L draws literally nothing, so a single surviving sample in
    // a sea of gaps would silently vanish from the chart.
    expect(toLinePath([null, 5, null], domain)).toBe('M50,50L50,50');
  });

  it('returns an empty path when there is nothing to draw', () => {
    expect(toLinePath([null, null], domain)).toBe('');
    expect(toLinePath([], domain)).toBe('');
  });

  it('does not divide by a zero span', () => {
    expect(toLinePath([5, 5], { min: 5, max: 5 })).not.toContain('NaN');
  });
});

describe('toAreaPath', () => {
  it('closes the band by walking the base back the other way', () => {
    const d = toAreaPath([10, 10], [0, 0], { min: 0, max: 10 });
    expect(d.startsWith('M0,0L100,0')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toContain('NaN');
  });

  it('falls to the floor when no base is given', () => {
    expect(toAreaPath([5], null, { min: 0, max: 10 })).toBe('M50,50L50,100Z');
  });
});

describe('nearestIndex', () => {
  it('snaps a pointer fraction to a column', () => {
    expect(nearestIndex(0, 5)).toBe(0);
    expect(nearestIndex(0.5, 5)).toBe(2);
    expect(nearestIndex(1, 5)).toBe(4);
  });

  it('clamps rather than running off either end', () => {
    expect(nearestIndex(-3, 5)).toBe(0);
    expect(nearestIndex(9, 5)).toBe(4);
  });

  it('gives up on a container nothing has laid out yet', () => {
    expect(nearestIndex(NaN, 5)).toBeNull();
    expect(nearestIndex(0.5, 0)).toBeNull();
  });
});

describe('formatValue', () => {
  it('reads each unit the way that unit is read', () => {
    expect(formatValue('ratio', 0.9)).toBe('90%');
    expect(formatValue('ratio', 0.045)).toBe('4.5%');
    expect(formatValue('seconds', 0.25)).toBe('250 ms');
    expect(formatValue('seconds', 2.5)).toBe('2.50 s');
    expect(formatValue('bytes', 1536)).toBe('1.5 KB');
    expect(formatValue('rps', 12.5)).toBe('12.5/s');
    // Grouped by the viewer's locale, exactly like fmtInt in MetricsTab. Asserted
    // against toLocaleString rather than a literal "1,200": this machine renders
    // that as 1'200, and hard-coding either one breaks on the other's CI runner.
    expect(formatValue('count', 1200)).toBe((1200).toLocaleString());
  });

  it('keeps small rates distinguishable instead of rounding them all to 0', () => {
    expect(formatValue('rps', 0.02)).toBe('0.02/s');
    expect(formatValue('rps', 0.004)).toBe('0.004/s');
  });

  it('keeps a decimal through 10..100, where request rates actually live', () => {
    expect(formatValue('rps', 42.4)).toBe('42.4/s');
    // ...but a whole number of connections should not read as "12.0".
    expect(formatValue('count', 12)).toBe('12');
  });

  it('says n/a for a gap rather than drawing a zero', () => {
    expect(formatValue('rps', null)).toBe('n/a');
    expect(formatValue('rps', Infinity)).toBe('n/a');
    expect(formatValue('rps', NaN)).toBe('n/a');
  });
});

describe('parseDuration', () => {
  it('reads the retention flag Prometheus reports', () => {
    expect(parseDuration('45d')).toBe(45 * 86400);
    expect(parseDuration('6h')).toBe(21600);
    expect(parseDuration('1w2d')).toBe(9 * 86400);
  });

  it('returns null for anything it cannot read', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration('forever')).toBeNull();
  });
});

describe('colorFor', () => {
  it('wraps rather than running off the end of the palette', () => {
    expect(colorFor(0)).toBe(colorFor(8));
    expect(typeof colorFor(99)).toBe('string');
  });
});
