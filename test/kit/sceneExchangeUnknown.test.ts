import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { character, charInfo, restoreApi, stubApi } from '../fixtures'
import type { SaveDraft } from '../../src/shared/types'
import { useGameStore } from '../../src/renderer/stores/gameStore'
import { resetLoopState } from '../../src/renderer/stores/loop/state'
import { writesSettled } from '../../src/renderer/stores/loop/saves'
import { canRecordSceneTurn, openSceneExchange, sceneExchangeContext } from '../../src/renderer/mods/sceneExchange'

vi.mock('../../src/renderer/stores/modsStore', async original => ({ ...await original<object>(), modIsOn: () => true }))
beforeEach(() => {
  useGameStore.getState().reset(); resetLoopState()
  const girl = character({ charId: 'unmet', firstName: 'Unmet', lastName: 'Fixture' })
  useGameStore.setState({ playthroughId: 'synthetic', date: 3, time: 1, awaitingInput: true,
    cast: ['unmet'], chars: ['unmet'], characters: { unmet: girl }, charInfo: { unmet: charInfo({ nameKnown: false }) },
    charKeyToId: { UNMET_FIXTURE: 'unmet' }, slots: ['unmet', null, null], emotions: { unmet: 'neutral' },
    currentSceneTranscript: [{ speaker: 'unmet_fixture', text: 'What are you looking at?' }],
    sceneLog: [{ speaker: 'unmet_fixture', text: 'What are you looking at?' }] })
  stubApi({ saves: { autosave: vi.fn(async (id: string, draft: SaveDraft) => ({ ok: true as const, data: { ...draft, playthroughId: id, saveId: 'auto', saveDate: 0 } })) } })
})
afterEach(async () => { useGameStore.getState().reset(); await writesSettled(); restoreApi() })

it('offers an exchange when the only present character has not introduced herself', () => {
  expect(canRecordSceneTurn()).toBe(true)
  expect(sceneExchangeContext().people.map(person => person.id)).toEqual(['unmet'])
  expect(sceneExchangeContext().onScreen).toEqual(['unmet'])
  expect(sceneExchangeContext().people[0].relationship.nameKnown).toBe(false)
})

it('accepts an unknown participant without marking her name known', () => {
  const exchange = openSceneExchange('fixture')
  expect(exchange).not.toBeNull()
  expect(exchange!.append({ id: 1, participants: ['unmet'], actions: [], lines: [{ charId: 'unmet', emotion: 'happy', text: 'Show me.' }] })).toBe(true)
  expect(useGameStore.getState().charInfo.unmet.nameKnown).toBe(false)
  expect(useGameStore.getState().currentSceneTranscript.at(-1)?.text).toBe('Show me.')
  exchange!.close()
})

it('still excludes characters who departed, are outside the cast, or have no portrait pose', () => {
  useGameStore.setState({ departed: ['unmet'] })
  expect(sceneExchangeContext().people).toEqual([])
  expect(canRecordSceneTurn()).toBe(false)
  useGameStore.setState({ departed: [], cast: [] })
  expect(sceneExchangeContext().people).toEqual([])
    useGameStore.setState(state => ({ cast: ['unmet'], characters: { unmet: { ...state.characters.unmet, pose: '' } } }))
  expect(sceneExchangeContext().people).toEqual([])
})
