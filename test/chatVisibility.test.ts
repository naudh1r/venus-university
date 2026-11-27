import { describe, expect, it } from 'vitest'
import type { Conversation } from '../src/shared/types'
import { heldReplyShown, messageShown, receiptsOf, shownMessages, unreadAfterOpening } from '../src/shared/chatVisibility'

describe('held message visibility', () => {
  it('holds a sleep reply until the morning landing without delaying other replies', () => {
    const morning = { date: 8, time: 0 as const }
    const night = { ...morning, night: true as const }
    const reply = { ...morning, afterNight: true as const }
    const hold = { until: morning, firstPlayerId: 'player', messageIds: ['reply'], asleep: true as const }
    expect(shownMessages([morning, reply], night)).toEqual([morning])
    expect(heldReplyShown(hold, night)).toBe(false)
    expect(shownMessages([morning, reply], morning)).toEqual([morning, reply])
    expect(heldReplyShown(hold, morning)).toBe(true)
    expect(messageShown(reply, { date: 9, time: 0, night: true })).toBe(true)
  })

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

describe('receipts from the thread', () => {
  const sent = { id: 'sent', sender: 'player' as const, date: 7, time: 1 as const }
  const next = { ...sent, id: 'next' }
  const reply = { id: 'reply', sender: 'contact' as const, date: 8, time: 0 as const }
  const system = { ...sent, id: 'system', sender: 'system' as const }
  const of = (all: typeof thread, clock: { date: number; time: 0 | 1 }) =>
    Object.fromEntries(receiptsOf(all, shownMessages(all, clock)))
  const thread: { id: string; sender: 'player' | 'contact' | 'system'; date: number; time: 0 | 1 }[] =
    [sent, next, reply]

  it('reads only player texts before a shown reply, even across a system line', () => {
    const all = [sent, next, system, { ...reply, date: 7, time: 1 as const }, { ...sent, id: 'latest' }]
    expect(of(all, sent)).toEqual({ sent: 'read', next: 'read', latest: 'sent' })
  })

  it('leaves a text sent when nothing or only a system line follows', () => {
    expect(of([sent], sent)).toEqual({ sent: 'sent' })
    expect(of([sent, system], sent)).toEqual({ sent: 'sent' })
  })

  it('marks texts delivered while their written reply is held, and read once it shows', () => {
    expect(of(thread, sent)).toEqual({ sent: 'delivered', next: 'delivered' })
    expect(of(thread, reply)).toEqual({ sent: 'read', next: 'read' })
  })

  it('marks the texts after the last reply with where a reply for now stands', () => {
    const shown = [sent, { ...reply, date: 7, time: 1 as const }, next]
    expect(Object.fromEntries(receiptsOf(shown, shown, 'delivered'))).toEqual({ sent: 'read', next: 'delivered' })
    expect(Object.fromEntries(receiptsOf(shown, shown, 'read'))).toEqual({ sent: 'read', next: 'read' })
  })

  it('keeps earlier texts read when a later reply is held', () => {
    const all = [sent, { ...reply, id: 'early', date: 7, time: 1 as const }, next, reply]
    expect(of(all, sent)).toEqual({ sent: 'read', next: 'delivered' })
  })
})
