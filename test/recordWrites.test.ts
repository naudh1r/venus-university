import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMods, type ModDef } from '@shared/mods'
import type { PostComment } from '@shared/postComments'
import type { CharMemory, GameSave, Result, SaveDraft, SocialPost } from '@shared/types'
import { charInfo, restoreApi, sceneLines, stubApi } from './fixtures'

// A field another file adds to the comment, as Bunnyfeeds does on main: core must still
// typecheck with it, and a comment holding such a field is refused below.
declare module '@shared/postComments' { interface PostComment { addedElsewhere?: string } }

/**
 * A mod's writes to the game's own records: its slice on a live text, post or comment, with the
 * record's own fields and every other mod's slice kept; the comments it adds under a post and the
 * memories it adds for her; and `saveChanges`, which writes them now or leaves them to the loop's
 * next save while a scene is not at a decision point. A refusal changes nothing.
 */

stubApi({ jobs: { onProgress: () => () => {} } })
// The kit entry loads the stores, which read the bridge stubbed above, so it loads after it.
const kit = await import('@vx/modkit/renderer')
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { writesSettled } = await import('../src/renderer/stores/loop/saves')
const { currentRun, loopState, resetLoopState } = await import('../src/renderer/stores/loop/state')

function def(id: string, extra: Partial<ModDef> = {}): ModDef {
  return { id, name: id, author: 'test', version: '1.2.0', scope: 'anytime', defaultOn: true, blurb: '', ...extra }
}

beforeAll(() => {
  installMods([def('rec-writer'), def('rec-other'), def('rec-off', { defaultOn: false })])
  kit.registerHooks('rec-writer', { postComments: { View: () => null } })
})

const field = kit.recordField<{ n: number } | null>('rec-writer', {
  empty: null,
  legacy: ['oldN'],
  normalize: (stored, legacy) => (stored !== undefined ? (stored as { n: number }) : { n: Number(legacy.oldN) })
})
const offField = kit.recordField<number>('rec-off', { empty: 0 })

const other = { 'rec-other': { v: '1.0.0', data: { kept: true } } }

function post(over: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'p1',
    text: 'At the lake',
    date: 3,
    time: 0,
    likes: 4,
    comments: [{ id: 'c1', handle: 'sun', emoji: '', text: 'cute', at: 12, ex: other }],
    ex: other,
    ...over
  }
}

/** The autosave channel, recording each draft it was handed. */
function stubAutosave() {
  const autosave = vi.fn(async (_playthroughId: string, _draft: SaveDraft): Promise<Result<GameSave>> => ({
    ok: true,
    data: { saveId: 'auto' } as GameSave
  }))
  stubApi({ saves: { autosave } as never })
  return { autosave, draft: (call: number) => autosave.mock.calls[call]?.[1] as SaveDraft }
}

const message = () => useGameStore.getState().bunnyboard.conversations.girl.messages[0]
const herPost = () => useGameStore.getState().charInfo.girl.feed![0]
const code = (result: Result<unknown>) => (result.ok ? null : result.error.code)

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  const game = useGameStore.getState()
  useGameStore.setState({
    playthroughId: 'p1',
    charInfo: { girl: charInfo({ feed: [post()] }) },
    bunnyboard: {
      ...game.bunnyboard,
      conversations: {
        girl: {
          charId: 'girl',
          messages: [{ id: 'm1', sender: 'contact', text: 'Hi', date: 3, time: 0, oldN: '2', ex: other } as never],
          unread: 0,
          summary: null
        }
      }
    }
  })
})

afterEach(async () => {
  await writesSettled()
  restoreApi()
  vi.restoreAllMocks()
})

