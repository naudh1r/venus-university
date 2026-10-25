import { describe, it, expect } from 'vitest'
import { activityEnding, type SlotActivity } from '@shared/slotActivity'
import { resolveStatDeltas } from '@shared/playerStats'
import { withSlotActivityPrompt } from '../src/renderer/prompts/slotActivity'
import type { StructuredRequest } from '@shared/types'

const activity: SlotActivity = { owner: 'test-pack', id: 'memory', location: 'cutetea', label: 'Train Brain', stat: 'brain', status: 'pending' }
const context = { solo: true, classScene: false, classOutcome: null, jobOutcome: null }

describe('committed slot activities', () => {
  it('holds a solo or model-ended opening, and ends a completed or abandoned session', () => {
    expect(activityEnding(activity, true)).toBe(false)
    expect(activityEnding({ ...activity, status: 'completed' }, false)).toBe(true)
    expect(activityEnding({ ...activity, status: 'abandoned' }, false)).toBe(true)
    expect(activityEnding(null, true)).toBe(true)
    expect(activityEnding(null, false)).toBe(false)
  })
  it.each([true, false])('replaces ledger training with exactly the selected stat (solo=%s)', solo => {
    const { deltas } = resolveStatDeltas({ brain: true, body: true, heart: true }, {
      ...context, solo, activity: { ...activity, status: 'completed' }
    })
    expect(deltas).toEqual({ brain: solo ? 2 : 1, body: 0, heart: 0 })
  })
  it.each(['pending', 'abandoned'] as const)('does not pay unfinished training despite the ledger: %s', status => {
    expect(resolveStatDeltas({ brain: true }, { ...context, activity: { ...activity, status } }).deltas)
      .toEqual({ brain: 0, body: 0, heart: 0 })
  })
  it('preserves the cold restriction and existing hangout rewards', () => {
    expect(resolveStatDeltas({}, { ...context, sick: true, activity: { ...activity, status: 'completed' } }).deltas.brain).toBe(0)
    expect(resolveStatDeltas({ heart: true }, { ...context, solo: false }).deltas).toEqual({ brain: 0, body: 0, heart: 1 })
  })
  it('keeps setup and aftermath prompts separate without changing the reply schema', () => {
    const request: StructuredRequest = { system: 'Base', user: 'Action', schema: { name: 'scene', schema: {} } }
    expect(withSlotActivityPrompt(request, null)).toBe(request)
    const opening = withSlotActivityPrompt(request, activity)
    expect(opening.system).toContain('Stop before play begins')
    expect(opening.schema).toBe(request.schema)
    const closing = withSlotActivityPrompt(request, { ...activity, status: 'completed', result: 'You scored 50.' })
    expect(closing.system).toContain('You scored 50.')
    expect(closing.system).toContain('Do not replay the last move')
  })
})
