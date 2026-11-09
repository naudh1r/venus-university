import * as nativeExchange from '../src/renderer/mods/sceneExchange'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CompanionTurn } from '@shared/screenCompanion'
import { defaultMilestones, type SavedScene, type SceneSetup } from '@shared/sceneCreator'
import { READER_SPEAKER, type SaveDraft, type GameSave, type Result } from '@shared/types'
import { buildCharKeyToId, useGameStore } from '../src/renderer/stores/gameStore'
import { canShareLaptop, openScreenCompanion } from '../src/renderer/stores/screenCompanion'
import { sceneNotes, notesConversationScope } from '../src/renderer/sceneNotes/state'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { writeAutosave, writesSettled } from '../src/renderer/stores/loop/saves'
import { createdSceneFields, createdSceneSavable, writeCreatedScene } from '../src/renderer/stores/loop/createdScene'
import { character, charInfo, restoreApi, stubApi } from './fixtures'

// Exercise the real public scene readers without booting the kit's unrelated UI exports in Node.
vi.mock('@vx/modkit/renderer', async () => {
  const { currentRun, runStale } = await import('../src/renderer/stores/loop/state')
  const { isOrientationSlot } = await import('../src/renderer/prompts/introScript')
  const { isGraduationSlot } = await import('../src/renderer/prompts/graduation')
  const {saveField}=await import('../packages/modkit/src/renderer/saveField')
  const {sceneField}=await import('../packages/modkit/src/renderer/sceneField')
  const scene = () => { const game = useGameStore.getState(); return { lines: game.currentSceneTranscript, created: Boolean(game.createdScene), replay: Boolean(game.replaying), ending: game.sceneEnding } }
  return { hasDesktopSurfaces:()=>true, sceneExchangeContext:()=>nativeExchange.sceneExchangeContext(),
    openSceneExchange:(id:string)=>nativeExchange.openSceneExchange(id),canRecordSceneTurn:()=>nativeExchange.canRecordSceneTurn(),
    subscribeSceneTurns:(f:()=>void)=>nativeExchange.subscribeSceneTurns(f), showError: vi.fn(), scene, spriteUrl: (id: string, emotion: string) => 'test-sprite:' + id + '/' + emotion, modIsOn:()=>true,currentRun, runStale, isOrientationSlot, isGraduationSlot,saveField,sceneField }
})

vi.mock('../src/renderer/stores/modsStore', async original=>({...await original<object>(),modIsOn:()=>true}))
vi.mock('../src/renderer/screenCompanionHook',()=>({companionGameApi:()=>({open,document:syncDocument,acknowledge,detach,onTurn:(listener:(turn:CompanionTurn)=>void,checkpoint?:()=>void)=>{receive=listener;flushCheckpoint=checkpoint;return()=>{}}})}))
let receive: (turn: CompanionTurn) => void
let flushCheckpoint: (() => void) | undefined
let sceneId: string
const open = vi.fn(async (_context: string, id?: string, _document?: unknown) => { sceneId = id!; return { ok: true as const, data: undefined } })
const saveScene = vi.fn(async (_scene: SavedScene) => ({ ok: true as const, data: undefined }))
const acknowledge = vi.fn(async (_sceneId: string, _id: number, _accepted: boolean) => ({ ok: true as const, data: undefined }))
const detach = vi.fn(async () => ({ ok: true as const, data: undefined }))
const syncDocument = vi.fn(async (_id: string, _document: unknown, _context: string): Promise<Result<void>> => ({ ok: true, data: undefined }))
const autosave = vi.fn(async (_id: string, _draft: SaveDraft) => ({ ok: true as const, data: {} as GameSave }))

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  vi.clearAllMocks()
  const person = character({ firstName: 'ParticipantA', lastName: 'Test' })
  useGameStore.setState({ playthroughId: 'story', date: 3, time: 1, awaitingInput: true,
    cast: [person.charId], characters: { [person.charId]: person }, chars: [person.charId],
    charKeyToId: buildCharKeyToId({ [person.charId]: person }), charInfo: { [person.charId]: charInfo({ nameKnown: true, seenOutfits: ['pe'] }) },
    slots: [person.charId, null, null], emotions: { [person.charId]: 'neutral_pe' },
    currentSceneTranscript: [{ speaker: 'participanta_test', text: 'Show me?' }],
    sceneLog: [{ speaker: 'participanta_test', text: 'Show me?' }]
  })
  stubApi({saves:{autosave},scenes:{write:saveScene}})
})

