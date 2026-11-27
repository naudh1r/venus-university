import { describe, expect, it } from 'vitest'
import type { Conversation } from '../src/shared/types'
import { messageShown, readPlayerIds, shownMessages, unreadAfterOpening } from '../src/shared/chatVisibility'

describe('held message visibility', () => {
  it('leaves hidden messages out of a thread projection', () => {
    const earlier = { date: 7, time: 1 as const }
    const future = { date: 8, time: 0 as const }
    expect(shownMessages([earlier, future], earlier)).toEqual([earlier])
    expect(shownMessages([earlier, future], future)).toEqual([earlier, future])
  })

  it('hides future slots until the opened clock reaches them, including across midnight', () => {
    const morning = { date: 8, time: 0 as const }
    expect(messageShown(morning, { date: 7, time: 1 })).toBe(false)
    expect(messageShown(morning, morning)).toBe(true)
    expect(messageShown(morning, { date: 8, time: 1 })).toBe(true)
    expect(messageShown({ date: 8, time: 1 }, morning)).toBe(false)
    expect(messageShown({ ...morning, late: true }, { date: 7, time: 1 })).toBe(true)
  })
})

describe('unread counts when a chat slot opens', () => {
  const before = { date: 7, time: 1 as const }
  const clock = { date: 8, time: 0 as const }
  const thread: Conversation = {
    charId: 'her', unread: 3, summary: null,
    messages: [
      { id: 'late', sender: 'contact', text: '', ...clock, late: true },
      { id: 'due', sender: 'contact', text: '', ...clock },
      { id: 'later', sender: 'contact', text: '', date: 8, time: 1 },
      { id: 'reader', sender: 'player', text: '', ...clock },
      { id: 'error', sender: 'system', text: '', ...clock }
    ]
  }

  it('adds only newly shown contact messages, leaving late texts and future replies alone', () => {
    expect(unreadAfterOpening(thread, before, clock)).toBe(4)
  })

  it('keeps the saved unread count when loading an already opened slot', () => {
    expect(unreadAfterOpening({ ...thread, unread: 4 }, clock, clock)).toBe(4)
    expect(unreadAfterOpening(thread, before, before)).toBe(3)
  })

  it('leaves a held reply to its delivery pass instead of counting it twice', () => {
    expect(unreadAfterOpening({ ...thread, heldReply: {
      until: clock, firstPlayerId: 'reader', messageIds: ['due']
    } }, before, clock)).toBe(3)
  })
})

describe('read receipts from the visible thread', () => {
  const sent = { id: 'sent', sender: 'player' as const, date: 7, time: 1 as const }
  const next = { ...sent, id: 'next' }
  const reply = { id: 'reply', sender: 'contact' as const, date: 8, time: 0 as const }
  const system = { ...sent, id: 'system', sender: 'system' as const }

  it('marks only player messages before a visible reply, even across a system line', () => {
    expect(readPlayerIds([sent, next, system, reply, { ...sent, id: 'latest' }]))
      .toEqual(new Set([sent.id, next.id]))
  })

  it('leaves a message sent when nothing or only a system line follows', () => {
    expect(readPlayerIds([sent])).toEqual(new Set())
    expect(readPlayerIds([sent, system])).toEqual(new Set())
  })

  it('marks all earlier texts together only when a held reply is shown', () => {
    const thread = [sent, next, reply]
    expect(readPlayerIds(shownMessages(thread, sent))).toEqual(new Set())
    expect(readPlayerIds(shownMessages(thread, reply))).toEqual(new Set([sent.id, next.id]))
  })
})
