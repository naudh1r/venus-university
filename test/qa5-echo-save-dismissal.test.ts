import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeEcho, renameEcho } from '@shared/echo'
import type { GameSave, Result, SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { writeAutosave, writeEcho, writesSettled } from '../src/renderer/stores/loop/saves'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { restoreApi, stubApi } from './fixtures'

const game = () => useGameStore.getState()
let saved: SaveDraft[]
const finish = (draft: SaveDraft): Result<GameSave> => ({ ok: true, data: { ...draft, playthroughId: 'echo-save', saveId: 'autosave', saveDate: 0 } })
beforeEach(() => {
  game().reset(); resetLoopState(); saved = []
  useModsStore.setState({ switches: { on: { echo: true }, options: {} } })
  useGameStore.setState({ playthroughId: 'echo-save', date: 7, awaitingInput: true,
    exEcho: normalizeEcho({ player: { aspect: 'daylark', name: 'First Light' }, girls: {} }) })
  stubApi({ saves: { autosave: async (_id, draft) => { saved.push(structuredClone(draft)); return finish(draft) } } })
})
afterEach(async () => { await writesSettled(); restoreApi(); vi.restoreAllMocks() })

describe('QA5: closing the Echo manager across an already-started save', () => {
  it('keeps an acknowledged rename consistent between live state and the next ordinary save after close', async () => {
    const before = game().exEcho, next = renameEcho(before, 'player', 'Sunlit Promise')
    let active = true
    let resolve!: (result: Result<GameSave>) => void
    const save = vi.spyOn(window.api.saves, 'autosave').mockImplementationOnce(async (_id, draft) => {
      saved.push(structuredClone(draft))
      return new Promise<Result<GameSave>>(r => { resolve = r })
    })
    const pending = writeEcho(next, before, () => active).then(() => null, error => error as Error)
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
    // EchoPanel's always-enabled X/Escape sets live.current=false even while commit awaits.
    active = false
    resolve(finish(saved[0]))
    const error = await pending
    expect(error).toBeNull()
    expect(saved[0].exEcho?.player?.name).toBe('Sunlit Promise')
    expect.soft(game().exEcho).toEqual(saved[0].exEcho)
    // The next ordinary autosave must retain the acknowledged edit.
    await writeAutosave(null)
    expect.soft(saved.at(-1)?.exEcho).toEqual(saved[0].exEcho)
  })

  it('control: a manager kept open applies the rename and retains it in the next save', async () => {
    const before = game().exEcho, next = renameEcho(before, 'player', 'Sunlit Promise')
    await writeEcho(next, before, () => true)
    await writeAutosave(null)
    expect(game().exEcho.player?.name).toBe('Sunlit Promise')
    expect(saved).toHaveLength(2)
    expect(saved[1].exEcho).toEqual(saved[0].exEcho)
  })

  it('control: a dismissal before save starts changes neither disk nor live state', async () => {
    const before = game().exEcho, next = renameEcho(before, 'player', 'Sunlit Promise')
    await expect(writeEcho(next, before, () => false)).rejects.toThrow('safe save')
    expect(saved).toHaveLength(0)
    expect(game().exEcho).toBe(before)
  })

  it.each(['different playthrough', 'reloaded same playthrough'])('does not apply a late acknowledgement to a %s', async kind => {
    const before = game().exEcho, next = renameEcho(before, 'player', 'Sunlit Promise')
    let resolve!: (result: Result<GameSave>) => void
    const save = vi.spyOn(window.api.saves, 'autosave').mockImplementationOnce(async (_id, draft) => {
      saved.push(structuredClone(draft))
      return new Promise<Result<GameSave>>(r => { resolve = r })
    })
    const pending = writeEcho(next, before, () => true).then(() => null, error => error as Error)
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
    if (kind === 'different playthrough') useGameStore.setState({ playthroughId: 'other-save' })
    else useGameStore.setState({ loads: game().loads + 1 })
    resolve(finish(saved[0]))
    expect((await pending)?.message).toBe('The game changed. Reopen the Echo.')
    expect(game().exEcho).toBe(before)
  })

  it('does not apply an edit when storage rejects it after the editor closes', async () => {
    const before = game().exEcho, next = renameEcho(before, 'player', 'Sunlit Promise')
    let active = true
    vi.spyOn(window.api.saves, 'autosave').mockImplementationOnce(async () => {
      active = false
      return { ok: false, error: { code: 'WRITE_FAILED', message: 'Disk write failed.' } }
    })
    await expect(writeEcho(next, before, () => active)).rejects.toThrow('Disk write failed.')
    expect(game().exEcho).toBe(before)
  })
})