afterEach(async () => {
  useGameStore.getState().reset()
  await writesSettled()
  restoreApi()
})

const turn = (over: Partial<CompanionTurn> = {}): CompanionTurn => ({
  sceneId, id: 1, participants: ['char-1'], invitation: true, message: 'How is our team?',
  lines: [{ charId: 'char-1', text: 'Try staying near cover.', emotion: 'happy' }], ...over
})

it('keeps laptop dialogue, its expression and the decision point together in the saved scene, once', async () => {
  const before = useGameStore.getState().toGameSave()
  await openScreenCompanion()
  receive(turn())
  receive(turn())
  await writesSettled()
  const live = useGameStore.getState()
  expect(live.currentSceneTranscript.map(line => line.speaker)).toEqual(['participanta_test', READER_SPEAKER, READER_SPEAKER, 'participanta_test'])
  expect(live.sceneLog).toEqual(live.currentSceneTranscript)
  expect(live.emotions['char-1']).toBe('happy_pe')
  expect(live.awaitingInput).toBe(true)
  expect(live.pendingLines).toEqual([])
  expect(live.toGameSave().charInfo).toEqual(before.charInfo)
  expect(live.date).toBe(3)
  expect(autosave).toHaveBeenCalledTimes(1)
  expect(autosave.mock.calls[0][1].scene?.transcript).toEqual(live.currentSceneTranscript)
})

it('rejects late replies after an ordinary action, rewind or different playthrough', async () => {
  await openScreenCompanion()
  const stale = turn()
  useGameStore.getState().logPlayerAction('I close the laptop.', true)
  const transcript = useGameStore.getState().currentSceneTranscript
  receive(stale)
  expect(detach).toHaveBeenCalledWith(sceneId)
  expect(useGameStore.getState().currentSceneTranscript).toBe(transcript)
  expect(autosave).not.toHaveBeenCalled()
  useGameStore.setState({ playthroughId: 'other', currentSceneTranscript: [] })
  receive(stale)
  expect(useGameStore.getState().currentSceneTranscript).toEqual([])
})

it('rejects an old document reply and sends only the conversation after replacement', async () => {
  sceneNotes.set({ document: { name: 'notes.md', text: 'Old material.' }, revision: 'old' })
  await openScreenCompanion()
  const transcript = useGameStore.getState().currentSceneTranscript
  sceneNotes.set({ document: { name: 'notes.md', text: 'New material.' }, revision: 'new', historyStart: transcript.length })
  receive(turn({ referenceRevision: 'old' }))
  expect(useGameStore.getState().currentSceneTranscript).toBe(transcript)
  expect(acknowledge).toHaveBeenLastCalledWith(sceneId, 1, false)
  expect(autosave).not.toHaveBeenCalled()
  const context = JSON.parse(syncDocument.mock.calls.at(-1)![2])
  expect(context.referenceRevision).toBe('new')
  expect(context.scene.summary).toBeNull()
  expect(context.scene.recentLines).toEqual([])
  receive(turn({ referenceRevision: 'new', id: 2, invitation: false }))
  await writesSettled()
  expect(notesConversationScope().transcript.at(-1)?.text).toBe('Try staying near cover.')
  expect(useGameStore.getState().currentSceneTranscript[0]).toBe(transcript[0])
})

it('cannot inject another character or write into an unfinished reply or replay', async () => {
  await openScreenCompanion()
  receive(turn({ participants: ['absent'] }))
  expect(autosave).not.toHaveBeenCalled()
  const game = useGameStore.getState()
  useGameStore.setState({ pendingLines: [{ speaker:'', text:'Unread.' }] })
  expect(canShareLaptop()).toBe(false)
  useGameStore.setState({pendingLines:game.pendingLines,replaying:{}})
  expect(canShareLaptop()).toBe(false)
  useGameStore.setState({replaying:game.replaying,streaming:true})
  expect(canShareLaptop()).toBe(false)
})

