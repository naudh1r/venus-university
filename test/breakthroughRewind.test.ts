import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeBreakthrough, type BreakthroughState } from '@shared/breakthrough'
import { normalizeEcho } from '@shared/echo'
import type { EchoBreakthroughAspect } from '@shared/echoBreakthrough'
import { READER_SPEAKER, type GameSave, type SceneLine } from '@shared/types'
import { activateBreakthrough, finishBreakthrough, rearmBreakthrough } from '../src/renderer/stores/breakthrough'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { failTurn } from '../src/renderer/stores/loop/turn'
import { writeAutosave, writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const a = character({charId: 'a'}), b = character({charId: 'b', firstName: 'Mina'})
let saved: GameSave[]
const prices: [EchoBreakthroughAspect | undefined, number][] = [
  [undefined, 100], ['stoneward', 25], ['horizonbound', 50], ['wildspark', 75]
]
beforeEach(() => {
  game().reset(); resetLoopState(); saved = []
  useModsStore.setState({switches: {on: {echo: true, breakthrough: true}, options: {}}})
  const lines: SceneLine[] = [{speaker: READER_SPEAKER, text: 'We sit down.'}, ...sceneLines('Earlier one', 'Earlier two', 'Earlier three')]
  useGameStore.setState({playthroughId: 'rewind', date: 7, time: 0, chars: ['a', 'b'], cast: ['a', 'b'],
    characters: charactersById(a, b), charInfo: {a: charInfo({nameKnown: true}), b: charInfo({nameKnown: true})},
    awaitingInput: true, currentSceneTranscript: lines, sceneLog: lines, currentLine: lines.at(-1)!,
    exBreakthrough: normalizeBreakthrough({meters: {a: 100, b: 100}})})
  stubApi({saves: {autosave: async (id, draft) => {
    const save = {...draft, playthroughId: id, saveId: 'autosave', saveDate: 0}
    saved.push(save); return {ok: true, data: save}
  }}})
})
afterEach(async () => { await writesSettled(); restoreApi() })

function complete(aspect?: EchoBreakthroughAspect, charId = 'a'): number {
  useGameStore.setState({awaitingInput: true, exEcho: normalizeEcho({player: {aspect: aspect ?? 'stoneward', name: 'Test Echo'}})})
  let at = 0
  activateBreakthrough(charId, 'I offer an honest apology.', action => {
    game().logPlayerAction(action, true)
    at = game().currentSceneTranscript.length
    return true
  }, aspect)
  const token = game().exBreakthrough.pending!.id
  const lines = sceneLines(`Paid reply ${at} one`, `Paid reply ${at} two`)
  game().appendSceneLines(lines); game().appendPendingLines(lines)
  while (game().advanceLine()) { /* Read the accepted reply. */ }
  finishBreakthrough(token, false, lines, at)
  return at
}

function cutAt(kept: number): void {
  const transcript = game().currentSceneTranscript
  useGameStore.setState({pendingLines: transcript.slice(kept), sceneLog: transcript.slice(0, kept), currentLine: transcript[kept - 1]})
  game().truncateUnread()
}

describe('completed Breakthrough rewind refunds', () => {
  it.each(prices)('returns only the recorded %s cost (%i), once', (aspect, cost) => {
    useGameStore.setState({exBreakthrough: normalizeBreakthrough({meters: {a: cost, b: 35}})})
    const at = complete(aspect)
    expect(game().exBreakthrough.meters.a).toBe(0)
    cutAt(at - 1)
    expect(game().exBreakthrough.meters).toEqual({a: cost, b: 35})
    expect(game().exBreakthrough.moments.a).toEqual([])
    game().truncateUnread()
    expect(game().exBreakthrough.meters.a).toBe(cost)
  })

  it('rereads several replies without refunding, then refunds when a new branch removes the use', () => {
    complete()
    game().logPlayerAction('We talk some more.', true)
    const later = sceneLines('Later one', 'Later two')
    game().appendSceneLines(later); game().appendPendingLines(later)
    while (game().advanceLine()) { /* Read the ordinary reply. */ }
    for (let i = 0; i < 4; i++) expect(game().rewindLine()).toBe(true)
    expect(game().currentLine?.text).toBe('Earlier three')
    expect(game().exBreakthrough.meters.a).toBe(0)
    game().truncateUnread()
    game().logPlayerAction('A different response.', true)
    expect(game().exBreakthrough.meters.a).toBe(100)
    expect(game().exBreakthrough.moments.a).toEqual([])
  })

  it('does not refund when part of the paid response is kept, but can refund a later deeper cut', () => {
    const at = complete('stoneward')
    cutAt(at + 1)
    expect(game().exBreakthrough.meters.a).toBe(75)
    expect(game().exBreakthrough.moments.a[0].transcriptCount).toBe(1)
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })

  it('retains the receipt through in-place dialogue edits without refunding the edit itself', () => {
    const at = complete('horizonbound')
    game().editLogLine(at, 'A corrected detail.')
    expect(game().exBreakthrough.meters.a).toBe(50)
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })

  it('refunds only removed activations and their own characters', () => {
    complete('stoneward')
    const second = complete('stoneward')
    complete('horizonbound', 'b')
    cutAt(second - 1)
    expect(game().exBreakthrough.meters).toEqual({a: 75, b: 100})
    expect(game().exBreakthrough.moments.a).toHaveLength(1)
    expect(game().exBreakthrough.moments.b).toEqual([])
  })

  it('keeps the exact cost across save/load even if Echo is now disabled', () => {
    const at = complete('stoneward')
    const save = {...game().toGameSave(), playthroughId: 'rewind', saveId: 'manual', saveDate: 0}
    useModsStore.setState({switches: {on: {echo: false, breakthrough: false}, options: {}}})
    game().loadSave(JSON.parse(JSON.stringify(save)), playthroughRecord({chars: ['a', 'b']}), charactersById(a, b))
    game().restoreScene(save.scene)
    expect(game().exBreakthrough.meters.a).toBe(75)
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })

  it('projects an earlier decision-point save consistently, without changing the live branch', async () => {
    const before = game().captureScene()!
    complete('horizonbound')
    await writeAutosave(before)
    await writeAutosave(before)
    expect(saved.map(s => s.exBreakthrough?.meters.a)).toEqual([100, 100])
    expect(saved[0].exBreakthrough?.moments.a).toEqual([])
    expect(game().exBreakthrough.meters.a).toBe(50)
    game().restoreScene(before)
    expect(game().exBreakthrough.meters.a).toBe(100)
    game().restoreScene(before)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })

  it('does not refund another slot or an unrelated restored transcript', () => {
    const at = complete('stoneward')
    const before = game().exBreakthrough
    useGameStore.setState({date: 8})
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(75)
    useGameStore.setState({date: 7, exBreakthrough: before})
    game().restoreScene({...game().captureScene()!, transcript: sceneLines('Unrelated scene')})
    expect(game().exBreakthrough.meters.a).toBe(75)
  })

  it('refunds duplicated imported receipts only once', () => {
    const at = complete('stoneward')
    const moment = game().exBreakthrough.moments.a[0]
    useGameStore.setState({exBreakthrough: normalizeBreakthrough({meters: {a: 10}, moments: {a: [moment, moment]}})})
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(35)
  })

  it.each([undefined, -25, 26, '50'])('leaves a legacy/invalid receipt (%s) spent instead of guessing', spent => {
    const at = complete('stoneward')
    const moment = {...game().exBreakthrough.moments.a[0], spent}
    useGameStore.setState({exBreakthrough: normalizeBreakthrough({meters: {a: 75}, moments: {a: [moment]}})})
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(75)
  })

  it('caps the meter at 100 and cannot refund a removed receipt again', () => {
    const at = complete('horizonbound')
    useGameStore.setState({exBreakthrough: {...game().exBreakthrough, meters: {a: 90}}})
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(100)
    useGameStore.setState({exBreakthrough: {...game().exBreakthrough, meters: {a: 10}}})
    game().truncateUnread()
    expect(game().exBreakthrough.meters.a).toBe(10)
  })

  it('does not duplicate a branch refund when the replacement fails or is retried', () => {
    const at = complete('horizonbound')
    cutAt(at - 1)
    const before: BreakthroughState = game().exBreakthrough
    expect(before.meters.a).toBe(100)
    activateBreakthrough('a', '', () => true, 'horizonbound')
    const pending = game().exBreakthrough.pending!
    const snapshot = {action: pending.direction, scene: game().captureScene(), breakthrough: pending}
    failTurn({code: 'LLM_FAILED', message: 'Offline test'}, snapshot)
    expect(game().exBreakthrough.meters.a).toBe(100)
    useGameStore.setState({turnError: null, awaitingInput: true})
    rearmBreakthrough(pending)
    expect(game().exBreakthrough.meters.a).toBe(50)
    finishBreakthrough(pending.id, true)
    finishBreakthrough(pending.id, true)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })

  it('keeps a new pending charge separate while its dispatch cuts an older paid turn', () => {
    const at = complete('stoneward')
    const transcript = game().currentSceneTranscript
    useGameStore.setState({pendingLines: transcript.slice(at - 1), sceneLog: transcript.slice(0, at - 1), currentLine: transcript[at - 2]})
    activateBreakthrough('a', '', () => { game().truncateUnread(); return true }, 'stoneward')
    expect(game().exBreakthrough.meters.a).toBe(75)
    const token = game().exBreakthrough.pending!.id
    expect(game().exBreakthrough.moments.a).toEqual([])
    finishBreakthrough(token, true)
    finishBreakthrough(token, true)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })

  it('does not issue refunds from replay or Scene Creator truncation', () => {
    const at = complete('stoneward')
    const transcript = game().currentSceneTranscript, state = game().exBreakthrough
    useGameStore.setState({replaying: {} as NonNullable<ReturnType<typeof game>['replaying']>})
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(75)
    useGameStore.setState({replaying: null, createdScene: {} as NonNullable<ReturnType<typeof game>['createdScene']>,
      exBreakthrough: state, currentSceneTranscript: transcript})
    cutAt(at - 1)
    expect(game().exBreakthrough.meters.a).toBe(75)
  })
})
