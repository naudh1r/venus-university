import { describe, expect, it } from 'vitest'
import { groupsFor, listed, type MiniGameDef } from '../src/shared/minigames'
import type { Character, StructuredRequest } from '../src/shared/types'
import { agreedOf, withOffer } from '../src/renderer/minigames/offer'
import { answerOf, withProposal, type Asked } from '../src/renderer/minigames/proposal'
import DARTS from '../src/shared/minigameEntries/darts'

function game(min: number, max: number): MiniGameDef {
  return {
    id: 'cards',
    modId: 'cards',
    name: 'Cards',
    icon: '🂡',
    blurb: 'a hand of cards',
    players: { min, max },
    format: 'One hand.',
    skillBrief: 'Card sense.'
  }
}

const girl = (charId: string, firstName: string): Character =>
  ({ charId, firstName, lastName: 'Seo' }) as Character
const CAST = [girl('a', 'Ana'), girl('b', 'Bea'), girl('c', 'Cy')]
const ASKED: Asked[] = [
  { charId: 'a', key: 'ana_seo', name: 'Ana' },
  { charId: 'b', key: 'bea_seo', name: 'Bea' }
]
const REQUEST: StructuredRequest = {
  system: '',
  user: "Reader's action: hello",
  schema: { name: 'scene', schema: { type: 'object', required: ['lines'], properties: { lines: {} } } },
  cacheKey: 'k'
} as unknown as StructuredRequest

type Shape = { required: string[]; properties: Record<string, { properties: Record<string, unknown> }> }
const shapeOf = (request: StructuredRequest): Shape => request.schema.schema as unknown as Shape

describe('who a game can be asked of', () => {
  it('lists names as a sentence has them', () => {
    expect(listed([])).toBe('')
    expect(listed(['Ana'])).toBe('Ana')
    expect(listed(['Ana', 'Bea'])).toBe('Ana and Bea')
    expect(listed(['Ana', 'Bea', 'Cy'])).toBe('Ana, Bea and Cy')
  })

  it('offers no group for a game one girl plays, or with one girl here', () => {
    expect(groupsFor(game(0, 1), ['a', 'b'])).toEqual([])
    expect(groupsFor(game(1, 3), ['a'])).toEqual([])
  })

  it('offers everyone where the game seats them, and each full table where it does not', () => {
    expect(groupsFor(game(1, 3), ['a', 'b', 'c'])).toEqual([['a', 'b', 'c']])
    expect(groupsFor(game(1, 2), ['a', 'b', 'c'])).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c']
    ])
    expect(groupsFor(game(3, 3), ['a', 'b'])).toEqual([])
  })
})

describe('a proposal to several girls', () => {
  it('asks each for her own answer, and one girl for hers alone', () => {
    const several = shapeOf(withProposal(REQUEST, game(1, 3), ASKED))
    expect(several.required[0]).toBe('minigame')
    expect(Object.keys(several.properties.minigame.properties)).toContain('who')
    const one = shapeOf(withProposal(REQUEST, game(1, 3), ASKED.slice(0, 1)))
    expect(Object.keys(one.properties.minigame.properties)).not.toContain('who')
  })

  it('seats the girls who are in', () => {
    const reply = { minigame: { answer: 'accept', who: { ana_seo: 'in', bea_seo: 'out' }, stake: ' Loser pays. ' } }
    expect(answerOf(reply, game(1, 3), ASKED)).toMatchObject({
      accepted: true,
      charIds: ['a'],
      stake: 'Loser pays.'
    })
  })

  it('is a no with fewer in than the game needs, or with no answer', () => {
    const reply = { minigame: { answer: 'accept', who: { ana_seo: 'in', bea_seo: 'out' }, stake: '' } }
    expect(answerOf(reply, game(2, 3), ASKED).accepted).toBe(false)
    expect(answerOf({}, game(1, 3), ASKED).accepted).toBe(false)
    expect(answerOf({ minigame: { answer: 'decline', stake: '' } }, game(1, 1), ASKED.slice(0, 1)).accepted).toBe(false)
  })

  it('takes one girl at her word', () => {
    const reply = { minigame: { answer: 'accept', stake: '' } }
    expect(answerOf(reply, game(0, 1), ASKED.slice(0, 1)).charIds).toEqual(['a'])
  })
})

