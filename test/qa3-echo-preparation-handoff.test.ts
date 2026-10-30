import './fixtures/maestroModelKit'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { normalizeBreakthrough } from '@shared/breakthrough'
import type { Result, SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useSettingsStore } from '../src/renderer/stores/settingsStore'
import { reckoningPreparationStatus, startReckoning, unlockReckoningDungeon, watchReckoningPreparation } from '../src/renderer/stores/reckoning'
import { enterReckoningDungeon } from '../src/renderer/stores/reckoningDungeon'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, restoreApi, sceneLines, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const questions = { thoughts: [
 { belief: 'If I ask for help, I am a burden.', challenge: 'You will eventually get tired of me.', evidence: ['e1','e4'] },
 { belief: 'One mistake makes me a failure.', challenge: 'Why would anyone stay if I fail?', evidence: ['e1','e4'] },
 { belief: 'I have to earn every bit of kindness.', challenge: 'What would be left if I stopped proving myself?', evidence: ['e1','e4'] }
] }
let stop: (() => void) | undefined
const complete = vi.fn<(...args: Parameters<typeof window.api.llm.completeMod>) => Promise<Result<unknown>>>()
const cancel = vi.fn(async () => ({ ok: true as const, data: undefined }))
const saved: SaveDraft[] = []
beforeEach(() => {
 vi.useFakeTimers(); game().reset(); resetLoopState(); saved.length = 0
 complete.mockReset().mockResolvedValue({ ok: true, data: questions }); cancel.mockClear()
 useSettingsStore.setState({ settings: null })
 useModsStore.setState({ switches: { on: { echo: false, reckoning: true, breakthrough: true }, options: { 'reckoning:prepare-questions': true } } })
 const lines = sceneLines('We talked about asking for help.')
 useGameStore.setState({ playthroughId: 'qa3-pending-opening', date: 15, time: 0, chars: ['a'], cast: ['a'], playerFirstName: 'Sam', playerLastName: 'Lee',
  characters: charactersById(character({ charId: 'a', firstName: 'Nina', personality: 'Outspoken but afraid of failing.' })),
  charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 6 }, (_, i) => ({ date: 15, type: 'loved' as const, desc: `The reader listened on occasion ${i}.` })) }) },
  awaitingInput: true, currentSceneTranscript: lines, sceneLog: lines, currentLine: lines[0], exBreakthrough: normalizeBreakthrough({ meters: { a: 100 } }) })
 stubApi({ llm: { completeMod: complete }, jobs: { cancelGroup: cancel }, saves: { autosave: async (_id, draft) => {
  saved.push(structuredClone(draft)); return { ok: true, data: { ...draft, playthroughId: 'qa3-pending-opening', saveId: 'autosave', saveDate: 0 } }
 } } })
})
afterEach(async () => { stop?.(); stop = undefined; await writesSettled(); restoreApi(); vi.useRealTimers() })
const tick = () => vi.advanceTimersByTimeAsync(650)
async function finishSceneAndEnter() {
 useGameStore.setState({ time: 1, currentSceneTranscript: [], sceneLog: [], currentLine: null, sceneSummary: null, pendingLines: [], cast: [], awaitingInput: true })
 await enterReckoningDungeon()
 await startReckoning('a')
}

it('reuses a ready background opening across invocation and nighttime entry', async () => {
 stop = watchReckoningPreparation(); await tick()
 expect(reckoningPreparationStatus(game(),'a').status).toBe('ready')
 await unlockReckoningDungeon('a'); await finishSceneAndEnter()
 expect(game().exReckoning.active?.thoughts).toEqual(questions.thoughts)
 expect(complete).toHaveBeenCalledTimes(1)
 expect(cancel).not.toHaveBeenCalled()
})

it('preserves an already-running same-context opening when its target link is invoked', async () => {
 let release!: (result: Result<unknown>) => void
 complete.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
 stop = watchReckoningPreparation(); await tick()
 expect(reckoningPreparationStatus(game(),'a').status).toBe('preparing')
 const originalContext = JSON.parse(complete.mock.calls[0][1].user)
 await unlockReckoningDungeon('a')
 expect(game().exReckoning.dungeon?.context).toEqual(originalContext)
 expect(game().exBreakthrough.meters.a).toBe(0)
 release({ ok: true, data: questions }); await tick()
 await finishSceneAndEnter()
 expect(game().exReckoning.active?.thoughts).toEqual(questions.thoughts)
 // A lifecycle handoff preserves the exact immutable context; no provider change, load,
 // new scene evidence, or second intended encounter calls for another question set.
 expect.soft(complete.mock.calls.map(([_modId, request]) => JSON.parse(request.user))).toEqual([originalContext])
 expect.soft(cancel).not.toHaveBeenCalled()
})

it.each(['load', 'provider'] as const)('still discards a handed-off request after a %s change', async kind => {
 let release!: (result: Result<unknown>) => void
 complete.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
 stop = watchReckoningPreparation(); await tick()
 const group = complete.mock.calls[0][2]
 await unlockReckoningDungeon('a')
 if (kind === 'load') useGameStore.setState({ loads: game().loads + 1 })
 else useSettingsStore.setState({ settings: { apiProvider: 'openai', endpointModel: 'other-model' } as never })
 expect(cancel).toHaveBeenCalledWith(group)
 release({ ok: true, data: questions }); await vi.advanceTimersByTimeAsync(0)
 expect(reckoningPreparationStatus(game(), 'a').status).not.toBe('ready')
 expect(game().exReckoning.active).toBeNull()
})

it('retains the original pending request if saving the link fails', async () => {
 let release!: (result: Result<unknown>) => void
 complete.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
 stop = watchReckoningPreparation(); await tick()
 const autosave = window.api.saves.autosave
 window.api.saves.autosave = async () => ({ ok: false, error: { code: 'QA_DISK', message: 'Synthetic write refusal' } })
 await expect(unlockReckoningDungeon('a')).rejects.toThrow('Synthetic write refusal')
 window.api.saves.autosave = autosave
 expect(game().exReckoning.dungeon).toBeUndefined()
 expect(game().exBreakthrough.meters.a).toBe(100)
 release({ ok: true, data: questions }); await tick()
 await unlockReckoningDungeon('a'); await finishSceneAndEnter()
 expect(complete).toHaveBeenCalledTimes(1)
 expect(cancel).not.toHaveBeenCalled()
})
