import { afterEach, expect, it, vi } from 'vitest'
import { character, charInfo, restoreApi, stubApi } from './fixtures'
stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore: game } = await import('../src/renderer/stores/gameStore')
const { useModsStore: mods } = await import('../src/renderer/stores/modsStore')
await import('../src/renderer/stores/loop/saves')
const { setSceneSuggestionsPaused: pause, sceneSuggestionsPaused } = await import('../src/renderer/mods/sceneSuggestions')
const { askAssistant, assistantNow } = await import('../src/renderer/stores/storyAssistant')
afterEach(() => { pause('mini-games', false); pause('echo', false); game.getState().reset(); restoreApi() })

it('blocks requests while sharing/studying, cancels in-flight work and resumes without changing switches', async () => {
  const calls: Array<{ done: (r: any) => void }> = [], cancel = vi.fn(async () => ({ ok: true as const, data: undefined }))
  stubApi({ llm: { completeMod: async () => new Promise(done => { calls.push({ done }) }), cancelMod: cancel } })
  game.getState().reset()
  game.setState({ playthroughId: 'fixture', date: 7, time: 0, cast: ['a'], chars: ['a'],
    characters: { a: character({ charId: 'a' }) }, charInfo: { a: charInfo({ nameKnown: true }) },
    currentSceneTranscript: [{ speaker: '', text: 'A synthetic scene.' }], awaitingInput: true })
  mods.setState({ switches: { on: { 'story-assistant': true, 'mini-games': true, 'echo': true }, options: {} } })
  const switches = mods.getState().switches
  const pending = askAssistant('', 'fit'); expect(calls).toHaveLength(1)
  pause('mini-games', true); expect(cancel).toHaveBeenCalledTimes(1)
  await askAssistant('', 'fit'); expect(calls).toHaveLength(1)
  pause('mini-games', false)
  calls[0].done({ ok: true, data: { commentary: 'Late reply', suggestions: [{ label: 'Wave', action: 'I wave.' }] } }); await pending
  expect(assistantNow().read).toBeNull()
  pause('echo', true)
  expect(sceneSuggestionsPaused()).toBe(true)
  await askAssistant('', 'fit'); expect(calls).toHaveLength(1)
  pause('echo', false); expect(sceneSuggestionsPaused()).toBe(false)
  const resumed = askAssistant('', 'fit'); expect(calls).toHaveLength(2)
  calls[1].done({ ok: true, data: { commentary: 'Normal scene', suggestions: [{ label: 'Wave', action: 'I wave.' }] } }); await resumed
  expect(assistantNow().read?.reply.commentary).toBe('Normal scene')
  expect(mods.getState().switches).toBe(switches)
})
