import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stampEnrollment, summaryOf } from '@shared/saveRules'
import { statsOfReader } from '@shared/sceneCreator'
import type { GameSave, PlaythroughSummary } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { createdSceneFields } from '../src/renderer/stores/loop/createdScene'
import { useSaveStore } from '../src/renderer/stores/saveStore'
import { enrollment, playthroughRecord, restoreApi, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { setupOfDraft, useSceneCreatorStore } = await import('../src/renderer/stores/sceneCreatorStore')

const saveState = useSaveStore.getState()
const creatorState = useSceneCreatorStore.getState()
const listed: PlaythroughSummary = {
  playthroughId: 'challenge', label: 'Challenge', position: 1, chars: [], date: 1, time: 0,
  savedAt: 1, saveCount: 0, manualCount: 0, hasAutosave: true, unloadable: null
}

beforeEach(() => {
  useGameStore.getState().reset()
  useSceneCreatorStore.setState({ draft: null })
  useSaveStore.setState({ loaded: true, playthroughs: [listed] })
})

afterEach(() => {
  restoreApi()
  useSaveStore.setState(saveState, true)
  useSceneCreatorStore.setState(creatorState, true)
  useGameStore.getState().reset()
})

describe('Scene Creator copies challenge ranks without changing the source save', () => {
  it('keeps mixed challenge and native ranks from an earned save through scene hydration', async () => {
    const stats = { brain: -95, body: -75, heart: 41 }
    const save: GameSave = {
      ...useGameStore.getState().toGameSave(), stats,
      playthroughId: listed.playthroughId, saveId: 'autosave', saveDate: 1
    }
    const record = playthroughRecord()
    useSaveStore.setState({
      listSavesOf: async () => [{ saveId: save.saveId, savedAt: 1, summary: summaryOf(save), record, characters: [], unloadable: null }],
      readSave: async () => ({ save, record, characters: [], unloadable: null })
    })

    await useSceneCreatorStore.getState().start()
    const draft = useSceneCreatorStore.getState().draft!
    expect(draft.reader.tiers).toEqual({ brain: -4, body: -3, heart: 3 })
    const setup = setupOfDraft(draft)
    useGameStore.getState().loadCreatedScene({ setup }, createdSceneFields(setup, {}), {})
    expect(useGameStore.getState().stats).toEqual({ brain: -100, body: -80, heart: 35 })
    expect(save.stats).toEqual({ brain: -95, body: -75, heart: 41 })
  })

  it('keeps the selected negative ranks from an unfinished registration', async () => {
    const pending = stampEnrollment(enrollment({ stats: { brain: -60, body: -30, heart: 0 } }), 1)
    useSaveStore.setState({
      playthroughs: [{ ...listed, enrolling: true }],
      resolveEnrollment: async () => ({ playthroughId: listed.playthroughId, enrollment: pending, characters: [], unloadable: null })
    })

    await useSceneCreatorStore.getState().start()
    const reader = useSceneCreatorStore.getState().draft!.reader
    expect(reader.tiers).toEqual({ brain: -2, body: -1, heart: 1 })
    expect(statsOfReader(reader)).toEqual(pending.stats)
  })
})
