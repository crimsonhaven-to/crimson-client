import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // vendor/ is crimson-sources, linted in its own repository.
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
      // Best-effort try/catch blocks that ignore the error are common here.
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      // React Compiler advisories: correct code that is not compiler-optimal
      // should not block a deploy.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Crimson 600 and 700 as text measure under 4.5:1 on the crimson surfaces.
      // The boundary is a character class because selector regexes cannot escape.
      'no-restricted-syntax': ['error', ...['Literal', 'TemplateElement'].map((node) => ({
        selector: `${node}[value${node === 'Literal' ? '' : '.raw'}=/(^|[^:a-z-])text-crimson-(600|700)/]`,
        message: 'Text this dark is unreadable on crimson. Use text-crimson-400 for muted text.',
      }))],
    },
  },
])
