import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GlobalTextId, TextEdits } from '@shared/promptText'
import type { StructuredRequest } from '@shared/types'
import {
  transferMajorRequest, transferStudentRequest, transferInterestRequest,
  transferMajorClassesRequest, type TransferContext
} from '../src/renderer/stores/transferCompose'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { character, restoreApi, stubApi } from './fixtures'

// This test exercises the transfer request boundary; the native menu's eligibility gate is separate.
vi.mock('../src/renderer/stores/loop/saves', () => ({ milestonesOffer: () => 'open' }))
stubApi({ jobs: { onProgress: () => () => {} } })
const { startTransfer, resetTransfers } = await import('../src/renderer/stores/loop/transfers')
const { registerHooks, setHookRules } = await import('../src/renderer/mods/hooks')

const edits: TextEdits<GlobalTextId> = {
  'newgame.profiles.system': 'PROFILE_SYSTEM_EDIT',
  'newgame.profiles.additions': 'PROFILE_ADDITION',
  'newgame.secrets.system': 'SECRET_SYSTEM_EDIT',
  'newgame.classes.instructions': 'COURSE_INSTRUCTION_EDIT'
}
const context: TransferContext = {
  character: character(), season: 'spring', date: 7, time: 0, chars: [], charInfo: {},
  pending: [], classes: {}, taken: [], playerSchedule: {}, jobClosures: undefined,
  springBreakAway: null, setting: 'Fixture campus'
}

afterEach(() => {
  resetTransfers()
  useGameStore.getState().reset()
  setHookRules({ isOn: () => false, order: () => 0 })
  restoreApi()
  vi.restoreAllMocks()
})

describe('transfer generation uses the same prompt edits as New Game', () => {
  const cases = [
    ['major', (ctx: TransferContext) => transferMajorRequest(ctx), 'system', 'PROFILE_SYSTEM_EDIT'],
    ['student', (ctx: TransferContext) => transferStudentRequest(ctx, 'Art'), 'system', 'SECRET_SYSTEM_EDIT'],
    ['interest', (ctx: TransferContext) => transferInterestRequest(ctx, 'Art'), 'user', 'COURSE_INSTRUCTION_EDIT'],
    ['major classes', (ctx: TransferContext) => transferMajorClassesRequest(ctx, 'Art', 2), 'user', 'COURSE_INSTRUCTION_EDIT']
  ] as const
  for (const [name, build, field, marker] of cases) {
    it(name, () => {
      const original = build(context), edited = build({ ...context, textEdits: edits })
      expect(edited[field]).toContain(marker)
      expect(edited.schema).toEqual(original.schema)
      expect(original[field]).not.toContain(marker)
      expect(build({ ...context, textEdits: {} })).toEqual(original)
    })
  }
  it('captures the enabled hook edits at the native transfer entry point', async () => {
    const generateProfiles = vi.fn(async (_request: StructuredRequest) => ({
      ok: false as const, error: { code: 'LLM_REQUEST_REJECTED', message: 'Fixture stops after the first request.' }
    }))
    stubApi({ jobs: { cancelGroup: async () => ({ ok: true, data: undefined }) }, llm: { generateProfiles } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerHooks('transfer-prompt-fixture', { promptText: { edits: () => ({ global: edits }) } })
    setHookRules({ isOn: id => id === 'transfer-prompt-fixture', order: () => 0 })
    useGameStore.getState().reset()
    useGameStore.setState({ playthroughId: 'transfer-fixture', date: 7, time: 0 })
    await startTransfer(character({ charId: 'new-transfer' }), false)
    expect(generateProfiles).toHaveBeenCalledOnce()
    const request = generateProfiles.mock.calls[0][0]
    expect(request.system).toContain('PROFILE_SYSTEM_EDIT')
    expect(request.system).toContain('PROFILE_ADDITION')
    expect(useGameStore.getState().pendingTransfers).toEqual([])
  })
})