it('captures the whole laptop autosave before a queued write waits, without mixing the next slot into it', async () => {
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  autosave.mockImplementationOnce(async () => { await held; return { ok: true, data: {} as GameSave } })
  const first = writeAutosave(null)
  await new Promise(resolve => setTimeout(resolve, 0))
  await openScreenCompanion()
  receive(turn())
  useGameStore.setState({ date: 4, time: 0, money: 1000 })
  release()
  await first
  await writesSettled()
  const saved = autosave.mock.calls[1][1]
  expect(saved.date).toBe(3)
  expect(saved.time).toBe(1)
  expect(saved.scene?.transcript.at(-1)?.text).toBe('Try staying near cover.')
})

it.each([2, 3])('saves an ordered %i-girl exchange with each outfit, once and without moving story time', async count => {
  const people = [character({ firstName: 'ParticipantA', lastName: 'Test' }), character({ charId: 'char-2', firstName: 'ParticipantB', lastName: 'Test' }), character({ charId: 'char-3', firstName: 'ParticipantC', lastName: 'Test' })].slice(0, count)
  const characters = Object.fromEntries(people.map(person => [person.charId, person]))
  useGameStore.setState({ characters, charKeyToId: buildCharKeyToId(characters), cast: people.map(person => person.charId), chars: people.map(person => person.charId),
    charInfo: Object.fromEntries(people.map(person => [person.charId, charInfo({ nameKnown: true, seenOutfits: ['pe'] })])),
    slots: [people[0].charId, people[1].charId, people[2]?.charId ?? null], emotions: Object.fromEntries(people.map(person => [person.charId, 'neutral_pe'])) })
  await openScreenCompanion()
  const exchange = turn({ participants: people.map(person => person.charId), lines: [...people.map(person => ({ charId: person.charId, text: `Tip from ${person.firstName}.`, emotion: 'happy' as const })), { charId: people[0].charId, text: 'I agree with you!', emotion: 'surprised' }] })
  receive(exchange); receive(exchange)
  await writesSettled()
  const live = useGameStore.getState(), transcript = live.currentSceneTranscript
  expect(transcript.slice(-count - 1).map(line => line.speaker)).toEqual([...['participanta_test', 'participantb_test', 'participantc_test'].slice(0, count), 'participanta_test'])
  expect(transcript.find(line => line.text.startsWith('I open my laptop'))?.text).toContain(people.at(-1)!.firstName)
  expect(live.emotions['char-1']).toBe('surprised_pe')
  expect(live.emotions['char-2']).toBe('happy_pe')
  if (count === 3) expect(live.emotions['char-3']).toBe('happy_pe')
  expect(live.sceneLog).toEqual(transcript)
  expect(autosave).toHaveBeenCalledTimes(1)
  expect(autosave.mock.calls[0][1].scene?.transcript).toEqual(transcript)
  expect([live.date, live.time, live.pendingLines.length, live.awaitingInput]).toEqual([3, 1, 0, true])
})

it('rejects a whole group turn before writing anything when a later speaker or expression is invalid', async () => {
  await openScreenCompanion()
  const transcript = useGameStore.getState().currentSceneTranscript
  receive(turn({ lines: [...turn().lines, { charId: 'absent', text: 'An intruder.', emotion: 'happy' }] }))
  receive(turn({ lines: [...turn().lines, { charId: 'char-1', text: 'Invalid expression.', emotion: 'unknown' as 'happy' }] }))
  receive(turn({ participants: ['char-1', 'char-1'] }))
  expect(useGameStore.getState().currentSceneTranscript).toBe(transcript)
  expect(autosave).not.toHaveBeenCalled()
  expect(acknowledge).toHaveBeenCalledTimes(3)
  expect(acknowledge.mock.calls.every(call => call[2] === false)).toBe(true)
})

