import { describe, it, expect } from 'vitest'
import { activityEnding, type SlotActivity } from '@shared/slotActivity'
import { withSlotActivityPrompt } from '../src/renderer/prompts/slotActivity'
import type { StructuredRequest } from '@shared/types'

const activity: SlotActivity = { owner: 'test-pack', id: 'memory', location: 'cutetea', label: 'Train Brain', stat: 'brain', status: 'pending' }

describe('committed slot activities', () => {
  it('holds a solo or model-ended opening, and ends a completed or abandoned session', () => {
    expect(activityEnding(activity, true)).toBe(false)
    expect(activityEnding({ ...activity, status: 'completed' }, false)).toBe(true)
    expect(activityEnding({ ...activity, status: 'abandoned' }, false)).toBe(true)
    expect(activityEnding(null, true)).toBe(true)
    expect(activityEnding(null, false)).toBe(false)
  })
  it('lets the reply decide once the closing has landed, as when the reader talks over its ending', () => {
    const closed: SlotActivity = { ...activity, status: 'abandoned', closed: true }
    expect(activityEnding(closed, false)).toBe(false)
    expect(activityEnding(closed, true)).toBe(true)
  })
  it('keeps setup and aftermath prompts separate without changing the reply schema', () => {
    const request: StructuredRequest = { thinking: 'scenes', system: 'Base', user: 'Action', schema: { name: 'scene', schema: {} } }
    expect(withSlotActivityPrompt(request, null)).toBe(request)
    const opening = withSlotActivityPrompt(request, activity)
    expect(opening.system).toContain('Stop before play begins')
    expect(opening.schema).toBe(request.schema)
    const closing = withSlotActivityPrompt(request, { ...activity, status: 'completed', result: 'You scored 50.' })
    expect(closing.system).toContain('You scored 50.')
    expect(closing.system).toContain('Do not replay the last move')
    expect(withSlotActivityPrompt(request, { ...activity, status: 'completed', closed: true })).toBe(request)
  })
})
