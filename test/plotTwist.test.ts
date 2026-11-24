import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activePlotTwist, PLOT_TWIST_LIMIT, PLOT_TWIST_MOD, savedPlotTwist, validatePlotTwist } from '@shared/plotTwists'
import { NO_SWITCHES } from '@shared/mods'
import { stampSave } from '@shared/saveRules'
import type { GameSave, Result, SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { manualSaveDraft, writeAutosave, writesSettled } from '../src/renderer/stores/loop/saves'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { beginPlotTwistEdit, plotTwist, plotTwistEditor, writePlotTwist: savePlotTwist } = await import('../src/renderer/stores/plotTwist')
let owner: object
const writePlotTwist = (value: string) => savePlotTwist(value, owner, plotTwist.read())
const twistOf = (save: SaveDraft) => save.ex?.[PLOT_TWIST_MOD]?.data

const old = 'The observatory has reopened.'
const next = 'A comet will pass the campus tonight.'
const saved: Result<GameSave> = { ok: true, data: { saveId: 'autosave' } as GameSave }
const failed: Result<GameSave> = { ok: false, error: { code: 'SAVE_WRITE_FAILED', message: 'Disk is full.' } }

function autosave(implementation: (id: string, draft: SaveDraft) => Promise<Result<GameSave>> = async () => saved) {
  const fn = vi.fn(implementation)
  stubApi({ saves: { autosave: fn } })
  return fn
}

function reading(): void {
  useGameStore.setState({
    cast: ['char-1'], currentSceneTranscript: sceneLines('One.', 'Two.'),
    sceneLog: sceneLines('One.'), currentLine: sceneLines('One.')[0],
    pendingLines: sceneLines('Two.'), awaitingInput: false
  })
}

function hold() {
  let release = (): void => {}
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}

beforeEach(() => {
  useGameStore.getState().reset()
  useBunnyboardStore.getState().reset()
  resetLoopState()
  useModsStore.setState({ switches: NO_SWITCHES })
  useGameStore.setState({ playthroughId: 'p1' })
  plotTwist.set(old)
  owner = beginPlotTwistEdit()
})

afterEach(async () => {
  await writesSettled()
  restoreApi()
  vi.restoreAllMocks()
})

describe('Plot Twist data', () => {
  it('accepts the boundary, trims new edits, and permits clearing', () => {
    expect(validatePlotTwist('x'.repeat(PLOT_TWIST_LIMIT)).ok).toBe(true)
    expect(validatePlotTwist(`  ${next}  `)).toEqual({ ok: true, data: next })
    expect(validatePlotTwist(' \n ')).toEqual({ ok: true, data: '' })
  })
  it('rejects oversized and non-text edits without truncating them', () => {
    expect(validatePlotTwist('x'.repeat(PLOT_TWIST_LIMIT + 1)).ok).toBe(false)
    expect(validatePlotTwist({ text: next }).ok).toBe(false)
  })
  it('keeps old oversized text but bounds only its prompt copy', () => {
    const legacy = 'x'.repeat(PLOT_TWIST_LIMIT + 5)
    expect(savedPlotTwist(legacy)).toBe(legacy)
    expect(activePlotTwist(legacy, true)).toHaveLength(PLOT_TWIST_LIMIT)
    expect(activePlotTwist(legacy, false)).toBe('')
    expect(savedPlotTwist(undefined)).toBe('')
    expect(savedPlotTwist(42)).toBe('')
  })
  it('round trips legacy text while switched off, and resets for a different old save', () => {
    useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
    const save = stampSave({ ...useGameStore.getState().toGameSave(), ex: undefined, exPlotTwist: old }, 'p1', 'autosave', 1)
    useGameStore.getState().loadSave(save, playthroughRecord({ chars: [] }), {})
    expect(twistOf(useGameStore.getState().toGameSave())).toBe(old)
    expect(useGameStore.getState().toGameSave()).not.toHaveProperty('exPlotTwist')
    delete save.exPlotTwist
    useGameStore.getState().loadSave(save, playthroughRecord({ chars: [] }), {})
    expect(plotTwist.read()).toBe('')
    plotTwist.set(next)
    useGameStore.getState().reset()
    expect(plotTwist.read()).toBe('')
  })
})

describe('Plot Twist migration', () => {
  it.each(['', 'New saved direction'])('prefers a current slice over stale legacy text (%s)', current => {
    const save = stampSave({ ...useGameStore.getState().toGameSave(), exPlotTwist: old,
      ex: { [PLOT_TWIST_MOD]: { v: '1.0.0', data: current } } }, 'p1', 'auto', 1)
    useGameStore.getState().loadSave(save, playthroughRecord({ chars: [] }), {})
    expect(plotTwist.read()).toBe(current)
    expect(twistOf(useGameStore.getState().toGameSave())).toBe(current)
    expect(useGameStore.getState().toGameSave()).not.toHaveProperty('exPlotTwist')
    expect(save.exPlotTwist).toBe(old)
  })
  it('preserves oversized legacy text through load, autosave and reload while off', () => {
    const legacy = ' x'.repeat(PLOT_TWIST_LIMIT)
    useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
    const save = stampSave({ ...useGameStore.getState().toGameSave(), ex: undefined, exPlotTwist: legacy }, 'p1', 'auto', 1)
    useGameStore.getState().loadSave(save, playthroughRecord({ chars: [] }), {})
    const migrated = stampSave(useGameStore.getState().toGameSave(), 'p1', 'auto', 2)
    useGameStore.getState().loadSave(JSON.parse(JSON.stringify(migrated)), playthroughRecord({ chars: [] }), {})
    expect(plotTwist.read()).toBe(legacy)
    expect(activePlotTwist(plotTwist.read(), true)).toHaveLength(PLOT_TWIST_LIMIT)
  })
})

describe('Plot Twist writes', () => {
  it('refuses an editor from a different load even when both saves have identical text', async () => {
    const fn = autosave()
    const save = stampSave(useGameStore.getState().toGameSave(), 'p1', 'autosave', 1)
    useGameStore.getState().loadSave(save, playthroughRecord({ chars: [] }), {})
    expect(plotTwist.read()).toBe(old)
    expect(plotTwistEditor.get()).toBeNull()
    expect((await writePlotTwist(next)).ok).toBe(false)
    expect(fn).not.toHaveBeenCalled()
    owner = beginPlotTwistEdit()
    expect((await writePlotTwist(next)).ok).toBe(true)
  })
  it('refuses a superseded editor value within the same load', async () => {
    const fn = autosave()
    plotTwist.set('A newer edit.')
    expect((await savePlotTwist(next, owner, old)).ok).toBe(false)
    expect(fn).not.toHaveBeenCalled()
    expect(plotTwist.read()).toBe('A newer edit.')
  })
  it('preserves unrelated mod slices while saving and clearing', async () => {
    const untouched = { v: '7.0.0', data: { private: ['keep', 42] } }
    useGameStore.setState({ modData: { 'uninstalled-mod': untouched } })
    const fn = autosave()
    for (const value of [next, '']) {
      expect((await writePlotTwist(value)).ok).toBe(true)
      expect(fn.mock.calls.at(-1)?.[1].ex?.['uninstalled-mod']).toEqual(untouched)
      expect(useGameStore.getState().toGameSave().ex?.['uninstalled-mod']).toEqual(untouched)
    }
  })
  it('saves a landing and commits only after the backend confirms it', async () => {
    const gate = hold()
    const fn = autosave(async () => { await gate.promise; return saved })
    const pending = writePlotTwist(`  ${next}  `)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    expect(plotTwist.read()).toBe(old)
    expect(fn.mock.calls[0][1]).toMatchObject({ scene: null, ex: { [PLOT_TWIST_MOD]: { data: next } } })
    gate.release()
    expect(await pending).toEqual({ ok: true, data: null })
    expect(plotTwist.read()).toBe(next)
  })
  it('clears the autosave and the live direction together', async () => {
    const fn = autosave()
    expect((await writePlotTwist('')).ok).toBe(true)
    expect(twistOf(fn.mock.calls[0][1])).toBe('')
    expect(plotTwist.read()).toBe('')
  })
  it('retains the resumable current line and unread lines', async () => {
    reading()
    const fn = autosave()
    const before = useGameStore.getState().captureScene()
    expect((await writePlotTwist(next)).ok).toBe(true)
    const scene = fn.mock.calls[0][1].scene
    expect(scene?.resumeOnLine).toBe(true)
    expect(scene?.currentLine).toEqual(before?.currentLine)
    expect(scene?.pendingLines).toEqual(before?.pendingLines)
    expect(useGameStore.getState().captureScene()).toEqual(before)
  })
  it('updates a frozen status checkpoint without baking in already-awarded money twice', async () => {
    reading()
    useGameStore.setState({ sceneEnding: true, statusShown: true, money: 30 })
    loopState.statusBase = { ...useGameStore.getState().toGameSave(), money: 20 }
    const fn = autosave()
    expect((await writePlotTwist(next)).ok).toBe(true)
    expect(fn.mock.calls[0][1]).toMatchObject({ money: 20, ex: { [PLOT_TWIST_MOD]: { data: next } } })
    expect(manualSaveDraft()).toMatchObject({ money: 20, ex: { [PLOT_TWIST_MOD]: { data: next } } })
    expect(useGameStore.getState().money).toBe(30)
  })
  it('refuses a status sequence with no resumable base', async () => {
    reading()
    useGameStore.setState({ sceneEnding: true, statusShown: true })
    const fn = autosave()
    expect((await writePlotTwist(next)).ok).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })
  it.each(['result', 'throw'] as const)('leaves the old state intact on backend failure (%s) and allows retry', async mode => {
    const fn = autosave(async () => { if (mode === 'throw') throw Error('Disk is full.'); return failed })
    expect((await writePlotTwist(next)).ok).toBe(false)
    expect(plotTwist.read()).toBe(old)
    fn.mockResolvedValue(saved)
    expect((await writePlotTwist(next)).ok).toBe(true)
  })
  it.each(['busy', 'off', 'no-game', 'too-long', 'error', 'texting'] as const)('refuses unsafe edits: %s', async reason => {
    const fn = autosave()
    if (reason === 'busy') useGameStore.setState({ busy: true })
    if (reason === 'off') useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
    if (reason === 'no-game') useGameStore.setState({ playthroughId: null })
    if (reason === 'error') useGameStore.setState({ turnError: { code: 'FAILED', message: 'Retry the scene.' } })
    if (reason === 'texting') useBunnyboardStore.setState({ typingCharIds: ['char-1'] })
    expect((await writePlotTwist(reason === 'too-long' ? 'x'.repeat(PLOT_TWIST_LIMIT + 1) : next)).ok).toBe(false)
    expect(fn).not.toHaveBeenCalled()
    expect(plotTwist.read()).toBe(old)
  })
  it('serializes with earlier and later autosaves; later writes see the committed text', async () => {
    const gate = hold()
    const fn = autosave()
    fn.mockImplementationOnce(async () => { await gate.promise; return saved })
    const first = writeAutosave(null)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    const edit = writePlotTwist(next)
    const later = writeAutosave(null)
    expect((await writePlotTwist('Overlapping edit')).ok).toBe(false)
    gate.release()
    await Promise.all([first, edit, later])
    expect(fn.mock.calls.map(call => twistOf(call[1]))).toEqual([old, next, next])
  })
  it.each(['run', 'load', 'disabled', 'busy'] as const)('rechecks queued edits after %s changes', async change => {
    const gate = hold()
    const fn = autosave(async () => { await gate.promise; return saved })
    const first = writeAutosave(null)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    const edit = writePlotTwist(next)
    if (change === 'run') resetLoopState()
    if (change === 'load') useGameStore.setState({ loads: useGameStore.getState().loads + 1 })
    if (change === 'disabled') useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
    if (change === 'busy') useGameStore.setState({ busy: true })
    gate.release()
    await first
    expect((await edit).ok).toBe(false)
    expect(fn).toHaveBeenCalledOnce()
    expect(plotTwist.read()).toBe(old)
  })
  it('never applies an in-flight old save result to a newly loaded game', async () => {
    const gate = hold()
    const fn = autosave(async () => { await gate.promise; return saved })
    const edit = writePlotTwist(next)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    resetLoopState()
    useGameStore.setState({ playthroughId: 'p2', loads: useGameStore.getState().loads + 1 })
    plotTwist.set('Another story.')
    gate.release()
    expect((await edit).ok).toBe(false)
    expect(plotTwist.read()).toBe('Another story.')
    expect(fn.mock.calls[0][0]).toBe('p1')
  })
})
