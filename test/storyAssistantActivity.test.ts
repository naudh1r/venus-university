import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Result } from '@vx/modkit/shared'
import { character, charInfo, restoreApi, sceneLines, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore: game } = await import('../src/renderer/stores/gameStore')
const { useModsStore: mods } = await import('../src/renderer/stores/modsStore')
await import('../src/renderer/stores/loop/saves')
const { setSceneSuggestionsPaused: pause } = await import('../src/renderer/mods/sceneSuggestions')
const { askAssistant, assistantNow } = await import('../src/renderer/stores/storyAssistant')

const originalSwitches = mods.getState().switches
const calls: Array<(result: Result<unknown>) => void> = []
const cancel = vi.fn(async () => ({ ok: true as const, data: undefined }))
const reply = {
  ok: true as const,
  data: { commentary: 'A quiet moment.', suggestions: [{ label: 'Wave', action: 'I wave.' }] }
}

beforeEach(() => {
  calls.length = 0
  cancel.mockClear()
  stubApi({
    llm: {
      completeMod: () => new Promise<Result<unknown>>(resolve => { calls.push(resolve) }),
      cancelMod: cancel
    }
  })
  game.getState().reset()
  game.setState({
    playthroughId: 'fixture', date: 7, time: 0, cast: ['a'], chars: ['a'],
    characters: { a: character({ charId: 'a' }) },
    charInfo: { a: charInfo({ nameKnown: true }) },
    currentSceneTranscript: sceneLines('A synthetic scene.'),
    awaitingInput: true
  })
  mods.setState({ switches: { on: { 'story-assistant': true, 'mini-games': true, echo: true }, options: {} } })
})

afterEach(() => {
  pause('mini-games', false)
  pause('echo', false)
  mods.setState({ switches: originalSwitches })
  game.getState().reset()
  restoreApi()
})

it('cancels the pending request and rejects late replies when another activity pauses suggestions', async () => {
  const switches = mods.getState().switches
  const pending = askAssistant('', 'fit')
  expect(calls).toHaveLength(1)
  pause('mini-games', true)
  expect(cancel).toHaveBeenCalledTimes(1)
  await askAssistant('While paused', 'fit')
  expect(calls).toHaveLength(1)
  pause('echo', true)
  pause('mini-games', false)
  await askAssistant('', 'fit')
  expect(calls).toHaveLength(1)
  pause('echo', false)

  const resumed = askAssistant('After the pause', 'fit')
  expect(calls).toHaveLength(2)
  calls[0](reply)
  await pending
  expect(assistantNow().read).toBeNull()
  expect(assistantNow().asking?.question).toBe('After the pause')
  calls[1](reply)
  await resumed
  expect(assistantNow().read?.question).toBe('After the pause')
  expect(mods.getState().switches).toBe(switches)
})

it('hides a completed read until the last pause ends and restores the original question at the same point', async () => {
  const pending = askAssistant('What should I order?', 'fit')
  calls[0](reply)
  await pending
  const read = assistantNow().read
  expect(read?.question).toBe('What should I order?')

  pause('mini-games', true)
  pause('echo', true)
  expect(assistantNow().read).toBeNull()
  await askAssistant('While paused', 'fit')
  pause('mini-games', false)
  expect(assistantNow().read).toBeNull()
  pause('echo', false)
  expect(assistantNow().read).toBe(read)
  expect(calls).toHaveLength(1)

  pause('echo', true)
  game.setState({ currentSceneTranscript: sceneLines('A different point.') })
  pause('echo', false)
  expect(assistantNow().read).toBeNull()
})

it('restores the same failure for an explicit retry after a pause', async () => {
  const pending = askAssistant('What went wrong?', 'fit')
  calls[0]({ ok: false, error: { code: 'TEST', message: 'Try again.' } })
  await pending
  const failed = assistantNow().failed
  expect(failed).toMatchObject({ question: 'What went wrong?', message: 'Try again.' })

  pause('echo', true)
  expect(assistantNow().failed).toBeNull()
  pause('echo', false)
  expect(assistantNow().failed).toBe(failed)
  expect(calls).toHaveLength(1)
})
