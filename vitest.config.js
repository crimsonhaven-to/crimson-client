// Vitest config, kept SEPARATE from vite.config.js on purpose: the Docker image
// builds with `vite build` (which loads vite.config.js only), so importing from
// 'vitest/config' here never touches the production build — and vite.config.js can
// keep importing from 'vite' without pulling vitest into the image.
//
// We merge the real vite config so tests resolve modules exactly like the app does
// (the crimson-sources alias, the React plugin), then layer the test settings on top.
import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // jsdom gives the pure hooks/helpers a localStorage + window to run against
      // (getPlaybackPrefs, the event broadcasts, …) without a real browser.
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{js,jsx}'],
    },
  }),
)
