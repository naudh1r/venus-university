import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaythroughSummary, Result } from '@shared/types'
import { useSaveStore, type ResolvedSave } from '../src/renderer/stores/saveStore'
import { character, enrollment, playthroughRecord, restoreApi, stubApi } from './fixtures'
import { stampEnrollment } from '@shared/saveRules'

/**
 * Deleting a save — the one action in the app that destroys a save on purpose. The file
 * that went has to leave the list, and only that one: an entry dropped for a file the disk
 * still holds is a save the player can never reach again from the UI.
 */

const OK: Result<void> = { ok: true, data: undefined }

const PLAYTHROUGH: PlaythroughSummary = {
  playthroughId: 'p1',
  label: 'Playthrough 1',
  position: 1,
  chars: ['char-1'],
  date: 3,
  time: 0,
  savedAt: 0,
  saveCount: 2,
  manualCount: 0,
  hasAutosave: false,
  unloadable: null
}

/** Two saves on screen, which is what makes "the right one went" assertable. */
function resolvedSaves(): ResolvedSave[] {
  return ['s1', 's2'].map((saveId) => ({
    saveId,
    savedAt: 0,
    summary: { date: 3, time: 0, graduationSeen: false, midScene: false, bg: null },
    record: playthroughRecord({ chars: ['char-1'] }),
    characters: [],
    unloadable: null
  }))
}

beforeEach(() => {
  useSaveStore.setState({
    playthroughs: [PLAYTHROUGH],
    characters: new Map(),
    selected: PLAYTHROUGH,
    saves: resolvedSaves(),
    loading: false
  })
})

afterEach(() => {
  restoreApi()
  vi.restoreAllMocks()
})

describe('removeSave', () => {
  it('drops exactly the deleted save from the list', async () => {
    const remove = vi.fn(async () => OK)
    stubApi({ saves: { delete: remove } })

    await useSaveStore.getState().removeSave('s1')
    expect(remove).toHaveBeenCalledWith('p1', 's1', undefined)
    expect(useSaveStore.getState().saves.map((entry) => entry.saveId)).toEqual(['s2'])
  })
})

describe('continued registration switches', () => {
  it.each([{ selected: ['character-dynamics'] }, { selected: [] }])('reads the existing record instead of stale registration or global choices: $selected', async ({ selected }) => {
    const saved = stampEnrollment(enrollment({ mods: ['stale-mod'], continued: {
      id: '200', index: 1, alumni: [], priorProfiles: {}, pursuits: {}, carry: {} as never
    } }), 1)
    const record = playthroughRecord({ mods: selected })
    stubApi({ saves: {
      enrollment: async () => ({ ok: true, data: saved }),
      list: async () => ({ ok: true, data: { record, error: null, saves: [] } })
    } })
    useSaveStore.setState({ characters: new Map([['a', character({ charId: 'a' })]]) })
    const resumed = await useSaveStore.getState().resolveEnrollment(PLAYTHROUGH)
    expect(resumed?.enrollment.mods).toEqual(selected)
    expect(saved.mods).toEqual(['stale-mod'])
  })
})
