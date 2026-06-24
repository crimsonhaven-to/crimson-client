// Animated crimson mesh-gradient backdrop.
//
// Pure CSS (styles live in index.css) — a few heavily-blurred radial "blobs"
// drift across a dark crimson base using compositor-only transforms, so it stays
// smooth and cheap even behind HLS playback, and (being gradient-based) it never
// pixelates or stretches the way the old raster wallpaper did at odd viewports.
//
// Honors prefers-reduced-motion: the drift freezes but the gradient still shows.
// Purely decorative, so it's hidden from assistive tech.
export default function MeshBackground() {
  return (
    <div className="mesh-bg" aria-hidden="true">
      <span className="mesh-blob mesh-blob-1" />
      <span className="mesh-blob mesh-blob-2" />
      <span className="mesh-blob mesh-blob-3" />
      <span className="mesh-blob mesh-blob-4" />
      <div className="mesh-vignette" />
    </div>
  );
}
