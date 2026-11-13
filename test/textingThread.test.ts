import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@shared/types'
import { claimLedgerMessages, ledgerMessages, threadStartedBy, waitingText } from '@shared/textingThread'

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

describe('recovering an unfinished held turn', () => {
  it('finds the last waiting player text behind a trailing system error', () => {
    const first: ChatMessage = { id: 'first', sender: 'player', text: 'Hi', date: 2, time: 1, awaitingReply: true }
    const last: ChatMessage = { ...first, id: 'last', text: 'Still there?' }
    const error: ChatMessage = { ...first, id: 'error', sender: 'system', error: true }
    delete error.awaitingReply
    expect(waitingText([first, last, error])).toBe(last)
    expect(waitingText([error])).toBeUndefined()
  })
})


describe('claiming a held night for its texting ledger', () => {
  it('takes only the night exchange and leaves it out of the morning after claiming', () => {
    const night: ChatMessage = { id: 'night', sender: 'player', text: 'Tomorrow morning?', date: 8, time: 0, late: true }
    const morning: ChatMessage = { id: 'morning', sender: 'contact', text: 'Good morning.', date: 8, time: 0 }
    const earlier: ChatMessage = { id: 'evening', sender: 'player', text: 'Hello.', date: 7, time: 1 }
    const messages = [earlier, night, morning]
    expect(ledgerMessages(messages, 8, 0)).toEqual([night, morning])
    const taken = ledgerMessages(messages, 8, 0, true)
    expect(taken).toEqual([night])
    const claimed = claimLedgerMessages(messages, new Set(taken.map(message => message.id)))
    expect(ledgerMessages(claimed, 8, 0)).toEqual([morning])
    expect(ledgerMessages(claimed, 8, 0, true)).toEqual([])
    expect(ledgerMessages(claimed, 7, 1)).toEqual([earlier])
    expect(messages[1].ledgered).toBeUndefined()
  })
})
