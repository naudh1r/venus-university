import { vi } from 'vitest'

// These tests have no Electron host. Exercise the real kit model-call, calendar,
// hook, switch, data and motion functions without initializing unrelated UI stores.
// The kit contract suite checks that these are the public exports.
vi.mock('@vx/modkit/renderer', async () => ({
  ...await import('../../src/renderer/mods/llm'),
  ...await import('../../src/renderer/prompts/feedRandoms'),
  ...await import('../../src/renderer/prompts/graduation'),
  ...await import('../../src/renderer/mods/readers'),
  ...await import('../../src/renderer/mods/hooks'),
  ...await import('../../packages/modkit/src/renderer/saveField'),
  ...await import('../../packages/modkit/src/renderer/sceneField'),
  ...await import('../../packages/modkit/src/renderer/modState'),
  ...await import('../../src/renderer/views/motion'),
  ...Object.fromEntries(Object.entries(await import('../../src/renderer/stores/modsStore'))
    .filter(([name]) => ['modIsOn', 'modOptionOn', 'useModOn', 'useModOption'].includes(name)))
}))