describe('a record field on a live record', () => {
  it("sets the mod's slice on a text, a post and a comment, keeping their own fields and the other mods' slices", () => {
    expect(field.read(message())).toEqual({ n: 2 })

    expect(field.update({ kind: 'message', charId: 'girl', messageId: 'm1' }, (now) => ({ n: (now?.n ?? 0) + 1 }))).toEqual({ ok: true, data: null })
    expect(field.set({ kind: 'post', charId: 'girl', postId: 'p1' }, { n: 7 })).toEqual({ ok: true, data: null })
    expect(field.set({ kind: 'comment', charId: 'girl', postId: 'p1', commentId: 'c1' }, { n: 9 })).toEqual({ ok: true, data: null })

    const saved = useGameStore.getState().toGameSave()
    const text = saved.bunnyboard.conversations.girl.messages[0]
    expect(text).toMatchObject({ id: 'm1', text: 'Hi', ex: { ...other, 'rec-writer': { v: '1.2.0', data: { n: 3 } } } })
    // The legacy key goes once the mod's own slice holds the value.
    expect(text).not.toHaveProperty('oldN')
    const kept = saved.charInfo.girl.feed![0]
    expect(kept).toMatchObject({ id: 'p1', text: 'At the lake', likes: 4, ex: { ...other, 'rec-writer': { data: { n: 7 } } } })
    expect(kept.comments).toEqual([
      { id: 'c1', handle: 'sun', emoji: '', text: 'cute', at: 12, ex: { ...other, 'rec-writer': { v: '1.2.0', data: { n: 9 } } } }
    ])
  })

  it('leaves the record as it is where the change answers undefined', () => {
    const before = message()
    expect(field.update({ kind: 'message', charId: 'girl', messageId: 'm1' }, () => undefined)).toEqual({ ok: true, data: null })
    expect(message()).toBe(before)
  })

  it.each([
    ['MOD_WRITE_GONE', () => field.set({ kind: 'post', charId: 'girl', postId: 'gone' }, { n: 1 })],
    ['MOD_WRITE_GONE', () => field.set({ kind: 'comment', charId: 'girl', postId: 'p1', commentId: 'gone' }, { n: 1 })],
    ['MOD_WRITE_GONE', () => field.set({ kind: 'message', charId: 'nobody', messageId: 'm1' }, { n: 1 })],
    ['MOD_WRITE_OFF', () => offField.set({ kind: 'post', charId: 'girl', postId: 'p1' }, 1)],
    ['MOD_WRITE_NO_GAME', () => (useGameStore.setState({ playthroughId: null }), field.set({ kind: 'post', charId: 'girl', postId: 'p1' }, { n: 1 }))],
    [
      'MOD_WRITE_STALE',
      () => {
        const run = currentRun()
        resetLoopState()
        return field.set({ kind: 'post', charId: 'girl', postId: 'p1' }, { n: 1 }, { run })
      }
    ]
  ] as const)('refuses with %s, changing nothing', (expected, write) => {
    const before = useGameStore.getState().charInfo
    expect(code(write())).toBe(expected)
    expect(useGameStore.getState().charInfo).toBe(before)
  })
})

describe('addPostComments', () => {
  const comment = (id: string, extra: object = {}): PostComment => ({ id, handle: 'him', emoji: '', text: 'hey', at: 13, ...extra })

  it('adds comments after the ones there, for the mod that draws them', () => {
    const mine = field.with(comment('c2'), { n: 1 })
    expect(kit.addPostComments('rec-writer', { charId: 'girl', postId: 'p1' }, [mine])).toEqual({ ok: true, data: null })
    expect(herPost().comments!.map((one) => one.id)).toEqual(['c1', 'c2'])
    expect(field.read(herPost().comments![1])).toEqual({ n: 1 })
  })

  it.each([
    ['MOD_WRITE_NOT_OWNER', 'rec-other', [comment('c2')]],
    ['MOD_WRITE_INVALID', 'rec-writer', [comment('c2', { player: true })]],
    ['MOD_WRITE_INVALID', 'rec-writer', [comment('c2', { addedElsewhere: 'x' })]],
    ['MOD_WRITE_INVALID', 'rec-writer', [comment('c2', { ex: other })]],
    ['MOD_WRITE_INVALID', 'rec-writer', [comment('c2', { at: 'soon' })]],
    ['MOD_WRITE_INVALID', 'rec-writer', [comment('c2'), comment('c2')]],
    ['MOD_WRITE_INVALID', 'rec-writer', [comment('c1')]]
  ] as const)('refuses with %s, changing nothing', (expected, modId, comments) => {
    const before = herPost()
    expect(code(kit.addPostComments(modId, { charId: 'girl', postId: 'p1' }, comments as never))).toBe(expected)
    expect(herPost()).toBe(before)
  })
})

