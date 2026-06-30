import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// crimson-sources is vendored as a private git submodule (vendor/crimson-sources)
// and consumed as raw TypeScript — Vite/esbuild transpiles it inline, so there's
// no separate build step, and `COPY . .` bakes it into the Docker build context.
//
// SAFEGUARD: when that submodule is ABSENT (building without access to the private
// sources repo, or a fork that has none), fall back to the built-in no-op stub
// (src/sourcesStub.js) so the build still succeeds — the site simply runs with no
// client-side sources and plays via the backend only. Never a build failure.
const realSources = fileURLToPath(
  new URL('./vendor/crimson-sources/src/index.ts', import.meta.url),
)
const stubSources = fileURLToPath(new URL('./src/sourcesStub.js', import.meta.url))
const hasRealSources = existsSync(realSources)
// Surfaced in the build log so it's obvious which engine got bundled.
console.info(
  hasRealSources
    ? '[crimson-sources] private sources engine found — bundling it.'
    : '[crimson-sources] no vendor/crimson-sources — bundling the no-op stub (backend-only playback).',
)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      'crimson-sources': hasRealSources ? realSources : stubSources,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code into its own long-lived chunks so a
        // routine app-code deploy doesn't bust the whole bundle in viewers' caches
        // (our /assets/ carry an immutable 1-year cache header). The crypto stack
        // is additionally loaded on demand (see loadCrypto in hooks.js), so this
        // chunk only downloads when a viewer actually signs in.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }
          if (/[\\/](@noble|@scure)[\\/]/.test(id)) {
            return 'crypto-vendor';
          }
          return undefined;
        },
      },
    },
  },
})