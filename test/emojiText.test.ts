import { describe, expect, it } from 'vitest'
import { emojiOnly } from '../src/renderer/components/EmojiText'

/** Which messages Emoji Extended draws big, with no bubble. */

describe('emojiOnly', () => {
  it('takes one to three emoji, joined, toned and keycap ones included', () => {
    expect(emojiOnly('😂')).toBe(true)
    expect(emojiOnly(' ☕ 😂 ')).toBe(true)
    expect(emojiOnly('👍🏽👩‍💻❤️')).toBe(true)
    expect(emojiOnly('1️⃣')).toBe(true)
  })

  it('leaves out words, a fourth emoji, text-style symbols and an empty message', () => {
    expect(emojiOnly('ok 😂')).toBe(false)
    expect(emojiOnly('😂😂😂😂')).toBe(false)
    expect(emojiOnly('©')).toBe(false)
    expect(emojiOnly('1')).toBe(false)
    expect(emojiOnly('   ')).toBe(false)
  })
})
