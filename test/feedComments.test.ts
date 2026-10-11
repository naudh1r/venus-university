import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreApi, stubApi } from './fixtures'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  restoreApi()
  vi.restoreAllMocks()
})

describe('what the crowd said', () => {
  it('keeps nothing where the model wrote nothing, whatever the roll', async () => {
    stubApi({ jobs: { onProgress: () => () => {} } })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { rollComments } = await import('../src/renderer/stores/feedComments')
    useGameStore.setState({ npcRelationships: {}, chars: [] } as never)
    expect(rollComments('c1', undefined)).toEqual([])
    expect(rollComments('c1', [{ text: '  ' }, { text: '' }])).toEqual([])
  })

  it('never keeps more replies than the model actually wrote', async () => {
    stubApi({ jobs: { onProgress: () => () => {} } })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { rollComments } = await import('../src/renderer/stores/feedComments')
    // A girl with many friends rolls a high count; only two lines came back.
    useGameStore.setState({
      npcRelationships: {},
      chars: [],
      date: 0,
      time: 0
    } as never)
    const said = rollComments('c1', [{ text: 'first' }, { text: 'second' }])
    expect(said.length).toBeLessThanOrEqual(2)
    for (const one of said) {
      expect(one.handle).toBeTruthy()
      expect(one.emoji).toBeTruthy()
    }
  })
})
