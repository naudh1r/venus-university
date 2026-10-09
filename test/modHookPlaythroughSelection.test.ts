import { expect, it, vi } from 'vitest'

it('dispatches a playthrough-scoped hook from the loaded record rather than new-game defaults', async () => {
  vi.resetModules()
  const mods = await import('../src/shared/mods')
  const { useGameStore } = await import('../src/renderer/stores/gameStore')
  const { useModsStore } = await import('../src/renderer/stores/modsStore')
  const { loopState, resetLoopState } = await import('../src/renderer/stores/loop/state')
  const { registerHooks, promptLines } = await import('../src/renderer/mods/hooks')
  const { playthroughRecord } = await import('./fixtures')
  const list = mods.MODS as import('../src/shared/mods').ModDef[]
  const oldSwitches = useModsStore.getState().switches
  const fixture = {
    id: 'saved-feature', name: 'Saved feature', author: 'fixture', version: '1',
    scope: 'playthrough' as const, defaultOn: true, blurb: ''
  }
  list.push(fixture)
  resetLoopState()
  useGameStore.getState().reset()
  const record = playthroughRecord({ mods: [fixture.id] })
  loopState.record = record
  useGameStore.setState({ playthroughId: '123' })
  useModsStore.setState({ switches: { on: { [fixture.id]: false }, options: {} } })
  registerHooks(fixture.id, {
    prompts: { 'slot-posts': { lines: () => ['Saved feature is active'] } }
  })

  try {
    expect(mods.modOn(useModsStore.getState().switches, fixture.id, record)).toBe(true)
    expect(promptLines('slot-posts', {})).toEqual(['Saved feature is active'])
  } finally {
    list.splice(list.indexOf(fixture), 1)
    useModsStore.setState({ switches: oldSwitches })
    resetLoopState()
    useGameStore.getState().reset()
  }
})
