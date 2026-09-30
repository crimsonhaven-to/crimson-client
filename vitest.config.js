// Separate from vite.config.js so the production build never imports vitest.
// Tests merge the real config to resolve modules exactly like the app does.
import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{js,jsx}'],
    },
  }),
)