describe('the standing offer with several girls here', () => {
  it('requires an NPC agreement for narrator-launched Darts even though the HUD allows solo', () => {
    expect(DARTS.players.min).toBe(0)
    for (const cast of [[], CAST.slice(0, 1), CAST]) {
      const who = cast.length > 1 ? { ana_seo: 'out', bea_seo: 'out', cy_seo: 'out' } : ''
      expect(agreedOf({ minigame: { play: 'darts', with: who } }, [DARTS], cast)).toBeNull()
    }
    expect(agreedOf({ minigame: { play: 'darts', with: 'ana_seo' } }, [DARTS], CAST.slice(0, 1))?.characters.map((c) => c.charId)).toEqual(['a'])
    expect(withOffer(REQUEST, [DARTS], CAST.slice(0, 1), 'pino cola', false, false).user).toContain('BOTH agreed')
    expect(withOffer(REQUEST, [DARTS], CAST.slice(0, 1), 'pino cola', false, false).user).not.toContain('SOLO EXCEPTION')
  })
  it('names one girl, and says in or out of several', () => {
    const one = shapeOf(withOffer(REQUEST, [game(1, 3)], CAST.slice(0, 1), null, false, false))
    expect((one.properties.minigame.properties.with as { type: string }).type).toBe('string')
    const several = shapeOf(withOffer(REQUEST, [game(1, 3)], CAST, null, false, false))
    expect(Object.keys((several.properties.minigame.properties.with as Shape).properties)).toEqual([
      'ana_seo',
      'bea_seo',
      'cy_seo'
    ])
  })

  it('reads who agreed, seats no more than the game does, and needs enough of them', () => {
    const all = { minigame: { play: 'cards', with: { ana_seo: 'in', bea_seo: 'in', cy_seo: 'in' }, stake: '' } }
    expect(agreedOf(all, [game(1, 3)], CAST)?.characters.map((c) => c.charId)).toEqual(['a', 'b', 'c'])
    expect(agreedOf(all, [game(1, 2)], CAST)?.characters.map((c) => c.charId)).toEqual(['a', 'b'])
    const none = { minigame: { play: 'cards', with: { ana_seo: 'out', bea_seo: 'out', cy_seo: 'out' }, stake: '' } }
    expect(agreedOf(none, [game(1, 3)], CAST)).toBeNull()
    const lone = { minigame: { play: 'cards', with: { ana_seo: 'out', bea_seo: 'in', cy_seo: 'out' }, stake: '' } }
    expect(agreedOf(lone, [game(2, 3)], CAST)).toBeNull()
    expect(agreedOf(lone, [game(1, 3)], CAST)?.characters.map((c) => c.charId)).toEqual(['b'])
  })

  it('still reads one girl named outright', () => {
    const reply = { minigame: { play: 'cards', with: 'ana_seo', stake: '' } }
    expect(agreedOf(reply, [game(0, 1)], CAST.slice(0, 1))?.characters.map((c) => c.charId)).toEqual(['a'])
  })
})

describe('a pack of games', () => {
  it('is one mod with a switch for each game, on until switched off', async () => {
    const { packMod, gameSwitchOn, MINI_GAMES } = await import('../src/shared/minigames')
    const cards = game(0, 1)
    const mod = packMod({ id: 'pack', name: 'Pack', author: 'a', version: '1', blurb: 'b', games: [cards] })
    expect(mod.requires).toEqual([MINI_GAMES])
    expect(mod.options?.map((option) => option.id)).toEqual(['cards'])
    expect(gameSwitchOn(cards, mod, () => undefined)).toBe(true)
    expect(gameSwitchOn(cards, mod, () => false)).toBe(false)
    // A pack that gives a game no switch has it on with the pack.
    expect(gameSwitchOn(cards, { ...mod, options: [] }, () => false)).toBe(true)
  })

  it('brings every game in the build through a pack, and none through the framework', async () => {
    const { MINI_GAMES_LIST, MINI_GAMES } = await import('../src/shared/minigames')
    const { MODS } = await import('../src/shared/mods')
    for (const entry of MINI_GAMES_LIST) {
      expect(entry.modId).not.toBe(MINI_GAMES)
      const mod = MODS.find((candidate) => candidate.id === entry.modId)
      expect(mod?.options?.some((option) => option.id === entry.id)).toBe(true)
    }
  })
})

describe('a game as the player has it set', () => {
  it('starts an option where he set it, within what the game allows, and is suggested as he chose', async () => {
    const { tuned, suggestRate, defaultOptions, playersWords } = await import('../src/shared/minigames')
    const base = {
      ...game(0, 3),
      options: [{ id: 'hands', describe: 'hands', min: 1, max: 5, default: 3 }],
      suggest: 'rarely' as const,
      suggestAt: { bar: 'often' as const }
    }
    expect(tuned(base, undefined)).toBe(base)
    expect(defaultOptions(tuned(base, { options: { hands: 5 } }))).toEqual({ hands: 5 })
    expect(defaultOptions(tuned(base, { options: { hands: 9 } }))).toEqual({ hands: 3 })
    expect(suggestRate(tuned(base, { suggest: 'never' }), 'bar', false)).toBe('never')
    expect(suggestRate(tuned(base, {}), 'bar', false)).toBe('often')
    expect(playersWords(base)).toBe('alone, or with up to 3 girls')
    expect(playersWords(game(1, 1))).toBe('with one girl')
  })
})
