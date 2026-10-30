import { vi } from 'vitest'

// These store tests have no Electron host. Exercise the real kit model-call
// and calendar functions without initializing the renderer entry's unrelated UI stores.
// The kit contract suite checks that these are the public exports.
vi.mock('@vx/modkit/renderer', async () => ({
  ...await import('../../src/renderer/mods/llm'),
  ...await import('../../src/renderer/prompts/graduation')
}))
