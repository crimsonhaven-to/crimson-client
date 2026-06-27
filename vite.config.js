import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
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