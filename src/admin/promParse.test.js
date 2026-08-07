import { describe, it, expect } from 'vitest';

import {
  parseMetrics, parseValue, samplesOf, sumOf, valueOf, infoLabel, groupSum,
  histogramQuantile, histogramMean, histogramCount, outcomeRatio,
} from './promParse';

// The fixture is trimmed from a REAL /metrics response off the backend, so the
// awkward bits are the genuine ones rather than invented: the `_created` twin
// prometheus_client emits alongside every counter, "+Inf" as a bucket bound,
// scientific notation, and a route-template label full of braces.
const SAMPLE = `# HELP crimson_http_requests_total HTTP requests completed, by route template, method and status class.
# TYPE crimson_http_requests_total counter
crimson_http_requests_total{method="GET",route="/watch/{tmdb_id}/{season_number}/{episode_number}",status="200"} 40.0
crimson_http_requests_total{method="GET",route="/health",status="200"} 120.0
crimson_http_requests_total{method="GET",route="__unmatched__",status="404"} 7.0
crimson_http_requests_total{method="POST",route="/account/progress",status="500"} 3.0
# HELP crimson_http_requests_created HTTP requests completed, by route template, method and status class.
# TYPE crimson_http_requests_created gauge
crimson_http_requests_created{method="GET",route="/health",status="200"} 1.7860921864795718e+09

# HELP crimson_watch_first_stream_seconds Seconds from /watch fan-out start until the FIRST playable stream is emitted.
# TYPE crimson_watch_first_stream_seconds histogram
crimson_watch_first_stream_seconds_bucket{le="1.0",media_type="tv"} 0.0
crimson_watch_first_stream_seconds_bucket{le="2.0",media_type="tv"} 5.0
crimson_watch_first_stream_seconds_bucket{le="4.0",media_type="tv"} 10.0
crimson_watch_first_stream_seconds_bucket{le="+Inf",media_type="tv"} 10.0
crimson_watch_first_stream_seconds_count{media_type="tv"} 10.0
crimson_watch_first_stream_seconds_sum{media_type="tv"} 25.0

# HELP crimson_resolve_total Embed resolve attempts by source and outcome.
# TYPE crimson_resolve_total counter
crimson_resolve_total{outcome="ok",source="Local Media"} 90.0
crimson_resolve_total{outcome="error",source="Local Media"} 10.0
crimson_resolve_total{outcome="error",source="Jellyfin"} 4.0

# HELP crimson_build_info Always 1; the labels carry the running version.
# TYPE crimson_build_info gauge
crimson_build_info{version="18.1.6"} 1.0
# HELP crimson_cache_worker_queue_depth Remux jobs queued in this replica's cache worker.
# TYPE crimson_cache_worker_queue_depth gauge
crimson_cache_worker_queue_depth 3.0
`;

const parsed = parseMetrics(SAMPLE);

describe('parseMetrics', () => {
  it('keeps a counter and its _created twin as separate names', () => {
    // The trap this guards: _created holds a unix timestamp, not a count. Folding
    // it into the counter would add ~1.8 billion to every total on the dashboard.
    expect(sumOf(parsed, 'crimson_http_requests_total')).toBe(170);
    expect(samplesOf(parsed, 'crimson_http_requests_created')).toHaveLength(1);
  });

  it('parses labels whose values contain braces', () => {
    // Route templates are the reason the label scanner uses lastIndexOf('}').
    const row = samplesOf(parsed, 'crimson_http_requests_total').find(
      (s) => s.labels.route.startsWith('/watch'),
    );
    expect(row.labels.route).toBe('/watch/{tmdb_id}/{season_number}/{episode_number}');
    expect(row.value).toBe(40);
  });

  it('reads TYPE and HELP metadata', () => {
    expect(parsed.meta.get('crimson_http_requests_total').type).toBe('counter');
    expect(parsed.meta.get('crimson_build_info').help).toContain('running version');
  });

  it('handles an unlabelled sample', () => {
    expect(valueOf(parsed, 'crimson_cache_worker_queue_depth')).toBe(3);
  });

  it('survives junk without losing the good lines', () => {
    const messy = parseMetrics(
      'not a metric line {{{\ngood_metric 1.0\n# TYPE\nalso_good{a="b"} 2.0\nbad_metric NOTANUMBER\n',
    );
    expect(valueOf(messy, 'good_metric')).toBe(1);
    expect(valueOf(messy, 'also_good')).toBe(2);
    expect(samplesOf(messy, 'bad_metric')).toHaveLength(0);
  });

  it('returns empty structures for empty or missing input', () => {
    for (const input of ['', null, undefined]) {
      expect(parseMetrics(input).samples.size).toBe(0);
    }
    expect(samplesOf(parsed, 'nope_not_here')).toEqual([]);
    expect(valueOf(parsed, 'nope_not_here')).toBeNull();
    expect(sumOf(parsed, 'nope_not_here')).toBe(0);
  });

  it('unescapes quotes and backslashes in label values', () => {
    const p = parseMetrics('m{name="a \\"quoted\\" \\\\ thing"} 1.0\n');
    expect(samplesOf(p, 'm')[0].labels.name).toBe('a "quoted" \\ thing');
  });
});

