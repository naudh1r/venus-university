import { describe, expect, it } from 'vitest'
import { buildTextingPrompt } from '../src/renderer/prompts/textingPrompt'
import { character, peClassEntry } from './fixtures'

/**
 * What she is handed of his week.
 *
 * Every character is given the reader's whole timetable, work shifts included, ungated by how
 * well she knows him. That is defensible on a model that merely respects a fact. On a cheap one
 * it is a fact to be *used*: the player told her he had a shift and was answered *"I know about
 * the shift, nick. badminton class is tonight, and you're behind the bar after it."* She was not
 * being consistent with his week, she was arguing with him out of it.
 *
 * Under `strictSchema` she gets the hours she sits in with him, and nothing else.
 */
describe('the reader’s week, as she sees it', () => {
  const base = {
    date: 0,
    time: 0 as const,
    roster: [],
    npcRelationships: {},
    occasions: [],
    classes: {
      'PED 125': peClassEntry({ code: 'PED 125', name: 'Badminton', slot: 5 }),
      'BIO 210': peClassEntry({ code: 'BIO 210', name: 'Human Anatomy', slot: 8 })
    },
    // Badminton with her, Human Anatomy without.
    playerSchedule: { 5: 'PED 125', 8: 'BIO 210' },
    // No job: a shift is never shared, so it has no bearing on what she is told either way.
    playerJob: null
  }
  /** Her own timetable: the same badminton hour, and nothing else of his. */
  const hers = { a: { schedule: { 5: 'PED 125' } } } as never

  function userFor(strictSchema: boolean): string {
    return buildTextingPrompt(
      character({ charId: 'a', firstName: 'Risa' }),
      { schedule: { 5: 'PED 125' } } as never,
      undefined,
      'hey',
      { ...base, charInfo: hers, strictSchema },
      'READER'
    ).user
  }

  it('names the class she is in with him', () => {
    const user = userFor(true)
    expect(user).toContain('Classes Risa is in with the reader:')
    expect(user).toContain('Badminton')
  })

  it('keeps his other lectures out of it', () => {
    const user = userFor(true)
    expect(user).not.toContain('Human Anatomy')
    // The heading his whole week arrives under.
    expect(user).not.toContain("The reader's Schedule:")
  })

  /** With the switch off she gets the whole week, exactly as this build has always sent it. */
  it('hands over the whole timetable with the switch off', () => {
    const user = userFor(false)
    expect(user).toContain("The reader's Schedule:")
    expect(user).toContain('Human Anatomy')
  })
})

/**
 * What a character is told she may *do* in a reply: four lines on voice, thirteen on sending a
 * picture, three on blocking him, and one on meeting up. Photos are rationed and blocking is
 * terminal, which leaves meeting the only move always available — for every character, every
 * turn, whatever the conversation was about.
 */
describe('the meet-up line is an answer, not a want', () => {
  const base = {
    date: 0,
    time: 0 as const,
    roster: [],
    npcRelationships: {},
    occasions: [],
    classes: {},
    playerSchedule: {},
    playerJob: null,
    charInfo: {},
    charLocation: 'arcade'
  }

  function userFor(strictSchema: boolean): string {
    return buildTextingPrompt(
      character({ charId: 'a', firstName: 'Risa' }),
      undefined,
      undefined,
      'hey',
      { ...base, strictSchema },
      'READER'
    ).user
  }

  it('brakes it, the way the photo rules are braked', () => {
    const user = userFor(true)
    expect(user).toContain('not a reason for Risa to bring it up')
    expect(user).toContain('most replies are not invitations')
  })

  it('stops telling her she would rather he came to her', () => {
    expect(userFor(true)).not.toContain('would sooner have him come to her')
  })

  it('leaves the line alone with the switch off', () => {
    const user = userFor(false)
    expect(user).toContain('would sooner have him come to her')
    expect(user).not.toContain('most replies are not invitations')
  })
})
