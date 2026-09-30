import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// crimson-sources is a private submodule. Without access to it the build bundles
// the no-op stub instead and plays through the backend only, so a fork or the demo
// still builds.
const realSources = fileURLToPath(
  new URL('./vendor/crimson-sources/src/index.ts', import.meta.url),
)
const stubSources = fileURLToPath(new URL('./src/sourcesStub.js', import.meta.url))
const hasRealSources = existsSync(realSources)
console.info(
  hasRealSources
    ? '[crimson-sources] private sources engine found, bundling it.'
    : '[crimson-sources] no vendor/crimson-sources, bundling the no-op stub (backend-only playback).',
)

// Social scrapers do not run JS, so the Open Graph URLs in index.html have to be
// absolute in the served HTML, which means baking them in per environment.
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
        // Assets are cached for a year, so vendor code that rarely changes gets its
        // own chunks and survives app deploys in viewers' caches.
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