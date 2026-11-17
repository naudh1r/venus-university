import { describe, expect, it } from 'vitest'
import { heldReplyDueAt, sharedReplyClass } from '@shared/heldReplies'
import type { Conversation } from '@shared/types'

describe('waiting to write a busy reply until a shared next class ends', () => {
  it('requires the same class on both timetables, rather than work or a free slot', () => {
    expect(sharedReplyClass({ kind: 'class', code: 'BIO 101' }, 'BIO 101')).toBe('BIO 101')
    expect(sharedReplyClass({ kind: 'class', code: 'BIO 101' }, 'ART 201')).toBeNull()
    expect(sharedReplyClass({ kind: 'class', code: 'BIO 101' }, null)).toBeNull()
    expect(sharedReplyClass({ kind: 'shift' }, 'BIO 101')).toBeNull()
    expect(sharedReplyClass(null, 'BIO 101')).toBeNull()
  })
})

describe('a held reply takes her invitation or reach-out at its landing', () => {
  it('excludes written and unwritten replies only once they are due, including overdue recovery', () => {
    for (const messageIds of [[], ['reply']]) {
      const held: Conversation['heldReply'] = { until: { date: 8, time: 0 }, firstPlayerId: 'text', messageIds }
      expect(heldReplyDueAt(held, 7, 1)).toBe(false)
      expect(heldReplyDueAt(held, 8, 0)).toBe(true)
      expect(heldReplyDueAt(held, 8, 1)).toBe(true)
    }
    expect(heldReplyDueAt(undefined, 8, 0)).toBe(false)
  })
})
