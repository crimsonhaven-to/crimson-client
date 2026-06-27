import { useLiteBackground } from './hooks';

// Animated crimson mesh-gradient backdrop.
//
// Pure CSS (styles live in index.css) — a few soft radial "blobs" drift across a
// dark crimson base using compositor-only transforms, so it stays smooth and cheap
// even behind HLS playback, and (being gradient-based) it never pixelates or
// stretches the way the old raster wallpaper did at odd viewports. The glow now
// lives in the gradients themselves (no mix-blend-mode) and only two of the four
// blobs animate — both deliberate to keep it off the GPU's expensive paths.
//
// Honors prefers-reduced-motion: the drift freezes but the gradient still shows.
// The opt-in "Lite background" device preference (see useLiteBackground) goes
// further — `is-lite` drops the motion, blur and layer promotion entirely for a
// fully static gradient, for weak GPUs / battery saving. Purely decorative, so
// it's hidden from assistive tech.
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
