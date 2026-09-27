import { describe, expect, it } from 'vitest'
import { buildHangoutClassifierPrompt } from '../src/renderer/prompts/hangoutClassifierPrompt'
import type { ChatMessage, TimeSlot } from '@shared/types'

/**
 * Each classification is one exchange — six messages of background, his message, her reply — so
 * nothing in that view says he was asked yesterday and said no. A standing offer pressed again
 * reads as a fresh proposal, every turn, and the player who declines and explains himself is
 * asked the same thing on the next reply.
 */
describe('the classifier is told he has already refused', () => {
  const msg = (sender: ChatMessage['sender'], text: string): ChatMessage => ({
    id: `${sender}-${text}`,
    sender,
    text,
    date: 0,
    time: 0 as TimeSlot
  })

  function userFor(state: Record<string, unknown>): string {
    return buildHangoutClassifierPrompt(
      'Mina',
      [],
      msg('player', 'how was your day'),
      [msg('contact', 'come get coffee, im at the union')],
      { date: 0, time: 0 as TimeSlot, ...state }
    ).user
  }

  it('says so when he has turned her down, and names what is not a new proposal', () => {
    const user = userFor({ strictSchema: true, alreadyDeclined: true })
    expect(user).toContain('has already turned down an invitation from Mina')
    expect(user).toContain('not a new proposal')
  })

  it('says nothing about it when he has not', () => {
    expect(userFor({ strictSchema: true })).not.toContain('already turned down an invitation')
  })

  /** Off, the call is what this build has always sent — no refusal memory and no quote. */
  it('says nothing about it with the switch off, even when he has refused', () => {
    const user = userFor({ alreadyDeclined: true })
    expect(user).not.toContain('already turned down an invitation')
    expect(user).not.toContain('"quote"')
  })
})
