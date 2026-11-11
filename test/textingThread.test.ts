import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@shared/types'
import { threadStartedBy } from '@shared/textingThread'

describe('who opened a slot\'s DM thread, which decides whether a mod may drop her hangout', () => {
  it('reads the first non-system sender in this slot only', () => {
    const her: ChatMessage = { id: 'her', sender: 'contact', text: 'Hi', date: 2, time: 1 }
    const reader: ChatMessage = { ...her, id: 'reader', sender: 'player' }
    const system: ChatMessage = { ...her, id: 'system', sender: 'system' }
    expect(threadStartedBy([her, reader], 2, 1)).toBe('her')
    expect(threadStartedBy([reader, her], 2, 1)).toBe('reader')
    expect(threadStartedBy([system, her, reader], 2, 1)).toBe('her')
    expect(threadStartedBy([{ ...her, date: 1 }, { ...her, time: 0 }, reader], 2, 1)).toBe('reader')
  })
})
