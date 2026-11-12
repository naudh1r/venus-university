import { describe, expect, it } from 'vitest'
import { messageShown } from '../src/shared/chatVisibility'

describe('held message visibility', () => {
  it('hides future slots until the opened clock reaches them, including across midnight', () => {
    const morning = { date: 8, time: 0 as const }
    expect(messageShown(morning, { date: 7, time: 1 })).toBe(false)
    expect(messageShown(morning, morning)).toBe(true)
    expect(messageShown(morning, { date: 8, time: 1 })).toBe(true)
    expect(messageShown({ date: 8, time: 1 }, morning)).toBe(false)
    expect(messageShown({ ...morning, late: true }, { date: 7, time: 1 })).toBe(true)
  })
})
