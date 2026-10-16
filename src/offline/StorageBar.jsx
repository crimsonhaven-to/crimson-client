import { formatBytes } from '../formatBytes';

function Legend({ swatch, label, bytes }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${swatch}`} />
      <dt>{label}</dt>
      <dd className="text-crimson-100 tabular-nums">{formatBytes(bytes)}</dd>
    </div>
  );
}

// The estimate counts everything the app keeps on the device, downloads
// included, so the rest of it is shown as its own share.
export default function StorageBar({ estimate, downloads }) {
  if (!estimate?.quota) return null;
  const other = Math.max(0, estimate.usage - downloads);
  const free = Math.max(0, estimate.quota - estimate.usage);
  const width = (bytes) => `${Math.min(100, (bytes / estimate.quota) * 100)}%`;

  return (
    <div className="space-y-3 p-5 rounded-3xl bg-crimson-950/40 border border-crimson-900/40">
      <div className="flex h-2.5 rounded-full bg-crimson-900/60 overflow-hidden"
        role="img" aria-label={`${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)} used`}>
        <span className="h-full bg-crimson-500" style={{ width: width(downloads) }} />
        <span className="h-full bg-crimson-200/70" style={{ width: width(other) }} />
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-bold text-crimson-400">
        <Legend swatch="bg-crimson-500" label="Downloads" bytes={downloads} />
        <Legend swatch="bg-crimson-200/70" label="Other app data" bytes={other} />
        <Legend swatch="bg-crimson-900" label="Free" bytes={free} />
      </dl>
    </div>
  );
}