describe('addMemory', () => {
  const memory = (desc: string): CharMemory => ({ date: 4, type: 'liked', desc })
  const hers = () => useGameStore.getState().charInfo.girl.memories

  it("marks the memory as the mod's, and replaces only memories the mod marked", () => {
    useGameStore.setState({ charInfo: { girl: charInfo({ memories: [memory('He laughed, on the feed')] }) } })

    expect(kit.addMemory('rec-writer', 'girl', memory('He commented, on her post'))).toEqual({ ok: true, data: null })
    const onFeed = (one: Readonly<CharMemory>) => one.desc.endsWith('post')
    expect(kit.addMemory('rec-writer', 'girl', memory('He came back, on her post'), { replacing: onFeed })).toEqual({ ok: true, data: null })
    // The memory core filed stays, matching or not: the mod is asked only about its own.
    expect(kit.addMemory('rec-writer', 'girl', memory('Again, on her post'), { replacing: () => true })).toEqual({ ok: true, data: null })

    expect(hers()).toEqual([
      memory('He laughed, on the feed'),
      { ...memory('Again, on her post'), ex: { 'rec-writer': { v: '1.2.0', data: null } } }
    ])
  })

  // A damaged save can hold an `ex` that is not an object; it counts as unmarked.
  it.each([undefined, {}, null, 'x'])('replaces matching unmarked memories with ex %j', (ex) => {
    const legacy = { ...memory('legacy'), ex: ex as CharMemory['ex'] }
    const kept = memory('core')
    useGameStore.setState({ charInfo: { girl: charInfo({ memories: [legacy, kept] }) } })
    const replacingUnmarked = vi.fn((one: Readonly<CharMemory>) => one.desc === 'legacy')

    expect(kit.addMemory('rec-writer', 'girl', memory('new'), { replacingUnmarked }))
      .toEqual({ ok: true, data: null })

    expect(replacingUnmarked.mock.calls.map(([one]) => one)).toEqual([legacy, kept])
    expect(hers()).toEqual([
      kept,
      { ...memory('new'), ex: { 'rec-writer': { v: '1.2.0', data: null } } }
    ])
  })

  it('never offers memories with any slice to replacingUnmarked', () => {
    const own = { ...memory('own'), ex: { 'rec-writer': { v: '1', data: null } } }
    const foreign = { ...memory('foreign'), ex: other }
    useGameStore.setState({ charInfo: { girl: charInfo({ memories: [own, foreign] }) } })
    const replacingUnmarked = vi.fn(() => true)

    expect(kit.addMemory('rec-writer', 'girl', memory('new'), { replacingUnmarked }))
      .toEqual({ ok: true, data: null })

    expect(replacingUnmarked).not.toHaveBeenCalled()
    expect(hers().slice(0, 2)).toEqual([own, foreign])
  })

  it('replaces owned and unmarked memories in one write, with separate matchers', () => {
    const legacy = memory('legacy')
    const kept = memory('core')
    const own = { ...memory('own'), ex: { 'rec-writer': { v: '1', data: null } } }
    const foreign = { ...memory('foreign'), ex: other }
    useGameStore.setState({
      charInfo: { girl: charInfo({ memories: [legacy, kept, own, foreign] }) }
    })
    const replacing = vi.fn(() => true)
    const replacingUnmarked = vi.fn((one: Readonly<CharMemory>) => one.desc === 'legacy')
    const changed = vi.fn()
    const stop = useGameStore.subscribe(changed)

    const result = kit.addMemory('rec-writer', 'girl', memory('new'), { replacing, replacingUnmarked })
    stop()

    expect(result).toEqual({ ok: true, data: null })
    expect(replacing.mock.calls).toEqual([[own]])
    expect(replacingUnmarked.mock.calls.map(([one]) => one)).toEqual([legacy, kept])
    expect(changed).toHaveBeenCalledOnce()
    expect(hers()).toEqual([
      kept, foreign,
      { ...memory('new'), ex: { 'rec-writer': { v: '1.2.0', data: null } } }
    ])
  })

  it('refuses a stale unmarked replacement without overwriting the matcher\'s change', () => {
    const legacy = memory('legacy')
    useGameStore.setState({ charInfo: { girl: charInfo({ memories: [legacy] }) } })
    let changed: ReturnType<typeof useGameStore.getState> | undefined
    const replacingUnmarked = () => {
      const info = useGameStore.getState().charInfo.girl
      useGameStore.setState({
        charInfo: { girl: { ...info, memories: [...info.memories, memory('concurrent')] } }
      })
      changed = useGameStore.getState()
      return true
    }

    expect(code(kit.addMemory('rec-writer', 'girl', memory('new'), { replacingUnmarked })))
      .toBe('MOD_WRITE_STALE')
    expect(useGameStore.getState()).toEqual(changed)
    expect(useGameStore.getState().charInfo).toBe(changed?.charInfo)
    expect(hers()).toEqual([legacy, memory('concurrent')])
  })

  it.each([
    ['MOD_WRITE_INVALID', 'rec-writer', 'girl', { ...memory('x'), type: 'adored' }],
    ['MOD_WRITE_INVALID', 'rec-writer', 'girl', { ...memory('x'), breakDays: 2 }],
    ['MOD_WRITE_INVALID', 'rec-writer', 'girl', { ...memory('x'), ex: other }],
    ['MOD_WRITE_INVALID', 'rec-writer', 'girl', memory('  ')],
    ['MOD_WRITE_GONE', 'rec-writer', 'nobody', memory('x')],
    ['MOD_WRITE_OFF', 'rec-off', 'girl', memory('x')]
  ] as const)('refuses with %s, changing nothing', (expected, modId, charId, entry) => {
    const before = useGameStore.getState().charInfo
    expect(code(kit.addMemory(modId, charId, entry as CharMemory))).toBe(expected)
    expect(useGameStore.getState().charInfo).toBe(before)
  })
})

