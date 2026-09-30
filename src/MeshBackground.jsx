import { useLiteBackground } from './hooks/liteBackground';

// Styles and the performance reasoning live in index.css (.mesh-bg).
export default function MeshBackground() {
  const lite = useLiteBackground();
  return (
    <div className={`mesh-bg${lite ? ' is-lite' : ''}`} aria-hidden="true">
      <span className="mesh-blob mesh-blob-1" />
      <span className="mesh-blob mesh-blob-2" />
      <span className="mesh-blob mesh-blob-3" />
      <span className="mesh-blob mesh-blob-4" />
      <div className="mesh-vignette" />
    </div>
  );
}
