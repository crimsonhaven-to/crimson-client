import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
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

// The canonical origin the deployed site is served from — baked into index.html's
// Open Graph / Twitter tags (og:url, og:image, …) at BUILD time. Social scrapers
// (Discord, Twitter, Slack) don't run JS, so these URLs must be absolute and correct
// in the served HTML — a runtime rewrite would never be seen by them. The CI passes
// the per-environment origin (dev.crimsonhaven.to vs crimsonhaven.to) as VITE_SITE_URL,
// exactly like VITE_API_BASE_URL; a plain build falls back to production so it's still
// correct. Every `__SITE_URL__` token in index.html is replaced with this (no trailing
// slash, so the template controls the path that follows).
const SITE_URL = (process.env.VITE_SITE_URL || 'https://crimsonhaven.to').replace(/\/+$/, '')

const htmlSiteUrl = () => ({
  name: 'html-site-url',
  transformIndexHtml(html) {
    return html.replaceAll('__SITE_URL__', SITE_URL)
  },
})

// Hands public/sw.js this build's chunks to precache, and a build id so each
// deploy installs a new worker. Lazy pages then load offline even if they were
// never opened online, which is what lets downloaded music play with no signal.
const swPrecache = () => ({
  name: 'sw-precache',
  apply: 'build',
  writeBundle(options, bundle) {
    const assets = Object.keys(bundle)
      .filter((file) => file.startsWith('assets/') && /\.(js|css|woff2?)$/.test(file))
      .sort()
      .map((file) => `/${file}`)
    const buildId = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12)
    const swPath = join(options.dir, 'sw.js')
    const sw = readFileSync(swPath, 'utf8')
      .replace("const BUILD_ID = 'dev';", `const BUILD_ID = '${buildId}';`)
      .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(assets)};`)
    writeFileSync(swPath, sw)
  },
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    htmlSiteUrl(),
    swPrecache(),
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