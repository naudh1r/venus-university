import { describe, expect, it } from 'vitest'
import { lowerTo, raiseTo, THINKING_LEVELS, type ThinkingLevel } from '../src/shared/providers'

/**
 * A call could ask for *more* thought than the player's setting and never for less. So the
 * hangout classifier — one judgement, six worked examples, a sixty-character answer — ran at
 * whatever the scene writer ran at. At the player's `medium`, measured over one playthrough, it
 * billed a median 330 output tokens against the texting reply's 662, cost 78% of that reply, and
 * took as long, on every single message.
 *
 * `lowerTo` is the missing half.
 */
describe('lowerTo', () => {
  const all = [...THINKING_LEVELS] as ThinkingLevel[]

  it('brings a level down to the ceiling', () => {
    expect(lowerTo('high', 'low', all)).toBe('low')
  })

  it('leaves a level that already clears it', () => {
    expect(lowerTo('minimal', 'low', all)).toBe('minimal')
    expect(lowerTo('low', 'low', all)).toBe('low')
  })

  it('does nothing without a ceiling, which is every call that names none', () => {
    expect(lowerTo('high', undefined, all)).toBe('high')
  })

  /** A model that does not offer the ceiling keeps what it has rather than being sent a level it
   * would reject. */
  it('leaves a level a model cannot go below', () => {
    expect(lowerTo('high', 'low', ['high'])).toBe('high')
  })

  it('takes the highest accepted level at or under the ceiling', () => {
    expect(lowerTo('high', 'medium', ['minimal', 'high'])).toBe('minimal')
  })
})

describe('a band, floor and ceiling together', () => {
  const all = [...THINKING_LEVELS] as ThinkingLevel[]

  /** The floor is applied first: a call naming both is asking for a band. */
  it('pins a call to one level when both name it', () => {
    for (const stored of all) {
      expect(lowerTo(raiseTo(stored, 'low', all), 'low', all)).toBe('low')
    }
  })
})
