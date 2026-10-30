import './fixtures/maestroModelKit'
import { SHIPPED_BOOK } from '../src/renderer/prompts/lorebook'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { calendarOf } from '@shared/semesters'
import { normalizeBreakthrough } from '@shared/breakthrough'
import { CHARACTER_DYNAMICS_MOD, type CharacterDynamics } from '@shared/characterDynamics'
import '@shared/characterDynamicsCarry'
import { carryModFields, carriedModFields } from '@shared/modCarry'
import { stampSave } from '@shared/saveRules'
import type { SaveDraft, StructuredRequest } from '@shared/types'
import type { ReckoningContext } from '@shared/reckoning'
import { buildTextingPrompt } from '../src/renderer/prompts/textingPrompt'
import '../src/renderer/modEntries/character-dynamics'
import '../src/renderer/modEntries/reckoning'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { unlockReckoningDungeon, startReckoning } from '../src/renderer/stores/reckoning'
import { enterReckoningDungeon } from '../src/renderer/stores/reckoningDungeon'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const girl = character({ charId: 'a', firstName: 'Nina', personality: 'Outspoken, but afraid of letting people down.' })
const reason = 'They once competed in the Southbridge chess club and still have a friendly rivalry.'
const dynamics: CharacterDynamics = { version: 1, characters: { a: {
  traits: ['meticulous'], relationship: { kind: 'rival', reason }
} } }
let requests: StructuredRequest[]
let saves: SaveDraft[]

beforeEach(() => {
  game().reset(); resetLoopState(); requests = []; saves = []
  stubApi({
    jobs: { cancelGroup: async () => ({ ok: true, data: undefined }) },
    llm: { completeMod: async (_modId, request) => {
      requests.push(request)
      const context = JSON.parse(request.user) as ReckoningContext
      const memory = context.evidence.find(item => item.kind === 'memory')!
      return { ok: true, data: { thoughts: [
        { belief: 'I must never rely on anyone.', challenge: 'Why should I ask you for help?', evidence: ['e1', memory.id] },
        { belief: 'I am worthless if I make a mistake.', challenge: 'What would I have left if I failed?', evidence: ['e1'] },
        { belief: 'I must always earn kindness.', challenge: 'What if I stop proving myself?', evidence: ['e1'] }
      ] } }
    } },
    saves: { autosave: async (_id, draft) => {
      saves.push(structuredClone(draft))
      return { ok: true, data: { ...draft, playthroughId: 'next-term', saveId: 'autosave', saveDate: 0 } }
    } }
  })
})
afterEach(async () => { await writesSettled(); resetLoopState(); restoreApi() })

function enterContinuedRun(recorded: boolean, menu: boolean, retain = true): void {
  // The production carry registry deliberately keeps inactive choices, and NewGameView uses
  // carriedModFields through carriedOpening while recording the new semester's mod choices.
  const source = stampSave({ ...game().toGameSave(), ...(retain ? { exCharacterDynamics: dynamics } : {}) }, 'old-term', 'autosave', 0)
  const retained = carryModFields(source, { term: 0, back: 120, characters: charactersById(girl) })
  const record = playthroughRecord({ chars: ['a'], mods: recorded ? [CHARACTER_DYNAMICS_MOD] : [] })
  const draft = { ...game().toGameSave(), ...carriedModFields(retained), date: 15, time: 0 as const,
    charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 12 }, (_, i) => ({
      date: 15, type: 'loved' as const, desc: `The reader supported her bakery plan on occasion ${i}.`
    })) }) }, exBreakthrough: normalizeBreakthrough({ meters: { a: 100 } }) }
  useModsStore.setState({ switches: { on: { [CHARACTER_DYNAMICS_MOD]: menu, echo: false, reckoning: true, breakthrough: true }, options: { 'reckoning:prepare-questions': true } } })
  game().loadSave(stampSave(draft, 'next-term', 'autosave', 1), record, charactersById(girl))
  loopState.record = record
  const lines = sceneLines('We talked about her bakery plans.')
  useGameStore.setState({ cast: ['a'], currentSceneTranscript: lines, sceneLog: lines, currentLine: lines[0], awaitingInput: true })
}

function ordinaryPrompt(): StructuredRequest {
  const state = game()
  return buildTextingPrompt(girl, state.charInfo.a, undefined, 'How is your day?', {
    lorebook: SHIPPED_BOOK, date: state.date, time: state.time, memoryBudget: 10, charInfo: state.charInfo,
    npcRelationships: {}, roster: [girl], classes: {}, playerSchedule: {}, classRosters: {}, calendar: calendarOf('spring', []), history: {}, playerJob: null,
    exCharacterDynamics: state.exCharacterDynamics
  }, 'READER')
}

describe('QA5: encounter snapshots respect inactive carried starting Dynamics', () => {
  it.each([
    { recorded: false, menu: false, retain: true, expected: false, name: 'inactive carried choices with menu off' },
    { recorded: false, menu: true, retain: true, expected: false, name: 'inactive record with future-playthrough menu on' },
    { recorded: true, menu: false, retain: true, expected: true, name: 'control: active record with future-playthrough menu off' },
    { recorded: false, menu: false, retain: false, expected: false, name: 'control: ordinary run with no carried choices' }
  ])('$name', async ({ recorded, menu, retain, expected }) => {
    enterContinuedRun(recorded, menu, retain)
    expect(ordinaryPrompt().user.includes(reason)).toBe(expected)
    await unlockReckoningDungeon('a')
    expect(saves[0].exReckoning?.dungeon?.context).toEqual(game().exReckoning.dungeon!.context)
    // The ordinary scene must finish before real nighttime entry; no legacy-inside shortcut.
    useGameStore.setState({ time: 1, cast: [], currentSceneTranscript: [], sceneSummary: null,
      sceneLog: [], currentLine: null, pendingLines: [], awaitingInput: true })
    await enterReckoningDungeon()
    await startReckoning('a')
    expect(requests).toHaveLength(1)
    expect(game().exReckoning.active).not.toBeNull()
    expect(game().exBreakthrough.meters.a).toBe(0)
    expect.soft(requests[0].user.includes(reason)).toBe(expected)
    const evidence = game().exReckoning.active!.context.evidence.map(item => item.text).join('\n')
    expect.soft(evidence.includes(reason)).toBe(expected)
    expect.soft(evidence.includes('Meticulous')).toBe(expected)
    if (retain) expect(game().exCharacterDynamics).toEqual(dynamics)
  })
})
