import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeBreakthrough } from '@shared/breakthrough'
import type { GameSave, Result, SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { answerReckoning, cancelReckoningRequest, startReckoning, unlockReckoningDungeon } from '../src/renderer/stores/reckoning'
import { enterReckoningDungeon } from '../src/renderer/stores/reckoningDungeon'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const girl = character({ charId: 'a', firstName: 'Nina', personality: 'She worries about letting people down.' })
const roster = charactersById(girl)
const yes = { resolved: true, reaction: 'I can ask for help without earning it first.', feedback: 'You connected your answer to what she actually experienced.', reframe: 'I can accept help without losing myself.', tagName: 'Room for Kindness', growth: 'She finds it a little easier to ask for help.' }
let saved: SaveDraft[]
const complete = vi.fn<typeof window.api.llm.completeMod>()
const cancel = vi.fn<typeof window.api.llm.cancelMod>()
const persist = vi.fn<typeof window.api.saves.autosave>()

function checkpoint(): GameSave {
  return { ...game().toGameSave(), scene: game().captureScene(), playthroughId: 'qa4-encounter', saveId: 'autosave', saveDate: 0 }
}
function load(save: GameSave): void {
  game().loadSave(save, playthroughRecord({ chars: ['a'] }), roster)
  game().restoreScene(save.scene)
  useGameStore.setState({ awaitingInput: true, busy: false, turnError: null })
}

beforeEach(async () => {
  game().reset(); resetLoopState(); saved = []
  complete.mockReset(); cancel.mockReset(); persist.mockReset()
  useModsStore.setState({ switches: { on: { echo: false, reckoning: true, breakthrough: true }, options: { 'reckoning:prepare-questions': false } } })
  const lines = sceneLines('She tells you how much those old notes mean to her.')
  useGameStore.setState({ playthroughId: 'qa4-encounter', date: 15, time: 0, chars: ['a'], cast: ['a'], characters: roster,
    playerFirstName: 'Sam', charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 12 }, (_, i) => ({ date: 15, type: 'loved' as const, desc: `You listened patiently on occasion ${i}.` })) }) },
    currentSceneTranscript: lines, sceneLog: lines, currentLine: lines[0], awaitingInput: true, exBreakthrough: normalizeBreakthrough({ meters: { a: 100 } }) })
  persist.mockImplementation(async (_id, draft) => {
    saved.push(structuredClone(draft))
    return { ok: true, data: { ...draft, playthroughId: 'qa4-encounter', saveId: 'autosave', saveDate: 0 } }
  })
  cancel.mockResolvedValue({ ok: true, data: undefined })
  stubApi({ llm: { completeMod: complete, cancelMod: cancel }, saves: { autosave: persist } })
  await unlockReckoningDungeon('a')
  // A fresh, ordinary nighttime landing; do not restore a legacy invoking transcript.
  useGameStore.setState({ time: 1, currentSceneTranscript: [], sceneSummary: null, currentLine: null, sceneLog: [], pendingLines: [], awaitingInput: true, sceneEnding: false })
  await enterReckoningDungeon()
  const d = game().exReckoning.dungeon!
  const evidence = [d.context.evidence[0].id, d.context.evidence.find(e => e.kind !== 'profile')!.id]
  complete.mockResolvedValueOnce({ ok: true, data: { thoughts: [
    { belief: 'If I ask for help, I am a burden.', challenge: 'What if you get tired of me?', evidence },
    { belief: 'One mistake makes me a failure.', challenge: 'Why stay if I fail?', evidence },
    { belief: 'I must earn every bit of kindness.', challenge: 'What if I stopped proving myself?', evidence }
  ] } })
  await startReckoning('a')
  complete.mockResolvedValue({ ok: true, data: yes })
})
afterEach(async () => { await writesSettled(); restoreApi() })