function loadCreator(replay = false): SceneSetup {
  const people = [character({ firstName: 'ParticipantA', lastName: 'Test' }), character({ charId: 'char-2', firstName: 'ParticipantB', lastName: 'Test' }), character({ charId: 'char-3', firstName: 'ParticipantC', lastName: 'Test' })]
  const characters = Object.fromEntries(people.map(person => [person.charId, person]))
  const setup: SceneSetup = {
    reader: { firstName: 'Test', lastName: 'Reader', tiers: { brain: 1, body: 1, heart: 1 }, bio: 'Learning to play as a team.' },
    cast: people.map((person, i) => ({ charId: person.charId, outfit: 'pe', disposition: 'friendly',
      milestones: { ...defaultMilestones(), met: i !== 2 }, notes: 'Likes team games.' })),
    pairs: {}, date: 60, time: 1, weather: 'clear', prompt: 'We sit together after class.'
  }
  const transcript = [{ speaker: 'participanta_test', text: 'Show us your laptop.' }]
  useGameStore.getState().loadCreatedScene({ setup, ...(replay ? { replay: { id: 'original', transcript } } : {}) }, createdSceneFields(setup, characters), characters)
  useGameStore.setState({ cast: people.map(person => person.charId), slots: ['char-1', 'char-2', 'char-3'],
    charInfo: Object.fromEntries(Object.entries(useGameStore.getState().charInfo).map(([id, info]) => [id, { ...info, seenOutfits: ['pe'] }])),
    emotions: Object.fromEntries(people.map(person => [person.charId, 'neutral_pe'])),
    awaitingInput: true, currentSceneTranscript: transcript, sceneLog: transcript })
  return setup
}

it.each([false, true])('keeps a Creator laptop exchange in Save Scene without changing a playthrough or original replay (replay=%s)', async replay => {
  const setup = loadCreator(replay)
  const before = useGameStore.getState()
  expect(canShareLaptop()).toBe(true)
  expect(before.playthroughId).toBeNull()
  await openScreenCompanion()
  const context = JSON.parse(open.mock.calls[0][0])
  expect(context.onScreen).toEqual(['char-1', 'char-2', 'char-3'])
  expect(context.scene.kind).toBe('creator')
  expect(context.scene.premise).toBe(setup.prompt)
  expect(context.characters['char-3']).toMatchObject({ nameKnown: false, notes: 'Likes team games.', disposition: 'neutral' })
  const exchange = turn({ participants: ['char-1', 'char-2', 'char-3'], lines: [
    { charId: 'char-1', text: 'Stay near cover.', emotion: 'happy' },
    { charId: 'char-2', text: 'I agree.', emotion: 'surprised' },
    { charId: 'char-3', text: 'Let us regroup.', emotion: 'neutral' }
  ] })
  receive(exchange); receive(exchange)
  await writesSettled()
  const live = useGameStore.getState()
  expect(live.sceneLog).toEqual(live.currentSceneTranscript)
  expect(live.currentSceneTranscript.slice(-3).map(line => line.speaker)).toEqual(['participanta_test', 'participantb_test', 'participantc_test'])
  expect(live.emotions).toMatchObject({ 'char-1': 'happy_pe', 'char-2': 'surprised_pe', 'char-3': 'neutral_pe' })
  expect([live.stats, live.charInfo, live.date, live.time]).toEqual([before.stats, before.charInfo, before.date, before.time])
  expect(autosave).not.toHaveBeenCalled()
  expect(createdSceneSavable()).toBe(true)
  expect(await writeCreatedScene('Our laptop evening', false)).toBe(true)
  const saved = saveScene.mock.calls[0][0]
  expect(saved.setup).toEqual(setup)
  expect(saved.transcript).toEqual(live.currentSceneTranscript)
  expect(saved.transcript.some(line => line.text.startsWith('I open my laptop'))).toBe(true)
  expect(saved.transcript.some(line => line.text === exchange.message)).toBe(true)
  if (replay) {
    expect(saved.id).not.toBe(before.createdScene!.replay!.id)
    expect(before.createdScene!.replay!.transcript).toEqual([{ speaker: 'participanta_test', text: 'Show us your laptop.' }])
  }
})

