import { describe, expect, it } from 'vitest'
import { messageSlotOf } from '../src/shared/chatVisibility'

describe('the slot a saved phone message belongs to', () => {
  it('keeps the ledger slot and reads a late text as the preceding half', () => {
    const message = { date: 36, time: 0 as const, late: true as const }
    expect(messageSlotOf(message)).toEqual({ date: 35, time: 1 })
    expect(message).toEqual({ date: 36, time: 0, late: true })
    expect(messageSlotOf({ date: 36, time: 0 })).toEqual({ date: 36, time: 0 })
    expect(messageSlotOf({ date: 35, time: 1 })).toEqual({ date: 35, time: 1 })
  })
})
