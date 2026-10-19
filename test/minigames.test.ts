import { describe, expect, it } from 'vitest'
import {
  gamesNamed,
  gamesOffered,
  gamesSuggested,
  seatsFor,
  settledOptions,
  suggestRate,
  MINI_GAMES,
  type MiniGameDef
} from '../src/shared/minigames'
import { modOn, NO_SWITCHES, withMod, type ModDef } from '../src/shared/mods'
import DARTS from '../src/shared/minigameEntries/darts'

/** Which games a scene offers: the mod's switch, the place, and who is there to play. */

function game(id: string, over: Partial<MiniGameDef> = {}): MiniGameDef {
  return {
    id,
    modId: 'pack',
    name: id,
    icon: '',
    blurb: '',
    format: '',
    players: { min: 0, max: 1 },
    skillBrief: '',
    ...over
  }
}

const cards = game('cards')
const darts = game('darts', { locations: ['pub'], players: { min: 1, max: 3 } })
const cabinet = game('cabinet', { locations: ['arcade'], players: { min: 0, max: 0 } })
const all = [cards, darts, cabinet]
const on = (): boolean => true
const ids = (games: MiniGameDef[]): string[] => games.map((g) => g.id)

describe('gamesOffered', () => {
  it('offers the actual Darts pack at Pino-Cola with or without a partner', () => {
    for (const location of ['pino cola', 'pinocola_lounge', 'Pino-Cola Lounge']) {
      for (const girls of [0, 1, 2]) expect(gamesOffered({ location, girls }, on, [DARTS])).toEqual([DARTS])
    }
  })
  it('offers location-bound games for classifier place names as well as stored ids', () => {
    const loungeDarts = game('darts', { locations: ['pino_cola_lounge'], players: { min: 1, max: 2 } })
    for (const location of ['pino_cola_lounge', 'pinocola_lounge', 'Pino-Cola Lounge', 'pino cola lounge', 'the Pino-Cola Lounge', 'pino cola', 'Pino-Cola', 'pinocola', 'the pino cola']) {
      expect(ids(gamesOffered({ location, girls: 1 }, on, [cards, loungeDarts])), location).toEqual(['cards', 'darts'])
    }
    expect(ids(gamesOffered({ location: 'the Agora', girls: 1 }, on, [cards, loungeDarts]))).toEqual(['cards'])
  })

  it('offers a game only at its own places, and a game with none anywhere', () => {
    expect(ids(gamesOffered({ location: 'pub', girls: 1 }, on, all))).toEqual(['cards', 'darts'])
    expect(ids(gamesOffered({ location: 'arcade', girls: 0 }, on, all))).toEqual(['cards', 'cabinet'])
    expect(ids(gamesOffered({ location: null, girls: 2 }, on, all))).toEqual(['cards'])
  })

  it('holds back a game that needs more girls than are here', () => {
    expect(ids(gamesOffered({ location: 'pub', girls: 0 }, on, all))).toEqual(['cards'])
  })

  it('seats the girls here up to what the game takes', () => {
    expect(seatsFor(darts, 5)).toBe(3)
    expect(seatsFor(cards, 0)).toBe(0)
    expect(seatsFor(cabinet, 2)).toBe(0)
  })

  it('offers nothing from a pack while the framework it requires is off', () => {
    const mods: ModDef[] = [
      { id: MINI_GAMES, name: '', author: '', version: '', scope: 'anytime', defaultOn: true, blurb: '' },
      { id: 'pack', name: '', author: '', version: '', scope: 'anytime', defaultOn: true, blurb: '', requires: [MINI_GAMES] }
    ]
    const spot = { location: 'pub', girls: 1 }
    const off = withMod(NO_SWITCHES, MINI_GAMES, false)
    expect(gamesOffered(spot, (id) => modOn(off, id, undefined, mods), all)).toEqual([])
    const back = withMod(off, MINI_GAMES, true)
    expect(ids(gamesOffered(spot, (id) => modOn(back, id, undefined, mods), all))).toEqual(['cards', 'darts'])
  })

  it('plays only what a game declares, inside its range, whatever came back', () => {
    const rounds = game('rounds', {
      options: [{ id: 'calls', describe: '', min: 1, max: 5, default: 5 }]
    })
    expect(settledOptions(rounds, { calls: '1' })).toEqual({ calls: 1 })
    expect(settledOptions(rounds, { calls: 9, cheat: 1 })).toEqual({ calls: 5 })
    expect(settledOptions(rounds, { calls: '2.5' })).toEqual({ calls: 5 })
    expect(settledOptions(rounds, undefined)).toEqual({ calls: 5 })
    expect(settledOptions(cards, { calls: 3 })).toEqual({})
  })

  it('has a girl suggest a game as the place says, the game otherwise, and never in a busy scene', () => {
    const cabinetGame = game('cab', { suggest: 'rarely', suggestAt: { arcade: 'often' } })
    expect(suggestRate(cabinetGame, 'arcade', false)).toBe('often')
    expect(suggestRate(cabinetGame, 'pub', false)).toBe('rarely')
    expect(suggestRate(cards, null, false)).toBe('sometimes')
    expect(suggestRate(cabinetGame, 'arcade', true)).toBe('never')
    // The player's own switch lifts every game to often, and still not into a busy scene.
    expect(suggestRate(cabinetGame, 'pub', false, true)).toBe('often')
    expect(suggestRate(cabinetGame, 'pub', true, true)).toBe('never')
  })
})

