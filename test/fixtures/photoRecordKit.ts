import { vi } from 'vitest'

// Pure prompt and switch tests use real record handles without booting the window's stores.
vi.mock('@vx/modkit/renderer', async () => ({
  ...await import('../../packages/modkit/src/renderer/saveField')
}))
