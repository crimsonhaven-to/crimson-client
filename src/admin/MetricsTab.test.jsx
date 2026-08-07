// Mounts the REAL MetricsTab against a REAL /metrics payload (trimmed from an
// actual backend response) and asserts the numbers it derives, so a change to
// either the parser or a metric name on the backend surfaces here rather than as
// a blank panel in the Admin sanctum.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import MetricsTab from './MetricsTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const metrics = vi.fn();
vi.mock('../adminApi', () => ({ adminApi: { metrics: (...a) => metrics(...a) } }));

const PAYLOAD = `# HELP crimson_http_requests_total HTTP requests completed.
# TYPE crimson_http_requests_total counter
crimson_http_requests_total{method="GET",route="/watch/{tmdb_id}/{season_number}/{episode_number}",status="200"} 40.0
crimson_http_requests_total{method="GET",route="/health",status="200"} 120.0
crimson_http_requests_total{method="POST",route="/account/progress",status="500"} 3.0
crimson_http_requests_created{method="GET",route="/health",status="200"} 1.7860921864795718e+09
# TYPE crimson_http_requests_in_progress gauge
crimson_http_requests_in_progress{method="GET"} 2.0
# TYPE crimson_http_request_duration_seconds histogram
crimson_http_request_duration_seconds_bucket{le="0.5",route="/health"} 120.0
crimson_http_request_duration_seconds_bucket{le="+Inf",route="/health"} 120.0
# TYPE crimson_watch_requests_total counter
crimson_watch_requests_total{media_type="tv",outcome="streams"} 8.0
crimson_watch_requests_total{media_type="tv",outcome="empty"} 2.0
# TYPE crimson_watch_streams_total counter
crimson_watch_streams_total{media_type="tv"} 30.0
# TYPE crimson_watch_first_stream_seconds histogram
crimson_watch_first_stream_seconds_bucket{le="1.0",media_type="tv"} 0.0
crimson_watch_first_stream_seconds_bucket{le="2.0",media_type="tv"} 4.0
crimson_watch_first_stream_seconds_bucket{le="4.0",media_type="tv"} 8.0
crimson_watch_first_stream_seconds_bucket{le="+Inf",media_type="tv"} 8.0
crimson_watch_first_stream_seconds_count{media_type="tv"} 8.0
crimson_watch_first_stream_seconds_sum{media_type="tv"} 18.0
# TYPE crimson_resolve_total counter
crimson_resolve_total{outcome="ok",source="Local Media"} 90.0
crimson_resolve_total{outcome="error",source="Local Media"} 10.0
# TYPE crimson_scraper_runs_total counter
crimson_scraper_runs_total{outcome="embeds",scraper="LocalScraper"} 12.0
# TYPE crimson_response_cache_total counter
crimson_response_cache_total{result="hit",tier="l1"} 75.0
crimson_response_cache_total{result="miss",tier="l1"} 25.0
# TYPE crimson_db_pool_in_use gauge
crimson_db_pool_in_use 3.0
crimson_db_pool_max_size 12.0
crimson_cache_worker_queue_depth 4.0
crimson_source_success_ratio{source="Local"} 0.9
crimson_source_resolve_events_total{outcome="ok",source="Local"} 90.0
crimson_build_info{version="18.1.6"} 1.0
`;

let container;
let root;

async function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<MetricsTab notify={() => {}} />);
  });
  return container.textContent;
}

beforeEach(() => {
  metrics.mockReset();
  if (root) { act(() => root.unmount()); root = null; }
  document.body.innerHTML = '';
});

describe('MetricsTab', () => {
  it('derives the headline numbers from a real payload', async () => {
    metrics.mockResolvedValue({ ok: true, text: PAYLOAD });
    const text = await mount();

    // 40 + 120 + 3 = 163. If the counter's _created twin (a ~1.78e9 unix
    // timestamp) ever leaked into the sum, this is what would catch it.
    expect(text).toContain('163');
    expect(text).toContain('3 failed');   // the one 500
    expect(text).toContain('10');         // watch fan-outs, 8 + 2
    expect(text).toContain('3.0 streams each'); // 30 streams over 10 fan-outs
    expect(text).toContain('2.00 s');      // p50 first stream, top of the le=2 bucket
  });

  it('renders the route table using the templated label', async () => {
    metrics.mockResolvedValue({ ok: true, text: PAYLOAD });
    const text = await mount();
    // The route label must arrive whole, braces and all, which is the parser's
    // lastIndexOf('}') behaviour showing through end to end.
    expect(text).toContain('/watch/{tmdb_id}/{season_number}/{episode_number}');
  });

  it('shows per-source ratios and the client beacon aggregate', async () => {
    metrics.mockResolvedValue({ ok: true, text: PAYLOAD });
    const text = await mount();
    expect(text).toContain('Local Media');
    expect(text).toContain('90.0%');          // 90 ok / 100 attempts
    expect(text).toContain('100 attempts');
    expect(text).toContain('75.0%');          // L1 cache hit ratio
    expect(text).toContain('no lookups');     // L2 was never consulted, which is not 0%
  });

  it('always carries the one-replica caveat', async () => {
    // The numbers are easy to misread without it, so it is not optional chrome.
    metrics.mockResolvedValue({ ok: true, text: PAYLOAD });
    const text = await mount();
    expect(text).toContain('Live snapshot, one replica');
  });

  it('explains a build with no prometheus-client instead of rendering zeroes', async () => {
    metrics.mockResolvedValue({ ok: false, unavailable: true });
    const text = await mount();
    expect(text).toContain('No ledgers kept');
    expect(text).toContain('prometheus-client');
    expect(text).not.toContain('Requests served');
  });

  it('renders absent optional metrics as n/a rather than 0', async () => {
    // process_* only exists on Linux, and the schema gauges only once migrations
    // have run. Reporting a missing gauge as 0 would look like a real reading.
    metrics.mockResolvedValue({ ok: true, text: PAYLOAD });
    const text = await mount();
    expect(text).toContain('Resident memory');
    expect(text).toContain('n/a');
  });

  it('survives a metrics endpoint that returns nothing useful', async () => {
    metrics.mockResolvedValue({ ok: true, text: '' });
    const text = await mount();
    expect(text).toContain('No requests recorded on this replica yet.');
  });
});
