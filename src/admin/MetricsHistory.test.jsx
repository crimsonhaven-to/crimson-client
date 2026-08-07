// Mounts the REAL history section (and through it the real TimeChart) against
// payloads shaped exactly like the backend's /admin/metrics/* responses, so a
// change to either side surfaces here rather than as an empty card in the sanctum.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import MetricsHistory from './MetricsHistory';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const metricsPanels = vi.fn();
const metricsSeries = vi.fn();
const metricsTargets = vi.fn();
vi.mock('../adminApi', () => ({
  adminApi: {
    metricsPanels: (...a) => metricsPanels(...a),
    metricsSeries: (...a) => metricsSeries(...a),
    metricsTargets: (...a) => metricsTargets(...a),
  },
}));

const PANELS = {
  success: true,
  available: true,
  job: 'crimson-api',
  retention: '45d',
  default_range: '6h',
  ranges: [
    { id: '1h', label: 'Last hour', seconds: 3600, step: 15 },
    { id: '6h', label: 'Last 6 hours', seconds: 21600, step: 60 },
    { id: '30d', label: 'Last month', seconds: 2592000, step: 7200 },
  ],
  panels: [
    { id: 'http_rate', title: 'Requests per second', group: 'Traffic', unit: 'rps', description: 'By status.', stacked: true },
    { id: 'http_latency', title: 'Time to response headers', group: 'Traffic', unit: 'seconds', description: 'Not last byte.', stacked: false },
    { id: 'resolve_success', title: 'Resolver success rate', group: 'Sources', unit: 'ratio', description: 'Per source.', stacked: false },
  ],
};

const SERIES = {
  ok: true,
  panel: PANELS.panels[0],
  range: PANELS.ranges[1],
  start: 1000,
  end: 1180,
  step: 60,
  truncated: 0,
  series: [
    { label: '200', points: [[1000, 12], [1060, 14], [1120, 13], [1180, 15]] },
    // Deliberately sparse: Prometheus emits nothing for a step where a labelled
    // series had no samples, and this is what proves the alignment is by
    // timestamp rather than by array position.
    { label: '500', points: [[1120, 2]] },
  ],
};

let container;
let root;

async function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<MetricsHistory notify={() => {}} />);
  });
  // Two flushes: the catalogue fetch, then the series batch it triggers.
  await act(async () => {});
  await act(async () => {});
  return container;
}

const text = () => container.textContent;
const paths = () => [...container.querySelectorAll('svg path')];

beforeEach(() => {
  metricsPanels.mockReset();
  metricsSeries.mockReset();
  metricsTargets.mockReset();
  metricsTargets.mockResolvedValue({ ok: true, up: 3, down: 0, targets: [] });
  metricsSeries.mockResolvedValue(SERIES);
  if (root) { act(() => root.unmount()); root = null; }
  document.body.innerHTML = '';
});