describe('parseValue', () => {
  it('keeps the infinities that bound histogram buckets', () => {
    expect(parseValue('+Inf')).toBe(Infinity);
    expect(parseValue('-Inf')).toBe(-Infinity);
    expect(parseValue('1.7860921864795718e+09')).toBeCloseTo(1786092186.47, 1);
  });
});

describe('groupSum', () => {
  it('folds a labelled counter into biggest-first rows', () => {
    expect(groupSum(parsed, 'crimson_resolve_total', 'source')).toEqual([
      { key: 'Local Media', value: 100 },
      { key: 'Jellyfin', value: 4 },
    ]);
  });

  it('narrows by a label filter', () => {
    expect(groupSum(parsed, 'crimson_resolve_total', 'source', { outcome: 'error' })).toEqual([
      { key: 'Local Media', value: 10 },
      { key: 'Jellyfin', value: 4 },
    ]);
  });
});

describe('histogramQuantile', () => {
  const tv = { media_type: 'tv' };

  it('interpolates inside the bucket the quantile lands in', () => {
    // p50 of 10 observations = the 5th, which is exactly the top of the le=2 bucket.
    expect(histogramQuantile(parsed, 'crimson_watch_first_stream_seconds', 0.5, tv)).toBeCloseTo(2, 5);
    // p75 = the 7.5th observation. The le=4 bucket holds observations 6..10, so
    // 7.5 is half way through it: 2 + 0.5 * (4 - 2).
    expect(histogramQuantile(parsed, 'crimson_watch_first_stream_seconds', 0.75, tv)).toBeCloseTo(3, 5);
  });

  it('reports Infinity rather than inventing a number beyond the top bucket', () => {
    // Every observation sits inside a finite bucket here, so nothing lands in +Inf.
    // Build one that does: the count exceeds the last finite bucket.
    const p = parseMetrics(
      'h_bucket{le="1.0"} 1.0\nh_bucket{le="+Inf"} 10.0\nh_count 10.0\nh_sum 500.0\n',
    );
    expect(histogramQuantile(p, 'h', 0.9)).toBe(Infinity);
  });

  it('returns null for a histogram nobody has observed yet', () => {
    const p = parseMetrics('h_bucket{le="1.0"} 0.0\nh_bucket{le="+Inf"} 0.0\n');
    expect(histogramQuantile(p, 'h', 0.5)).toBeNull();
    expect(histogramQuantile(parsed, 'no_such_histogram', 0.5)).toBeNull();
  });
});

describe('histogram summaries', () => {
  it('computes the mean from _sum over _count', () => {
    expect(histogramMean(parsed, 'crimson_watch_first_stream_seconds', { media_type: 'tv' })).toBe(2.5);
    expect(histogramCount(parsed, 'crimson_watch_first_stream_seconds')).toBe(10);
  });

  it('returns null rather than dividing by zero', () => {
    expect(histogramMean(parsed, 'no_such_histogram')).toBeNull();
  });
});

describe('outcomeRatio', () => {
  it('scores a source by its good outcomes', () => {
    expect(outcomeRatio(parsed, 'crimson_resolve_total', 'source', 'Local Media', ['ok'])).toBe(0.9);
    expect(outcomeRatio(parsed, 'crimson_resolve_total', 'source', 'Jellyfin', ['ok'])).toBe(0);
  });

  it('distinguishes "never tried" from "failed every time"', () => {
    // 0 and null must not render the same way: one is a dead source, the other is
    // a source nobody has asked for yet.
    expect(outcomeRatio(parsed, 'crimson_resolve_total', 'source', 'Nonexistent', ['ok'])).toBeNull();
  });
});

describe('infoLabel', () => {
  it('pulls the version off the build info metric', () => {
    expect(infoLabel(parsed, 'crimson_build_info', 'version')).toBe('18.1.6');
    expect(infoLabel(parsed, 'crimson_build_info', 'nope')).toBeNull();
    expect(infoLabel(parsed, 'no_such_metric', 'version')).toBeNull();
  });
});
