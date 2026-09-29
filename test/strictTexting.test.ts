import { describe, expect, it } from 'vitest'
import { buildTextingPrompt } from '../src/renderer/prompts/textingPrompt'
import {
  DEV_BUBBLE_LINE,
  STRICT_BUBBLE_LINE,
  STRICT_TEXTING_LINES,
  strictTextingPersona
} from '../src/renderer/prompts/strictTexting'
import { character } from './fixtures'

/**
 * What she is told about texting under `strictSchema`, and that with the switch off she is told
 * exactly what this build has always told her.
 */
describe('the texting rules under strictSchema', () => {
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

  function requestFor(strictSchema: boolean): { system: string; user: string } {
    return buildTextingPrompt(
      character({ charId: 'a', firstName: 'Risa' }),
      undefined,
      undefined,
      'hey',
      { ...base, strictSchema },
      'READER'
    )
  }

  it('makes one short message the default, in place of the line inviting bursts', () => {
    const { system } = requestFor(true)
    expect(system).toContain(STRICT_BUBBLE_LINE)
    expect(system).not.toContain(DEV_BUBBLE_LINE)
  })

  it('tells her each rule under YOUR TURN', () => {
    const { user } = requestFor(true)
    const turn = user.slice(user.indexOf('YOUR TURN'))
    for (const line of STRICT_TEXTING_LINES) expect(turn).toContain(line)
  })

  it('leaves the persona and the turn exactly as they were with the switch off', () => {
    const { system, user } = requestFor(false)
    expect(system).toContain(DEV_BUBBLE_LINE)
    expect(system).not.toContain(STRICT_BUBBLE_LINE)
    for (const line of STRICT_TEXTING_LINES) expect(user).not.toContain(line)
  })

  it('only changes the bubble line in the persona', () => {
    const off = requestFor(false).system
    expect(requestFor(true).system).toBe(off.replace(DEV_BUBBLE_LINE, STRICT_BUBBLE_LINE))
  })

  /** A sync that rewords the build's line would otherwise drop the rule without a word. */
  it('still says the rule when the line it replaces has been reworded', () => {
    const persona = strictTextingPersona('You are RITA.\nSend as many texts as you like.')
    expect(persona).toContain(STRICT_BUBBLE_LINE)
    expect(persona).toContain('Send as many texts as you like.')
  })
})
