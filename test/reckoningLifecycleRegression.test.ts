import './fixtures/maestroModelKit'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { normalizeBreakthrough } from '@shared/breakthrough'
import type { SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { canUnlockReckoning, unlockReckoningDungeon } from '../src/renderer/stores/reckoning'
import { dungeonEntryAllowed } from '../src/renderer/stores/reckoningDungeon'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { markDecisionPoint, writeAutosave, writesSettled } from '../src/renderer/stores/loop/saves'
import { GRADUATION_DATE } from '../src/renderer/prompts/occasions'
import { unspokenNightAvailable } from '../src/renderer/stores/reckoningCalendar'
import { character, charactersById, charInfo, sceneLines, stubApi, restoreApi } from './fixtures'

const game = () => useGameStore.getState()
const girl = character({ charId: 'a', firstName: 'Nina', personality: 'Outspoken, but afraid of letting people down.' })
let saved: SaveDraft[]

beforeEach(() => {
  game().reset()
  resetLoopState()
  saved = []
  useModsStore.setState({ switches: { on: { echo: false, reckoning: true, breakthrough: true }, options: {} } })
  const lines = sceneLines('We talked about her bakery plans.')
  useGameStore.setState({
    playthroughId: '123', date: 15, time: 0, chars: ['a'], cast: ['a'],
    playerFirstName: 'Sam', playerLastName: 'Lee', characters: charactersById(girl),
    charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 12 }, (_, i) => ({
      date: 15, type: 'loved' as const, desc: `The reader supported her plans on occasion ${i}.`
    })) }) },
    awaitingInput: true, currentSceneTranscript: lines, sceneLog: lines, currentLine: lines[0],
    exBreakthrough: normalizeBreakthrough({ meters: { a: 100 } })
  })
  stubApi({
    jobs: { cancelGroup: async () => ({ ok: true, data: undefined }) },
    saves: { autosave: async (_id, draft) => {
      saved.push(structuredClone(draft))
      return { ok: true, data: { ...draft, playthroughId: '123', saveId: 'autosave', saveDate: 0 } }
    } }
  })
})

afterEach(async () => { await writesSettled(); restoreApi() })

it('keeps the paid link beat when the normal leave path writes its held decision checkpoint', async () => {
  markDecisionPoint()
  await writesSettled()
  await unlockReckoningDungeon('a')
  const linkedTranscript = [...game().currentSceneTranscript]
  const linkedScene = structuredClone(saved.at(-1)?.scene)
  expect(linkedScene?.pendingLines).toHaveLength(1)
  expect(linkedScene?.resumeOnLine).toBe(true)
  expect(saved.at(-1)?.scene?.transcript).toEqual(linkedTranscript)
  expect(game().exBreakthrough.meters.a).toBe(0)
  // The production writeDecisionPoint in gameLoop.ts executes this exact write before leaving,
  // switching saves or quitting. No game/window/application API is needed for the reproduction.
  expect(loopState.decisionSave).not.toBeNull()
  await writeAutosave(loopState.decisionSave)
  expect(saved.at(-1)?.exReckoning?.dungeon).toBeDefined()
  expect(saved.at(-1)?.exBreakthrough?.meters.a).toBe(0)
  expect(saved.at(-1)?.scene?.transcript).toEqual(linkedTranscript)
  expect(saved.at(-1)?.scene).toEqual(linkedScene)
  await writeAutosave(loopState.decisionSave)
  expect(saved.at(-1)?.scene).toEqual(linkedScene)
  expect(saved.at(-1)?.exBreakthrough?.meters.a).toBe(0)
})

it('keeps the old checkpoint and spirit if saving the connection fails', async () => {
  markDecisionPoint(); await writesSettled()
  const checkpoint = loopState.decisionSave
  stubApi({ saves: { autosave: async () => ({ ok: false, error: { message: 'Disk full', code: 'IO' } }) } })
  await expect(unlockReckoningDungeon('a')).rejects.toThrow('Disk full')
  expect(loopState.decisionSave).toBe(checkpoint)
  expect(game().exReckoning.dungeon).toBeUndefined()
  expect(game().exBreakthrough.meters.a).toBe(100)
})

it.each([[GRADUATION_DATE - 2, 1], [GRADUATION_DATE - 1, 0], [0, 0]])('allows a connection with a later playable night: date %s, time %s', (date, time) => {
  useGameStore.setState({ date, time: time as 0 | 1, charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 12 }, () => ({ date, type: 'loved' as const, desc: 'She trusts the reader.' })) }) } })
  expect(canUnlockReckoning(game(), 'a')).toBe(true)
})

it('allows a previously established connection to be visited on the final playable night', async () => {
  await unlockReckoningDungeon('a')
  useGameStore.setState({ date: GRADUATION_DATE - 1, time: 1, currentSceneTranscript: [], sceneSummary: null, cast: [], currentLine: null,
    sceneFarewell: null, awaitingInput: true, pendingLines: [] })
  expect(dungeonEntryAllowed(game())).toBe(true)
  expect(unspokenNightAvailable({ date: GRADUATION_DATE, time: 1 })).toBe(false)
})

it.each(['epilogue', 'final-night'] as const)('does not offer a paid connection at the %s cutoff, after which its dungeon cannot be entered', async cutoff => {
  const date = cutoff === 'epilogue' ? GRADUATION_DATE : GRADUATION_DATE - 1
  useGameStore.setState({ date, time: cutoff === 'epilogue' ? 0 : 1, graduationSeen: cutoff === 'epilogue', sceneFarewell: cutoff === 'epilogue' ? 'a' : null,
    charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 12 }, (_, i) => ({
      date, type: 'loved' as const, desc: `The reader supported her plans on occasion ${i}.`
    })) }) }
  })
  const offered = canUnlockReckoning(game(), 'a')
  if (offered) {
    await unlockReckoningDungeon('a')
    expect(game().exBreakthrough.meters.a).toBe(0)
    // Finishing the final ordinary night reaches graduation; a goodbye stays there.
    useGameStore.setState({ date: GRADUATION_DATE, time: 0, graduationSeen: true, currentSceneTranscript: [], sceneSummary: null, cast: [],
      sceneFarewell: null, awaitingInput: true, pendingLines: [] })
    expect(dungeonEntryAllowed(game())).toBe(false)
  }
  expect(offered).toBe(false)
})
