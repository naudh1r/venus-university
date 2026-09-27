import { describe, expect, it } from 'vitest'
import { normalizeHangout } from '../src/renderer/prompts/hangoutClassifierPrompt'

/**
 * In one playthrough the classifier fired 157 times and answered "she is inviting him" 40 times —
 * a quarter of her replies. Reading the log, she mostly was not. A goodnight became "Meeting at
 * Stalestein with Ines", for a girl called Ingrid, with Ines not in the exchange and Stalestein
 * nowhere in the prompt. Of the 40, 21 named a plan whose wording was nowhere in the reply it was
 * attributed to.
 *
 * The prompt already said to look for proposals ONLY in the two messages. It was ignored: on the
 * advisory path a negative instruction does not survive contact with a schema that demands a
 * value, and `description` is required when a flag is true, so a model that has raised the flag
 * writes *something*.
 *
 * So the claim is made checkable instead of asked for. The model stays free to be wrong about
 * what the words mean; it is no longer free to be wrong about whether they were written.
 */
describe('normalizeHangout — the quote has to be real', () => {
  const sources = {
    message: 'how was your day',
    reply: 'long lol. come walk by the river with me, im heading out now'
  }

  it('takes a verdict that cites words the reply really contains', () => {
    const verdict = normalizeHangout(
      {
        quote: 'come walk by the river with me',
        playerAsked: false,
        characterOffered: true,
        description: 'A walk along the river with Mina.'
      },
      sources
    )
    expect(verdict).toEqual({ initiatedBy: 'contact', description: 'A walk along the river with Mina.' })
  })

  it('drops the invitation nobody wrote', () => {
    const verdict = normalizeHangout(
      {
        quote: 'meet me at stalestein with ines',
        playerAsked: false,
        characterOffered: true,
        description: 'Meeting at Stalestein with Ines.'
      },
      sources
    )
    expect(verdict).toBeNull()
  })

  /** A model that quotes correctly still re-punctuates, and an honest quote must survive that. */
  it('forgives punctuation, case and apostrophes', () => {
    const verdict = normalizeHangout(
      {
        quote: "Come walk by the river with me — I'm heading out now!",
        playerAsked: false,
        characterOffered: true,
        description: 'A walk along the river.'
      },
      sources
    )
    expect(verdict).not.toBeNull()
  })

  it('refuses a quote too short to prove anything', () => {
    // "right now" is in half of all texts.
    const verdict = normalizeHangout(
      { quote: 'now', playerAsked: false, characterOffered: true, description: 'Something.' },
      { message: 'x', reply: 'now' }
    )
    expect(verdict).toBeNull()
  })

  it('checks the side the verdict attributes it to, not either side', () => {
    // The words are the contact's, but the verdict says the player asked.
    const verdict = normalizeHangout(
      {
        quote: 'come walk by the river with me',
        playerAsked: true,
        characterOffered: false,
        description: 'A walk.'
      },
      sources
    )
    expect(verdict).toBeNull()
  })

  it('answers nothing where neither flag is raised', () => {
    expect(
      normalizeHangout(
        { quote: '', playerAsked: false, characterOffered: false, description: '' },
        sources
      )
    ).toBeNull()
  })

  /** With the switch off the reply is taken at its word, exactly as this build has always read it. */
  it('checks nothing when no sources are given', () => {
    const verdict = normalizeHangout({
      playerAsked: false,
      characterOffered: true,
      description: 'Meeting at Stalestein with Ines.'
    })
    expect(verdict).toEqual({
      initiatedBy: 'contact',
      description: 'Meeting at Stalestein with Ines.'
    })
  })
})
