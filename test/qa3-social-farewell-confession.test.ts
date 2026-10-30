import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carryWhisper, ensureWhisperAuthor } from '@shared/venusWhisper'
import { settleWhisperConfession, whisperCanConfess, whisperIdentityKnown, whisperIdentityLines, type WhisperConfession } from '@shared/whisperIdentity'
import { READER_SPEAKER, type SaveDraft, type SceneLine } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { whisperIdentityContext, whisperConfessionRequest, recordWhisperConfession } from '../src/renderer/stores/whisperIdentity'
import { DEPARTURE_TURNS } from '../src/renderer/stores/stageStep'
import { castCharactersOf, presentCastOf } from '../src/renderer/stores/loop/cast'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { runEnding } from '../src/renderer/stores/loop/hooks'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { GRADUATION_DATE } from '../src/renderer/prompts/occasions'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { advance } = await import('../src/renderer/stores/gameLoop')
const { promptState } = await import('../src/renderer/stores/loop/promptState')
const game = () => useGameStore.getState()
const author = character({ charId: 'a' })
const claim: WhisperConfession = { author: 'sarah_rose', asked: true, admitted: true, private: true,
  question: 'Are you Lady Harewood?', quote: 'Yes, I write the column.' }
const lines: SceneLine[] = [{ speaker: READER_SPEAKER, text: claim.question }, { speaker: 'sarah_rose', text: claim.quote }]
let saved: SaveDraft[]
const completeLedger = vi.fn()

beforeEach(() => {
  game().reset(); resetLoopState(); useBunnyboardStore.getState().reset(); saved = []; completeLedger.mockReset()
  useModsStore.setState({ switches: { on: { 'venus-whisper': true, echo: false, reckoning: false }, options: {} } })
  useGameStore.setState({ playthroughId: '123', date: GRADUATION_DATE, time: 0, graduationSeen: true,
    chars: ['a'], cast: ['a'], characters: charactersById(author), charKeyToId: { sarah_rose: 'a' },
    charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 20 }, (_, i) => ({
      date: GRADUATION_DATE, type: 'loved' as const, desc: `Shared kindness ${i}`
    })) }) },
    sceneFarewell: 'a', sceneEnding: true, statusShown: true, awaitingInput: false,
    currentSceneTranscript: lines, sceneLog: lines, currentLine: lines[1], pendingLines: [] })
  useGameStore.setState({ exVenusWhisper: ensureWhisperAuthor(game(), () => 0) })
  stubApi({ llm: { completeLedger }, saves: { autosave: async (id, draft) => {
    saved.push(structuredClone(draft))
    return { ok: true, data: { ...draft, playthroughId: id, saveId: 'autosave', saveDate: 0 } }
  } } })
})
afterEach(async () => { await writesSettled(); resetLoopState(); restoreApi(); vi.restoreAllMocks() })

function identity() {
  return whisperIdentityContext(promptState(), [author])!
}

async function finishGoodbye() {
  // Exercise production ending and final playback. No closing provider is needed: this
  // fixture is already at the completed goodbye with no additional closing cast to write.
  await runEnding(false)
  advance()
  await writesSettled()
  expect(game().currentSceneTranscript).toEqual([])
  expect(saved.at(-1)?.scene).toBeNull()
}

describe('QA3 first author confession in a graduation goodbye', () => {
  it('does not invite or file a first confession in a goodbye without bookkeeping', async () => {
    const context = identity()
    expect(context).not.toBeNull()
    expect(whisperIdentityKnown(context)).toBe(false)
    expect(whisperCanConfess(context)).toBe(false)
    const expected = settleWhisperConfession(context, claim, lines).discovery
    expect(expected).toBeUndefined()
    await finishGoodbye()
    expect(completeLedger).not.toHaveBeenCalled()
    // A goodbye has no ledger or clock advancement. It must not promise a new discovery.
    expect.soft(saved.at(-1)?.exVenusWhisper?.discovery).toEqual(expected)
    expect.soft(carryWhisper(saved.at(-1)?.exVenusWhisper, 0, GRADUATION_DATE).discovery).toEqual(expected)
  })

  it('control: ordinary accepted scene bookkeeping files the same evidence', () => {
    useGameStore.setState({ date: GRADUATION_DATE - 1, sceneFarewell: null, sceneEnding: false,
      charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 20 }, (_, i) => ({
        date: GRADUATION_DATE - 1, type: 'loved' as const, desc: `Shared kindness ${i}`
      })) }) } })
    recordWhisperConfession({ before: game(), ledger: { exWhisperConfession: claim }, closingCast: [author] })
    expect(game().exVenusWhisper.discovery).toEqual({ author: 'a', term: 0, day: GRADUATION_DATE - 1, time: 0 })
  })

  it('control: a discovery earned before graduation survives the goodbye', async () => {
    const discovered = { ...game().exVenusWhisper, discovery: { author: 'a', term: 0, day: GRADUATION_DATE - 1, time: 0 as const } }
    expect(whisperIdentityKnown({ ...identity(), whisper: discovered })).toBe(true)
    useGameStore.setState({ exVenusWhisper: discovered })
    await finishGoodbye()
    expect(saved.at(-1)?.exVenusWhisper?.discovery).toEqual(discovered.discovery)
  })
})


describe('QA3 departed company and private confession', () => {
  it('keeps a confession permitted after a third party has left eligible for actual bookkeeping', () => {
    const other = character({ charId: 'b', firstName: 'Mina' })
    useGameStore.setState({ date: GRADUATION_DATE - 1, sceneFarewell: null, sceneEnding: false,
      chars: ['a', 'b'], cast: ['a', 'b'], departed: [], offStage: { b: 0 }, characters: charactersById(author, other),
      charKeyToId: { sarah_rose: 'a', mina_rose: 'b' },
      charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 20 }, (_, i) => ({
        date: GRADUATION_DATE - 1, type: 'loved' as const, desc: `Shared kindness ${i}`
      })) }), b: charInfo({ nameKnown: true }) } })
    // Use the real absence clock, rather than directly inventing a departed-cast flag.
    for (let turn = 0; turn < DEPARTURE_TURNS; turn++) game().settleDepartures()
    expect(game().departed).toEqual(['b'])
    const state = promptState()
    // These are the exact two cast constructors used by submitAction and runSceneTurn.
    const proseCast = presentCastOf(game().cast)
    const ledgerCast = castCharactersOf(game().cast, true)
    expect(proseCast.map(c => c.charId)).toEqual(['a'])
    expect(ledgerCast.map(c => c.charId)).toEqual(['a', 'b'])
    const proseContext = whisperIdentityContext(state, proseCast)!
    expect(whisperIdentityLines(proseContext).join(' ')).toContain('she may honestly admit it')
    const expected = settleWhisperConfession(proseContext, claim, lines).discovery
    expect(expected).toBeDefined()
    const request = { system: 'Bookkeeping', user: 'Scene transcript',
      schema: { name: 'ledger', schema: { required: [], properties: {} } } }
    const ledgerRequest = whisperConfessionRequest(request, { state, charKeys: ['sarah_rose', 'mina_rose'] })
    expect.soft(ledgerRequest.schema.schema.properties).toHaveProperty('exWhisperConfession')
    // Even a provider volunteering the perfectly valid data cannot save it: collection
    // repeats the full-historical-cast gate after the author was alone for the exchange.
    recordWhisperConfession({ before: game(), ledger: { exWhisperConfession: claim }, closingCast: ledgerCast })
    expect.soft(game().exVenusWhisper.discovery).toEqual(expected)
  })
})
