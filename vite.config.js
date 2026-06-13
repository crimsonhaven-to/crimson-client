import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // `__EXTENSION__` flips the app into its fully-local "no backend" mode. The web
  // build is the hosted app, so it stays false; the extension build
  // (vite.config.extension.js) defines it true. Defined here too so the guarded
  // branches in src/hooks.js / src/App.jsx compile (and dead-eliminate) cleanly.
  define: { __EXTENSION__: 'false' },
  plugins: [
    react(),
    tailwindcss(),
  ],
})