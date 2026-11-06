import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SaveDraft } from '@shared/types'
import type { GameSave, Result, StructuredRequest } from '@vx/modkit/shared'
import { charKeyOf } from '@vx/modkit/shared'
import { character, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'
import { legacyCharInfo, type LegacyBunnyPost } from './bunnyfeedsFixtures'
import type { FeedThreadsResponse } from '../src/shared/bunnyfeeds'

vi.mock('../src/renderer/stores/jobStore', () => ({ useJobStore: {} }))

stubApi({ jobs: { onProgress: () => () => {} } })
const kit = await import('@vx/modkit/renderer')
const host = await import('@vx/modkit/host/renderer')
const { useGameStore: game } = await import('../src/renderer/stores/gameStore')
const { useModsStore } = await import('../src/renderer/stores/modsStore')
const { loopState, resetLoopState } = await import('../src/renderer/stores/loop/state')
const { writeAutosave, writesSettled } = await import('../src/renderer/stores/loop/saves')
const data = await import('../src/renderer/stores/bunnyfeedsData')
const notes = await import('../src/renderer/stores/bunnyfeedsNotes')
const memory = await import('../src/renderer/stores/bunnyfeedsMemory')
const { armFeedThreads, leavePlayerComment, resetFeedThreads } =
  await import('../src/renderer/stores/bunnyfeedsThreads')
const { takeCommented } = await import('../src/renderer/stores/bunnyfeedsVisit')
await import('../src/renderer/modEntries/bunnyfeeds')

const poster = character({ charId: 'poster', firstName: 'Sarah', lastName: 'Rose' })
const friend = character({ charId: 'friend', firstName: 'Lia', lastName: 'Day' })
const definitions = { poster, friend }
const record = playthroughRecord({
  chars: ['poster', 'friend'],
  profiles: { poster: legacyCharInfo({ handle: 'sarah' }), friend: legacyCharInfo({ handle: 'lia' }) }
})
const key = charKeyOf(poster.firstName, poster.lastName)
const other = { other: { v: '1', data: { kept: true } } }
let root = ''
let persisted: GameSave | undefined
let complete: ReturnType<typeof vi.fn<(
  id: string, request: StructuredRequest, group?: string
) => Promise<Result<FeedThreadsResponse>>>>
let autosave: ReturnType<typeof vi.fn<(id: string, draft: SaveDraft) => Promise<Result<GameSave>>>>
let receipts: MockInstance<typeof kit.saveChanges>

/** The old shape exercises every comment field, prior progress and a future held memory. */
function oldPost(): LegacyBunnyPost {
  return {
    id: 'post', text: 'An afternoon post', date: 2, time: 0, likes: 0,
    threadedThrough: 2,
    heldMemories: [{ charId: 'friend', posterId: 'poster', at: 6,
      type: 'liked', desc: 'A future exchange' }],
    ex: other,
    comments: [
      { id: 'stranger', handle: 'sun', emoji: '', text: 'hi', at: 0 },
      { id: 'p0', player: true, handle: 'you', emoji: '', text: 'old', at: 0, ex: other },
      { id: 'r0', charId: 'poster', replyTo: 'p0', read: true,
        handle: 'sarah', emoji: '', text: 'answer', at: 1 },
      { id: 'p1', player: true, handle: 'you', emoji: '', text: 'earlier', at: 1 },
      { id: 'r1', charId: 'poster', replyTo: 'p1', read: true,
        handle: 'sarah', emoji: '', text: 'answer', at: 2 },
      { id: 'friend-r1', charId: 'friend', replyTo: 'p1',
        handle: 'lia', emoji: '', text: 'friend', at: 3 },
      { id: 'mine', player: true, replyTo: 'stranger', tags: ['friend'],
        handle: 'you', emoji: '', text: 'now', at: 4 }
    ]
  }
}

/** A save produced by the native serializer, then encoded as an older file on disk. */
function oldSave(): GameSave {
  const board = game.getState().bunnyboard
  game.setState({
    playthroughId: '1', date: 2, time: 0, chars: ['poster', 'friend'],
    characters: definitions,
    charInfo: {
      poster: legacyCharInfo({ handle: 'sarah', nameKnown: true, feed: [oldPost()], memories: [
        { date: 1, type: 'liked', desc: 'The old exchange, on her post' },
        { date: 1, type: 'liked', desc: 'A game memory' }
      ] }),
      friend: legacyCharInfo({ handle: 'lia', nameKnown: true })
    },
    bunnyboard: { ...board, feedReadThrough: 2 } as typeof board
  })
  return JSON.parse(JSON.stringify({ ...game.getState().toGameSave(),
    playthroughId: '1', saveId: 'auto', saveDate: '2026-11-06' })) as GameSave
}

/** Native loading, including root-slice normalization and the entry's read-mark migration. */
function load(save: GameSave): void {
  resetLoopState()
  game.getState().loadSave(save, record, definitions)
  notes.settleFeedReadMark()
}

/** One protocol reply to the last player comment in the old fixture. */
function answer(): FeedThreadsResponse {
  return {
    replies: [{ to: 'c7', from: key, text: 'A reply' }],
    memories: [{ char: key, type: 'loved', desc: 'The newest exchange' }]
  }
}

/** A controllable model call, to check races without clocks or real network requests. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'bunny-migration-'))
  game.getState().reset()
  resetLoopState()
  resetFeedThreads()
  takeCommented()
  useModsStore.setState({ switches: { on: { bunnyfeeds: true }, options: {} } })
  host.setHookRules({ isOn: id => id === 'bunnyfeeds', order: () => 0 })
  complete = vi.fn(async () => ({ ok: true as const, data: answer() }))
  persisted = undefined
  autosave = vi.fn(async (id, draft) => {
    const value = { ...draft, playthroughId: id, saveId: 'auto', saveDate: '2026-11-06' }
    await writeFile(join(root, 'auto.json'), JSON.stringify(value))
    persisted = JSON.parse(await readFile(join(root, 'auto.json'), 'utf8')) as GameSave
    return { ok: true, data: persisted }
  })
  stubApi({
    llm: { completeMod: complete, cancelMod: async () => ({ ok: true, data: undefined }) },
    saves: { autosave }
  })
  receipts = vi.spyOn(kit, 'saveChanges')
  load(oldSave())
})

afterEach(async () => {
  await writesSettled()
  game.getState().reset()
  resetLoopState()
  vi.restoreAllMocks()
  restoreApi()
  await rm(root, { recursive: true, force: true })
})

describe('old Bunnyfeeds saves', () => {
  it('plays, writes and reloads an old thread without losing its metadata or notifications', async () => {
    const before = notes.feedNotesOf()
    expect(before.map(note => note.comment.id)).toEqual(['friend-r1', 'r1', 'r0'])
    expect(notes.unreadFeedNotesOf()).toBe(1)
    await armFeedThreads()
    await writesSettled()

    expect(autosave).toHaveBeenCalledOnce()
    expect(await receipts.mock.results[0].value).toEqual({ ok: true, data: 'written' })
    const saved = persisted!
    const post = saved.charInfo.poster.feed![0]
    expect(data.postData.read(post)).toEqual({
      threadedThrough: 4,
      heldMemories: [{ charId: 'friend', posterId: 'poster', at: 6,
        type: 'liked', desc: 'A future exchange' }]
    })
    expect(post.ex?.other).toEqual(other.other)
    expect(Object.hasOwn(post, 'threadedThrough')).toBe(false)
    expect(Object.hasOwn(post, 'heldMemories')).toBe(false)
    for (const comment of post.comments!) {
      for (const field of ['charId', 'player', 'read', 'replyTo', 'tags']) {
        expect(Object.hasOwn(comment, field)).toBe(false)
      }
    }
    expect(data.commentData.read(post.comments!.find(one => one.id === 'mine')!))
      .toEqual({ player: true, replyTo: 'stranger', tags: ['friend'] })
    expect(post.comments!.find(one => one.id === 'p0')!.ex?.other).toEqual(other.other)
    expect(saved.ex?.bunnyfeeds.data).toEqual({ readThrough: 2 })
    const memories = saved.charInfo.poster.memories
    expect(memories).toHaveLength(2)
    expect(memories[0]).toEqual({ date: 1, type: 'liked', desc: 'A game memory' })
    expect(memories[1]).toMatchObject({
      type: 'loved', desc: 'The newest exchange, on her post', ex: { bunnyfeeds: { data: null } }
    })

    game.getState().reset()
    resetLoopState()
    load(saved)
    expect(data.postData.read(game.getState().charInfo.poster.feed![0]))
      .toEqual(data.postData.read(post))
    expect(notes.feedNotesOf().map(note => note.comment.id).slice(1))
      .toEqual(before.map(note => note.comment.id))
    expect(notes.unreadFeedNotesOf()).toBe(2)
    const reply = notes.feedNotesOf().find(note => note.comment.id === 'friend-r1')!
    notes.markFeedNoteRead(reply)
    expect(notes.unreadFeedNotesOf()).toBe(1)
    notes.markAllFeedNotesRead()
    expect(notes.unreadFeedNotesOf()).toBe(0)
    await kit.saveChanges('bunnyfeeds', { run: kit.currentRun() })
    await writesSettled()
    load(persisted!)
    expect(notes.unreadFeedNotesOf()).toBe(0)
    expect(data.commentData.read(game.getState().charInfo.poster.feed![0].comments!
      .find(one => one.id === 'friend-r1')!).read).toBe(true)
  })

  it('defers a mid-line reply save and carries it in the next native loop save', async () => {
    const checkpoint = sceneLines('Checkpoint')
    game.setState({ currentSceneTranscript: checkpoint, sceneLog: checkpoint, awaitingInput: true })
    loopState.decisionSave = game.getState().captureScene()
    game.setState({ currentSceneTranscript: [...checkpoint, ...sceneLines('Later')],
      currentLine: sceneLines('Playing')[0], awaitingInput: false, busy: true, streaming: true })

    await armFeedThreads()
    await writesSettled()
    expect(await receipts.mock.results[0].value).toEqual({ ok: true, data: 'deferred' })
    expect(autosave).not.toHaveBeenCalled()
    const comments = game.getState().charInfo.poster.feed![0].comments
    game.setState({ awaitingInput: true, busy: false, streaming: false })
    await writeAutosave(loopState.decisionSave)
    expect(persisted!.charInfo.poster.feed![0].comments).toEqual(comments)
    expect(persisted!.scene?.transcript).toHaveLength(1)
    load(persisted!)
    expect(game.getState().charInfo.poster.feed![0].comments).toEqual(comments)
  })

  it('keeps future memory timing and honors announce on and off after migration', async () => {
    expect(memory.feedStatusLines(5)).toEqual([])
    expect(memory.feedStatusLines(6)).toHaveLength(1)
    useModsStore.setState({ switches: {
      on: { bunnyfeeds: true }, options: { 'bunnyfeeds:announce': false }
    } })
    expect(memory.feedStatusLines(6)).toEqual([])
    memory.fileDueFeedMemories(6)
    expect(game.getState().charInfo.friend.memories).toHaveLength(1)
    expect(data.postData.read(game.getState().charInfo.poster.feed![0]).heldMemories)
      .toBeUndefined()
  })

  it('normalizes malformed metadata and gives an explicit slice priority over legacy keys', () => {
    expect(data.commentData.read({ ex: { bunnyfeeds: { v: '1', data: {
      charId: [], player: 'yes', read: 1, replyTo: 3, tags: ['friend', 2]
    } } } })).toEqual({ tags: ['friend'] })
    expect(data.commentData.read({ player: true,
      ex: { bunnyfeeds: { v: '1', data: {} } } } as never)).toEqual({})
    expect(data.postData.read({ ex: { bunnyfeeds: { v: '1', data: {
      threadedThrough: 'yesterday', heldMemories: [null, { charId: 'poster', at: 'later' }]
    } } } })).toEqual({ heldMemories: [] })
  })
})

describe('refused Bunnyfeeds writes and reply retries', () => {
  it('does nothing when the target post disappeared during the call', async () => {
    const waiting = deferred<Result<FeedThreadsResponse>>()
    complete.mockImplementationOnce(() => waiting.promise)
    const call = armFeedThreads()
    const info = game.getState().charInfo
    game.setState({ charInfo: { ...info, poster: { ...info.poster, feed: [] } } })
    const before = game.getState().charInfo
    waiting.resolve({ ok: true, data: answer() })
    await call
    expect(game.getState().charInfo).toBe(before)
    expect(receipts).not.toHaveBeenCalled()
    expect(memory.holdFeedMemories('poster', 'post', [{
      charId: 'poster', at: 4, type: 'liked', desc: 'gone'
    }])).toMatchObject({ ok: false, error: { code: 'MOD_WRITE_GONE' } })
    leavePlayerComment('poster', 'post', 'gone')
    expect(game.getState().charInfo).toBe(before)
    expect(takeCommented()).toBe(false)
  })

  it('does not write an old answer into a game loaded during its call', async () => {
    const waiting = deferred<Result<FeedThreadsResponse>>()
    complete.mockImplementationOnce(() => waiting.promise)
    const call = armFeedThreads()
    const stale = kit.currentRun()
    const save = oldSave()
    load(save)
    const before = game.getState().charInfo
    waiting.resolve({ ok: true, data: answer() })
    await call
    expect(memory.holdFeedMemories('poster', 'post', [{
      charId: 'poster', at: 4, type: 'liked', desc: 'stale'
    }], stale)).toMatchObject({ ok: false, error: { code: 'MOD_WRITE_STALE' } })
    expect(game.getState().charInfo).toBe(before)
    expect(receipts).not.toHaveBeenCalled()
  })

  it('leaves comments, progress and the visit unchanged when another mod owns comments', async () => {
    const waiting = deferred<Result<FeedThreadsResponse>>()
    complete.mockImplementationOnce(() => waiting.promise)
    const call = armFeedThreads()
    kit.registerHooks('bunny-test-owner', { postComments: { View: () => null } })
    host.setHookRules({ isOn: () => true, order: id => id === 'bunny-test-owner' ? -1 : 0 })
    const before = game.getState().charInfo
    waiting.resolve({ ok: true, data: answer() })
    await call
    const add = vi.spyOn(kit, 'addPostComments')
    leavePlayerComment('poster', 'post', 'refused')
    expect(add.mock.results[0].value).toMatchObject({
      ok: false, error: { code: 'MOD_WRITE_NOT_OWNER' }
    })
    expect(game.getState().charInfo).toBe(before)
    expect(takeCommented()).toBe(false)
    expect(receipts).not.toHaveBeenCalled()
  })

  it('leaves a failed response owed for the next trigger', async () => {
    complete.mockResolvedValueOnce({ ok: false, error: { code: 'CANCELLED', message: 'cancelled' } })
    const before = game.getState().charInfo
    await armFeedThreads()
    expect(game.getState().charInfo).toBe(before)
    expect(receipts).not.toHaveBeenCalled()
    await armFeedThreads()
    await writesSettled()
    expect(complete).toHaveBeenCalledTimes(2)
    expect(autosave).toHaveBeenCalledOnce()
  })

  it('batches askAgain into one following call and answers only what remains owed', async () => {
    const first = deferred<Result<FeedThreadsResponse>>()
    complete.mockImplementationOnce(() => first.promise)
    complete.mockResolvedValueOnce({ ok: true, data: {
      replies: [{ to: 'c8', from: key, text: 'second reply' }], memories: []
    } })
    const call = armFeedThreads('next')
    leavePlayerComment('poster', 'post', 'follow-up')
    void armFeedThreads('next')
    void armFeedThreads('next')
    expect(complete).toHaveBeenCalledOnce()
    first.resolve({ ok: true, data: answer() })
    await call
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(2))
    await writesSettled()
    const post = game.getState().charInfo.poster.feed![0]
    expect(post.comments!.filter(one => data.commentData.read(one).charId === 'poster'))
      .toHaveLength(4)
    await armFeedThreads('next')
    expect(complete).toHaveBeenCalledTimes(2)
  })
})
