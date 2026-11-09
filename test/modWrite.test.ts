import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMods, type ModDef } from '@shared/mods'
import type { GameSave, Result, SaveDraft } from '@shared/types'
import { playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

/**
 * A mod's write to its own save data, and to that of the mods it requires: refused, writing
 * nothing, anywhere a save could not be taken or the edit no longer holds; otherwise written over
 * the autosave behind every write already queued, and into the live game only once it is on disk.
 */

stubApi({ jobs: { onProgress: () => () => {} } })
// The kit entry loads the stores, which read the bridge stubbed above, so it loads after it.
const kit = await import('@vx/modkit/renderer')
const { manualSaveOffer, prepareAutosave, writeAutosave, writeManualSave, writeModSlices, writesSettled } = await import(
  '../src/renderer/stores/loop/saves'
)
const { loopState, resetLoopState } = await import('../src/renderer/stores/loop/state')
const { useBunnyboardStore } = await import('../src/renderer/stores/bunnyboardStore')
const { useGameStore } = await import('../src/renderer/stores/gameStore')

function def(id: string, version: string, extra: Partial<ModDef> = {}): ModDef {
  return { id, name: id, author: 'test', version, scope: 'anytime', defaultOn: true, blurb: '', ...extra }
}

beforeAll(() =>
  installMods([
    def('writer-mod', '1.2.0', { requires: ['lib-mod'] }),
    def('lib-mod', '0.3.0'),
    def('other-mod', '2.0.0'),
    def('off-mod', '1.0.0', { defaultOn: false }),
    def('game-mod', '1.0.0', { scope: 'playthrough' })
  ])
)

const saved: Result<GameSave> = { ok: true, data: { saveId: 'auto' } as GameSave }
const FAILED: Result<GameSave> = { ok: false, error: { code: 'SAVE_WRITE_FAILED', message: 'disk' } }

/** The autosave channel, recording each draft it was handed, answering `answer` once `held` lets it. */
function stubAutosave(answer: Result<GameSave> = saved, held: Promise<void> = Promise.resolve()) {
  const order: string[] = []
  const autosave = vi.fn(async (_playthroughId: string, draft: SaveDraft) => {
    await held
    order.push(JSON.stringify(draft.ex?.['writer-mod']?.data ?? null))
    return answer
  })
  stubApi({ saves: { autosave } as never })
  return { autosave, order, draft: (call: number) => autosave.mock.calls[call]?.[1] as SaveDraft }
}

/** A gate a stubbed write waits on. */
function gate(): { held: Promise<void>; release: () => void } {
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  return { held, release }
}

beforeEach(() => {
  useGameStore.getState().reset()
  useBunnyboardStore.getState().reset()
  resetLoopState()
  useGameStore.setState({ playthroughId: 'p1' })
})

afterEach(async () => {
  await writesSettled()
  restoreApi()
  vi.restoreAllMocks()
})

describe('writeModSlices refusals', () => {
  it.each([
    ['MOD_WRITE_WAIT', 'writer-mod', { 'writer-mod': 1 }, () => useGameStore.setState({ busy: true })],
    ['MOD_WRITE_OFF', 'off-mod', { 'off-mod': 1 }, () => {}],
    ['MOD_WRITE_FOREIGN', 'writer-mod', { 'writer-mod': 1, 'other-mod': 1 }, () => {}],
    ['MOD_WRITE_NO_GAME', 'writer-mod', { 'writer-mod': 1 }, () => useGameStore.setState({ playthroughId: null })]
  ] as const)('refuses with %s, writing nothing', async (code, modId, next, arrange) => {
    const { autosave } = stubAutosave()
    useGameStore.setState({ modValues: { 'writer-mod': 0 } })
    arrange()

    const result = await writeModSlices(modId, next)
    expect(result.ok ? null : result.error.code).toBe(code)
    expect(autosave).not.toHaveBeenCalled()
    expect(useGameStore.getState().modValues).toEqual({ 'writer-mod': 0 })
  })

  it('refuses an edit made from a value that is no longer the live one', async () => {
    const { autosave } = stubAutosave()
    const before = { count: 1 }
    useGameStore.setState({ modValues: { 'writer-mod': { count: 1 } } })

    const result = await kit.writeModField('writer-mod', { count: 2 }, { expect: before })
    expect(result.ok ? null : result.error.code).toBe('MOD_WRITE_STALE')
    expect(autosave).not.toHaveBeenCalled()
  })

  it('judges a playthrough mod by the game it is loaded into, not by its switch', async () => {
    const { autosave } = stubAutosave()
    loopState.record = playthroughRecord({ mods: [] })
    const off = await writeModSlices('game-mod', { 'game-mod': 1 })
    expect(off.ok ? null : off.error.code).toBe('MOD_WRITE_OFF')
    expect(autosave).not.toHaveBeenCalled()

    loopState.record = playthroughRecord({ mods: ['game-mod'] })
    const on = await writeModSlices('game-mod', { 'game-mod': 1 })
    expect(on.ok).toBe(true)
    expect(autosave).toHaveBeenCalledOnce()
  })

  it('answers a failed disk write with its error and changes nothing', async () => {
    stubAutosave(FAILED)
    useGameStore.setState({ modValues: { 'writer-mod': 0 } })

    const result = await writeModSlices('writer-mod', { 'writer-mod': 1 })
    expect(result.ok ? null : result.error.code).toBe('SAVE_WRITE_FAILED')
    expect(useGameStore.getState().modValues).toEqual({ 'writer-mod': 0 })
  })
})

describe('writeModSlices', () => {
  it('keeps a committed mod field when an earlier scene decision flushes late', async () => {
    const { autosave, draft } = stubAutosave()
    useGameStore.setState({ modValues: { 'writer-mod': { count: 1 } } })
    const flush = prepareAutosave(null)

    expect((await kit.writeModField('writer-mod', { count: 2 })).ok).toBe(true)
    await flush()

    expect(autosave).toHaveBeenCalledOnce()
    expect(draft(0).ex?.['writer-mod']?.data).toEqual({ count: 2 })
    expect(useGameStore.getState().modValues['writer-mod']).toEqual({ count: 2 })
  })

  it('lands behind the write queued before it, keeps the base slices, and changes the value only once on disk', async () => {
    const { held, release } = gate()
    const { autosave, order, draft } = stubAutosave(saved, held)
    const live = { count: 1 }
    useGameStore.setState({
      modData: { 'stranger-mod': { v: '9.0.0', data: 'kept' } },
      modValues: { 'writer-mod': live },
      cast: ['char-1'],
      currentSceneTranscript: sceneLines('Hello.'),
      sceneLog: sceneLines('Hello.'),
      currentLine: { speaker: '', text: 'Hello.' },
      pendingLines: [],
      awaitingInput: true
    })

    const first = writeAutosave(null)
    const write = writeModSlices('writer-mod', { 'writer-mod': { count: 2 } }, { expect: { 'writer-mod': live } })
    await Promise.resolve()
    expect(autosave).toHaveBeenCalledTimes(1)
    expect(useGameStore.getState().modValues['writer-mod']).toBe(live)

    release()
    await first
    expect(await write).toEqual({ ok: true, data: null })
    // The autosave queued first carries the value as it stood; the mod's write lands after it.
    expect(order).toEqual(['{"count":1}', '{"count":2}'])
    expect(draft(1).ex).toEqual({
      'stranger-mod': { v: '9.0.0', data: 'kept' },
      'writer-mod': { v: '1.2.0', data: { count: 2 } }
    })
    // The scene on screen, as a manual save would record it.
    expect(draft(1).scene?.sceneLog).toEqual(sceneLines('Hello.'))
    expect(useGameStore.getState().modValues['writer-mod']).toEqual({ count: 2 })
  })

  it('writes between scenes with no scene, and patches the frozen status base', async () => {
    const { draft } = stubAutosave()
    loopState.statusBase = { ...useGameStore.getState().toGameSave(), ex: { 'stranger-mod': { v: '1.0.0', data: 1 } } }

    expect((await kit.writeModField('writer-mod', 'hi')).ok).toBe(true)
    expect(draft(0).scene).toBeNull()
    expect(loopState.statusBase?.ex).toEqual({
      'stranger-mod': { v: '1.0.0', data: 1 },
      'writer-mod': { v: '1.2.0', data: 'hi' }
    })
  })

  it('holds a manual save off while it is being written', async () => {
    const { held, release } = gate()
    stubAutosave(saved, held)

    const write = writeModSlices('writer-mod', { 'writer-mod': 1 })
    expect(manualSaveOffer()).toBe('waiting')
    expect(kit.safePoint()).toBe('waiting')
    await expect(writeManualSave(1)).resolves.toBe(false)

    release()
    expect((await write).ok).toBe(true)
    expect(manualSaveOffer()).toBe('open')
  })

  it("writes the caller's own data and a required mod's in one save", async () => {
    const { autosave, draft } = stubAutosave()

    const result = await kit.writeModFields('writer-mod', { 'writer-mod': 'a', 'lib-mod': 'b' })
    expect(result.ok).toBe(true)
    expect(autosave).toHaveBeenCalledTimes(1)
    expect(draft(0).ex).toEqual({
      'writer-mod': { v: '1.2.0', data: 'a' },
      'lib-mod': { v: '0.3.0', data: 'b' }
    })
    expect(useGameStore.getState().modValues).toEqual({ 'writer-mod': 'a', 'lib-mod': 'b' })
  })
})