describe('MetricsHistory', () => {
  it('draws the first group of panels for the default range', async () => {
    metricsPanels.mockResolvedValue(PANELS);
    await mount();

    // Only the Traffic group is fetched. Loading all twenty panels at once would
    // fire twenty query_range calls at Prometheus to fill one screen.
    expect(metricsSeries.mock.calls.map((c) => c[0])).toEqual(['http_rate', 'http_latency']);
    expect(metricsSeries.mock.calls.every((c) => c[1] === '6h')).toBe(true);

    expect(text()).toContain('Requests per second');
    expect(text()).not.toContain('Resolver success rate');
    expect(paths().length).toBeGreaterThan(0);
  });

  it('switching group fetches that group instead', async () => {
    metricsPanels.mockResolvedValue(PANELS);
    await mount();
    metricsSeries.mockClear();

    const sources = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Sources');
    await act(async () => { sources.click(); });
    await act(async () => {});

    expect(metricsSeries.mock.calls.map((c) => c[0])).toEqual(['resolve_success']);
    expect(text()).toContain('Resolver success rate');
  });

  it('switching range refetches the same panels over the new window', async () => {
    metricsPanels.mockResolvedValue(PANELS);
    await mount();
    metricsSeries.mockClear();

    const hour = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Last hour');
    await act(async () => { hour.click(); });
    await act(async () => {});

    expect(metricsSeries.mock.calls.map((c) => c[1])).toEqual(['1h', '1h']);
  });

  it('plots a sparse series against the shared time grid', async () => {
    metricsPanels.mockResolvedValue(PANELS);
    await mount();

    // The "500" line has one sample at t=1120, which is column 2 of 4 (x = 66.67
    // in the normalised box). If it were zipped by index it would land at column
    // 0, and the whole series would be reported an hour earlier than it happened.
    const drawn = paths().map((p) => p.getAttribute('d')).join(' ');
    expect(drawn).toContain('66.67');
    expect(drawn).not.toContain('NaN');
  });

  it('shows the value at the end of each line in the legend', async () => {
    metricsPanels.mockResolvedValue(PANELS);
    await mount();
    // Last sample of the 200 line is 15 requests per second.
    expect(text()).toContain('15/s');
    expect(text()).toContain('latest');
  });

  it('reports a panel that failed instead of drawing an empty chart', async () => {
    metricsPanels.mockResolvedValue(PANELS);
    metricsSeries.mockResolvedValue({
      ok: false, panel: PANELS.panels[0], error: 'connection refused', series: [],
    });
    await mount();

    expect(text()).toContain('could not answer');
    expect(text()).toContain('connection refused');
  });

  it('says so when a window has nothing in it', async () => {
    metricsPanels.mockResolvedValue(PANELS);
    metricsSeries.mockResolvedValue({ ...SERIES, series: [] });
    await mount();
    expect(text()).toContain('Nothing recorded in this window');
  });

  it('names the replicas the scraper cannot reach', async () => {
    // An empty chart because nothing happened and an empty chart because the
    // scraper lost the fleet look identical without this.
    metricsPanels.mockResolvedValue(PANELS);
    metricsTargets.mockResolvedValue({
      ok: true, up: 2, down: 1,
      targets: [
        { instance: '10.0.1.9:8000', health: 'up', last_error: null },
        { instance: '10.0.1.3:8000', health: 'down', last_error: 'server returned HTTP status 401 Unauthorized' },
      ],
    });
    await mount();

    expect(text()).toContain('Scraping 2 replicas, 1 unreachable');
    expect(text()).toContain('10.0.1.3:8000');
    expect(text()).toContain('401 Unauthorized');
  });

  it('warns when the chosen range outlives the archive', async () => {
    metricsPanels.mockResolvedValue({ ...PANELS, retention: '7d', default_range: '30d' });
    await mount();
    expect(text()).toContain('Keeps 7d');
    expect(text()).toContain('longer than the archive keeps');
  });

  it('does not warn when the archive comfortably covers the range', async () => {
    metricsPanels.mockResolvedValue(PANELS);
    await mount();
    expect(text()).not.toContain('longer than the archive keeps');
  });

  it('explains a deploy with no Prometheus instead of showing broken charts', async () => {
    metricsPanels.mockResolvedValue({
      success: true, available: false,
      reason: 'PROMETHEUS_URL is not set, so no history is being collected',
      panels: [], ranges: [],
    });
    await mount();

    expect(text()).toContain('No history is being kept');
    expect(text()).toContain('PROMETHEUS_URL');
    // Nothing to draw, so nothing must be requested.
    expect(metricsSeries).not.toHaveBeenCalled();
    expect(metricsTargets).not.toHaveBeenCalled();
  });

  it('survives the history endpoints being unreachable', async () => {
    metricsPanels.mockRejectedValue(new Error('network down'));
    await mount();
    expect(text()).toContain('could not be reached');
    expect(text()).toContain('live snapshot below is unaffected');
  });
});