it.each(['replace', 'end', 'leave'] as const)('closes a Creator session and rejects its late replies when the scene changes: %s', async change => {
  loadCreator()
  await openScreenCompanion()
  const stale = turn()
  if (change === 'replace') {
    const live = useGameStore.getState()
    // Even a reload of the same setup, cast and transcript is another scene instance.
    useGameStore.setState({ loads: live.loads + 1 })
  } else if (change === 'end') useGameStore.getState().markCreatedSceneOver()
  else useGameStore.getState().reset()
  const transcript = useGameStore.getState().currentSceneTranscript
  receive(stale)
  expect(detach).toHaveBeenCalledWith(sceneId)
  expect(useGameStore.getState().currentSceneTranscript).toBe(transcript)
  expect(autosave).not.toHaveBeenCalled()
  expect(saveScene).not.toHaveBeenCalled()
  expect(acknowledge).toHaveBeenLastCalledWith(sceneId, stale.id, false)
})

it('refuses standalone opening and unfinished Creator scenes instead of falling back to a menu session', async () => {
  useGameStore.getState().reset()
  await openScreenCompanion()
  loadCreator()
  useGameStore.setState({ pendingLines: [{ speaker: 'participanta_test', text: 'Still speaking.' }] })
  await openScreenCompanion()
  expect(open).not.toHaveBeenCalled()
  expect(autosave).not.toHaveBeenCalled()
})


it('allows Creator sharing on story-calendar restricted dates, while unfinished replies remain blocked', async () => {
  loadCreator()
  useGameStore.setState({ date: 0, time: 0 })
  expect(canShareLaptop()).toBe(true)
  await openScreenCompanion()
  expect(open).toHaveBeenCalled()
  useGameStore.setState({ pendingLines: [{speaker: 'participanta_test', text:'Let me finish.'}] })
  expect(canShareLaptop()).toBe(false)
})

it('allows a story study scene with passive Prompt Studio rollback history', async()=>{
 useGameStore.setState({sceneMods:{'prompt-studio':[{at:1,before:{previousNote:'reference'}}]} as any})
 expect(canShareLaptop()).toBe(true)
 await openScreenCompanion()
 expect(open).toHaveBeenCalled()
})

it('drops a late document-sync failure after the old laptop session has closed', async () => {
  const { showError } = await import('@vx/modkit/renderer')
  let finish!: (result: Result<void>) => void
  syncDocument.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await openScreenCompanion()
  sceneNotes.set({ document: { name: 'current.txt', text: 'Current reference.' } })
  expect(syncDocument).toHaveBeenCalledTimes(1)
  useGameStore.getState().reset()
  finish({ ok: false, error: { code: 'COMPANION_SCENE_ENDED', message: 'That laptop session has ended.' } })
  await Promise.resolve()
  expect(showError).not.toHaveBeenCalled()
})

it('retires an ended backend session silently and reopens with the current document', async () => {
  const { showError } = await import('@vx/modkit/renderer')
  syncDocument.mockResolvedValueOnce({ ok: false, error: { code: 'COMPANION_SCENE_ENDED', message: 'That laptop session has ended.' } })
  await openScreenCompanion()
  const oldId = sceneId
  const document = { name: 'current.txt', text: 'Current reference.' }
  sceneNotes.set({ document })
  await Promise.resolve()
  expect(showError).not.toHaveBeenCalled()
  await openScreenCompanion()
  expect(sceneId).not.toBe(oldId)
  expect(open.mock.calls.at(-1)?.[2]).toEqual(document)
})

it('coalesces many rapid callouts into one checkpoint save without losing dialogue', async () => {
  await openScreenCompanion()
  const serialize=vi.fn(useGameStore.getState().toGameSave)
  useGameStore.setState({toGameSave:serialize})
  for (let i = 1; i <= 100; i++) receive(turn({ id: i, rapid: true, invitation: false, message: '', lines: [{charId:'char-1',text:`Callout ${i}.`,emotion:'happy'}] }))
  expect(serialize).not.toHaveBeenCalled()
  expect(autosave).not.toHaveBeenCalled()
  expect(useGameStore.getState().currentSceneTranscript).toHaveLength(101)
  flushCheckpoint!()
  await writesSettled()
  expect(autosave).toHaveBeenCalledTimes(1)
  expect(serialize).toHaveBeenCalledTimes(1)
  expect(autosave.mock.calls[0][1].scene?.transcript.at(-1)?.text).toBe('Callout 100.')
})
