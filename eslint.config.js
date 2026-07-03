import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dist` is build output; `vendor/` holds the crimson-sources git submodule,
  // a separate repo with its own toolchain and runtime globals — it's linted in
  // its own CI, not here.
  globalIgnores(['dist', 'vendor']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Unused caught errors are an intentional, common pattern here
      // (`try { … } catch (e) { /* best-effort */ }`); don't fail on them.
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      // The react-hooks v7 "recommended" set bundles the new react-compiler
      // advisories. They flag patterns that are perfectly correct (and already
      // shipping) but not compiler-optimal — valuable as guidance, NOT as a
      // deploy-blocking gate. Demote them to warnings so the gate stays focused
      // on real bugs (no-undef, no-unused-vars, rules-of-hooks). Revisit/clear
      // these incrementally (they pair well with the hooks.js split).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
])
