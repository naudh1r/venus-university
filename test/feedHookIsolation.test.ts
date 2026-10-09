import { expect, it, vi } from 'vitest'

it('does not file an old slot post after a delayed hook outlives its loaded game', async () => {
  vi.resetModules()
  const { useGameStore } = await import('../src/renderer/stores/gameStore')
  const { registerHooks, setHookRules } = await import('../src/renderer/mods/hooks')
  const { resetLoopState } = await import('../src/renderer/stores/loop/state')
  const { deliverSlotPosts } = await import('../src/renderer/stores/loop/feed')
  const { charInfo } = await import('./fixtures')

  let release!: () => void
  let entered!: () => void
  const waiting = new Promise<void>((resolve) => { entered = resolve })
  const gate = new Promise<void>((resolve) => { release = resolve })
  setHookRules({ isOn: () => true, order: () => 0 })
  registerHooks('async-feed-fixture', {
    fileFeedPost: async () => { entered(); await gate }
  })
  resetLoopState()
  useGameStore.getState().reset()
  useGameStore.setState({
    playthroughId: '100', date: 5, time: 0,
    chars: ['a'], charKeyToId: { alice: 'a' }, charInfo: { a: charInfo() }
  })
  const pending = deliverSlotPosts([{ char: 'alice', text: 'Post from the old save' }])
  await waiting

  // Loading another game invalidates the old loop token while its hook is waiting.
  resetLoopState()
  useGameStore.getState().reset()
  useGameStore.setState({
    playthroughId: '200', date: 12, time: 1,
    chars: ['a'], charKeyToId: { alice: 'a' }, charInfo: { a: charInfo() }
  })
  release()
  try {
    await pending
    expect(useGameStore.getState().playthroughId).toBe('200')
    expect(useGameStore.getState().charInfo.a.feed ?? []).toEqual([])
  } finally {
    resetLoopState()
    useGameStore.getState().reset()
  }
})
