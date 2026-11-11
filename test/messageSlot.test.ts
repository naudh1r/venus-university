import { describe, expect, it } from 'vitest'
import { formatChatDivider, formatMessageSlot } from '../src/renderer/prompts/gameDate'

describe('the slot a saved phone message belongs to', () => {
  it('prints a late text on the previous night and keeps ordinary slots unchanged', () => {
    expect(formatMessageSlot({ date: 36, time: 0, late: true }, 'spring')).toBe('Feb 23, late night')
    expect(formatMessageSlot({ date: 36, time: 0 }, 'spring')).toBe(formatChatDivider(36, 0, 'spring'))
    expect(formatMessageSlot({ date: 35, time: 1 }, 'spring')).toBe(formatChatDivider(35, 1, 'spring'))
  })
})