describe('saveChanges', () => {
  /** A scene under way, its decision point marked, the reader at his turn. */
  function sceneAtTurn(): void {
    const lines = sceneLines('She deals the cards.')
    useGameStore.setState({ currentSceneTranscript: lines, sceneLog: lines, awaitingInput: true })
    loopState.decisionSave = useGameStore.getState().captureScene()
  }

  it('writes the live game with no scene outside one', async () => {
    const { draft } = stubAutosave()
    field.set({ kind: 'post', charId: 'girl', postId: 'p1' }, { n: 5 })

    expect(await kit.saveChanges('rec-writer')).toEqual({ ok: true, data: 'written' })
    expect(draft(0).scene).toBeNull()
    expect(field.read(draft(0).charInfo.girl.feed![0])).toEqual({ n: 5 })
  })

  it("writes the scene's decision point at the reader's turn, and nothing while a line plays", async () => {
    const { autosave, draft } = stubAutosave()
    sceneAtTurn()
    const point = loopState.decisionSave
    useGameStore.setState({ currentSceneTranscript: [...useGameStore.getState().currentSceneTranscript, ...sceneLines('A new line.')] })

    expect(await kit.saveChanges('rec-writer')).toEqual({ ok: true, data: 'written' })
    expect(draft(0).scene).toBe(point)

    useGameStore.setState({ awaitingInput: false })
    expect(await kit.saveChanges('rec-writer')).toEqual({ ok: true, data: 'deferred' })
    useGameStore.setState({ awaitingInput: true, sceneEnding: true })
    expect(await kit.saveChanges('rec-writer')).toEqual({ ok: true, data: 'deferred' })
    expect(autosave).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['MOD_WRITE_OFF', 'rec-off', () => {}],
    ['MOD_WRITE_NO_GAME', 'rec-writer', () => useGameStore.setState({ playthroughId: null })],
    ['MOD_WRITE_NO_GAME', 'rec-writer', () => useGameStore.setState({ activeGameOver: 'broke' as never })]
  ] as const)('refuses with %s, writing nothing', async (expected, modId, arrange) => {
    const { autosave } = stubAutosave()
    arrange()
    expect(code(await kit.saveChanges(modId))).toBe(expected)
    expect(autosave).not.toHaveBeenCalled()
  })

  it('refuses a run that has been left, and a write whose turn comes after the game was left', async () => {
    const { autosave } = stubAutosave()
    const run = currentRun()
    resetLoopState()
    expect(code(await kit.saveChanges('rec-writer', { run }))).toBe('MOD_WRITE_STALE')

    const write = kit.saveChanges('rec-writer')
    resetLoopState()
    expect(code(await write)).toBe('MOD_WRITE_STALE')
    expect(autosave).not.toHaveBeenCalled()
  })
})