describe('late answer lifecycle boundaries', () => {
  it.each(['cancel', 'same-save-load', 'new-game-reset'] as const)('does not apply or persist a late first answer after %s', async boundary => {
    const before = structuredClone(game().exReckoning), save = checkpoint(), writes = saved.length
    let resolve!: (value: Result<unknown>) => void
    complete.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = answerReckoning('I remember when we helped one another with those notes.')
    const rejected = expect(pending).rejects.toThrow('changed')
    if (boundary === 'cancel') expect(cancelReckoningRequest()).toBe(true)
    if (boundary === 'same-save-load') load(save)
    if (boundary === 'new-game-reset') { game().reset(); resetLoopState() }
    const stateAtBoundary = structuredClone(game().exReckoning)
    resolve({ ok: true, data: yes }); await rejected
    expect(game().exReckoning).toEqual(stateAtBoundary)
    expect(saved).toHaveLength(writes)
    if (boundary !== 'new-game-reset') {
      expect(game().exReckoning).toEqual(before)
      expect(game().exBreakthrough.meters.a).toBe(0)
      await answerReckoning('I remember when we helped one another with those notes.')
      expect(game().exReckoning.active?.answers).toHaveLength(1)
      expect(game().exBreakthrough.meters.a).toBe(0)
    }
    if (boundary === 'cancel') expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('does not award late third-answer growth after reloading the second-answer checkpoint', async () => {
    await answerReckoning('We have helped one another before.')
    await answerReckoning('One mistake never erased all your other efforts.')
    const save = checkpoint(), writes = saved.length
    let resolve!: (value: Result<unknown>) => void
    complete.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = answerReckoning('You do not have to earn every kindness.')
    const rejected = expect(pending).rejects.toThrow('changed')
    load(save)
    resolve({ ok: true, data: yes }); await rejected
    expect(saved).toHaveLength(writes)
    expect(game().exReckoning.active?.answers).toHaveLength(2)
    expect(game().exCharacterDynamics?.characters.a?.growth).toBeUndefined()
    expect(game().exReckoning.aftermath).toBeUndefined()
    await answerReckoning('You do not have to earn every kindness.')
    expect(game().exCharacterDynamics?.characters.a?.growth?.name).toBe(yes.tagName)
    expect(game().exReckoning.dungeon?.outcome).toBe('victory')
    expect(game().exBreakthrough.meters.a).toBe(0)
  })

  it('retains two saved answers on a failed final write, then awards growth exactly once after retry', async () => {
    await answerReckoning('We have helped one another before.')
    await answerReckoning('One mistake never erased all your other efforts.')
    const before = game().exReckoning, writes = saved.length
    persist.mockResolvedValueOnce({ ok: false, error: { code: 'QA4_DISK', message: 'Synthetic disk refusal' } })
    await expect(answerReckoning('You do not have to earn every kindness.')).rejects.toThrow('Synthetic disk refusal')
    expect(game().exReckoning).toBe(before)
    expect(game().exCharacterDynamics?.characters.a?.growth).toBeUndefined()
    expect(saved).toHaveLength(writes)
    await answerReckoning('You do not have to earn every kindness.')
    expect(saved).toHaveLength(writes + 1)
    expect(game().exCharacterDynamics?.characters.a?.growth?.reframes).toHaveLength(3)
    expect(game().exBreakthrough.meters.a).toBe(0)
    await expect(answerReckoning('A duplicated submit')).rejects.toThrow('Resume')
    expect(saved).toHaveLength(writes + 1)
  })

  it('refuses cancellation once the answer save has begun and commits only that answer', async () => {
    let release!: () => void
    persist.mockImplementationOnce(async (_id, draft) => {
      await new Promise<void>(resolve => { release = resolve })
      saved.push(structuredClone(draft))
      return { ok: true, data: { ...draft, playthroughId: 'qa4-encounter', saveId: 'autosave', saveDate: 0 } }
    })
    const writes = saved.length
    const pending = answerReckoning('We have helped one another before.')
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    expect(cancelReckoningRequest()).toBe(false)
    expect(cancel).not.toHaveBeenCalled()
    await expect(answerReckoning('A duplicate while writing')).rejects.toThrow('already')
    release(); await pending
    expect(saved).toHaveLength(writes + 1)
    expect(game().exReckoning.active?.answers).toHaveLength(1)
    expect(game().exBreakthrough.meters.a).toBe(0)
  })
})
