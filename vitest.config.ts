import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

/**
 * The save-integrity test suite. Node environment only — no
 * test touches the DOM, React or Electron's runtime; `test/saveService.test.ts`
 * stubs the `electron` module so `main/paths.ts` can root at a temp folder.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  // Components a test reaches through a mod's entry are compiled as the app compiles them.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
