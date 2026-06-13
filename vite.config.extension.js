import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync } from 'fs'
import { resolve } from 'path'

// Build target for the Chromium (Manifest V3) extension. The same React source
// powers both the hosted web app and the extension; a build-time `__EXTENSION__`
// flag (defined here as true, false in vite.config.js) flips the app to its
// fully-local "no backend" mode (see src/local-backend, src/hooks.js).
//
// We deliberately avoid a heavyweight CRX bundler: the service worker is a tiny
// classic script and the declarativeNetRequest rules are static JSON, so the
// only build step is a normal Vite SPA build + copying a few static files in.
function copyExtensionStatic() {
  const root = __dirname
  const out = resolve(root, 'dist-extension')
  return {
    name: 'copy-extension-static',
    closeBundle() {
      // manifest.json, sw.js, rules/, player.html — the extension shell.
      cpSync(resolve(root, 'extension-static'), out, { recursive: true })
      // App icons + a couple of images the UI references, taken from public/
      // (publicDir is disabled below so we copy only what the extension needs,
      // not the PWA service worker / web manifest).
      cpSync(resolve(root, 'public/icons'), resolve(out, 'icons'), { recursive: true })
      for (const img of ['lumi_nobackground.png', 'lumi_404.png']) {
        cpSync(resolve(root, 'public', img), resolve(out, img))
      }
    },
  }
}

export default defineConfig({
  define: { __EXTENSION__: 'true' },
  // Relative asset URLs so everything resolves under chrome-extension://<id>/.
  base: './',
  publicDir: false,
  plugins: [react(), tailwindcss(), copyExtensionStatic()],
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.extension.html'),
    },
  },
})