describe('gamesSuggested', () => {
  const deck = game('deck', { suggest: 'never', suggestAt: { room: 'sometimes' } })
  const race = game('race')

  it('tells the model only of games a girl may bring up at this place', () => {
    expect(ids(gamesSuggested([deck, race], 'room', false))).toEqual(['deck', 'race'])
    expect(ids(gamesSuggested([deck, race], 'arcade', false))).toEqual(['race'])
    expect(ids(gamesSuggested([deck, race], null, false))).toEqual(['race'])
  })

  it('tells it of none in a busy scene, and of all when he wants them often', () => {
    expect(gamesSuggested([deck, race], 'room', true)).toEqual([])
    expect(ids(gamesSuggested([deck, race], 'arcade', false, true))).toEqual(['deck', 'race'])
  })

  it('follows his own rate for a game over its places', () => {
    const his = { ...deck, suggest: 'rarely' as const, suggestAt: undefined }
    expect(ids(gamesSuggested([his], 'arcade', false))).toEqual(['deck'])
  })
})

describe('gamesNamed', () => {
  const poker = game('poker', { name: 'Poker', calledAs: ['hold em', 'cards'] })
  const highLow = game('high-low', { name: 'High-Low', calledAs: ['cards'] })
  const claw = game('claw', { name: 'Claw Machine', calledAs: ['claw'] })
  const race = game('race', { name: 'Foot Race', calledAs: ['race'] })
  const all = [poker, highLow, claw, race]

  it('finds a game by its name, however it is written', () => {
    expect(ids(gamesNamed(all, 'Want to play POKER?'))).toEqual(['poker'])
    expect(ids(gamesNamed(all, 'a round of high low'))).toEqual(['high-low'])
    expect(ids(gamesNamed(all, "Let's try the claw machines"))).toEqual(['claw'])
  })

  it('finds it by another word for it, plural or possessive included', () => {
    expect(ids(gamesNamed(all, "Hold'em, then?"))).toEqual(['poker'])
    expect(ids(gamesNamed(all, 'I brought cards.'))).toEqual(['poker', 'high-low'])
    expect(ids(gamesNamed(all, 'Race you to the fountain!'))).toEqual(['race'])
    expect(ids(gamesNamed(all, 'two races'))).toEqual(['race'])
  })

  it('does not find a word inside another', () => {
    expect(gamesNamed(all, 'She clawed at the racetrack, then hold me')).toEqual([])
    expect(gamesNamed(all, 'I raced here')).toEqual([])
    expect(gamesNamed(all, '')).toEqual([])
  })
})
