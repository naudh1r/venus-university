import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A game pack is self-contained: beyond its own files it uses React, `motion`, and the two kits
 * the framework offers, and nothing else of the game. That is what lets the game change
 * underneath without a pack noticing, and lets anyone's pack be dropped in beside another's.
 */

const ROOT = join(__dirname, '..', 'src')

/** Every `from '...'` and bare `import '...'` in a file. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/(?:from|import)\s+'([^']+)'/g)].map((match) => match[1])
}

function filesIn(folder: string, ending: string): string[] {
  return readdirSync(join(ROOT, folder))
    .filter((name) => name.endsWith(ending))
    .map((name) => join(ROOT, folder, name))
}

/** A pack's own rules, by alias or by path, and its own stylesheet. */
const OWN = /^(@shared\/minigameRules\/|\.\.\/\.\.\/\.\.\/shared\/minigameRules\/|\.\/[A-Za-z]+$|\.\.\/\.\.\/vu_styles\/[A-Za-z]+\.css$)/

describe('a game pack reaches for nothing outside the kits', () => {
  it('in what it draws', () => {
    const allowed = new Set(['react', 'motion/react', '../kit', '@shared/minigameKit'])
    for (const file of filesIn('renderer/minigames/games', '.tsx')) {
      const strays = importsOf(file).filter((source) => !allowed.has(source) && !OWN.test(source))
      expect(strays, file).toEqual([])
    }
  })

  it('in its rules', () => {
    for (const file of filesIn('shared/minigameRules', '.ts')) {
      const strays = importsOf(file).filter(
        (source) => source !== '../minigameKit' && !/^\.\/[A-Za-z]+$/.test(source)
      )
      expect(strays, file).toEqual([])
    }
  })

  it('in its games on paper', () => {
    for (const file of filesIn('shared/minigameEntries', '.ts')) {
      const strays = importsOf(file).filter((source) => source !== '../minigameKit')
      expect(strays, file).toEqual([])
    }
  })

  it('and no pack leans on another: rules are shared only through the kit', () => {
    const rules = filesIn('shared/minigameRules', '.ts')
    for (const file of rules) {
      expect(importsOf(file).filter((source) => source.startsWith('./')), file).toEqual([])
    }
  })
})

describe('switching the games off', () => {
  it('ships off: no game is offered until the player turns the mini-games on', async () => {
    const { NO_SWITCHES, modOn, withMod } = await import('../src/shared/mods')
    const { MINI_GAMES, MINI_GAMES_LIST, gamesOffered } = await import('../src/shared/minigames')
    expect(modOn(NO_SWITCHES, MINI_GAMES)).toBe(false)
    const isOn = (modId: string): boolean => modOn(NO_SWITCHES, modId)
    expect(gamesOffered({ location: 'btb_arcade', girls: 1 }, isOn)).toEqual([])
    // Turned on, every pack comes with it.
    const on = withMod(NO_SWITCHES, MINI_GAMES, true)
    for (const pack of new Set(MINI_GAMES_LIST.map((game) => game.modId))) {
      expect(modOn(on, pack)).toBe(true)
    }
  })

  it('takes every pack and every game with the framework, and leaves the rest of the game alone', async () => {
    const { MODS, NO_SWITCHES, modOn, withMod } = await import('../src/shared/mods')
    const { MINI_GAMES, MINI_GAMES_LIST, gamesOffered } = await import('../src/shared/minigames')
    const on = withMod(NO_SWITCHES, MINI_GAMES, true)
    const off = withMod(on, MINI_GAMES, false)
    const packs = [...new Set(MINI_GAMES_LIST.map((game) => game.modId))]
    expect(packs.length).toBeGreaterThan(0)
    for (const pack of packs) {
      expect(modOn(on, pack)).toBe(true)
      expect(modOn(off, pack)).toBe(false)
    }
    // Nothing is offered anywhere once the packs are off.
    const isOn = (modId: string): boolean => modOn(off, modId)
    for (const location of ['btb_arcade', 'room', null]) {
      expect(gamesOffered({ location, girls: 2 }, isOn)).toEqual([])
    }
    // Every other mod answers as it did.
    for (const mod of MODS.filter((m) => m.id !== MINI_GAMES && !packs.includes(m.id))) {
      expect(modOn(off, mod.id)).toBe(modOn(on, mod.id))
    }
  })

  it('takes the games of one pack and no other', async () => {
    const { NO_SWITCHES, modOn, withMod } = await import('../src/shared/mods')
    const { MINI_GAMES_LIST, gamesOffered } = await import('../src/shared/minigames')
    const { MINI_GAMES } = await import('../src/shared/minigames')
    const pack = 'morrowkiln-card-games'
    const off = withMod(withMod(NO_SWITCHES, MINI_GAMES, true), pack, false)
    const offered = gamesOffered({ location: 'room', girls: 1 }, (modId) => modOn(off, modId))
    expect(offered.some((game) => game.modId === pack)).toBe(false)
    expect(offered.length).toBeGreaterThan(0)
    expect(MINI_GAMES_LIST.some((game) => game.modId === pack)).toBe(true)
  })
})

it('lets the framework gate Darts while respecting the pack switch', async () => {
  const { NO_SWITCHES, modOn, withMod, modById } = await import('../src/shared/mods')
  const { MINI_GAMES } = await import('../src/shared/minigames')
  expect(modById('naudh1r-darts')?.defaultOn).toBe(true)
  const on = withMod(NO_SWITCHES, MINI_GAMES, true)
  expect(modOn(on, 'naudh1r-darts')).toBe(true)
  expect(modOn(withMod(on, MINI_GAMES, false), 'naudh1r-darts')).toBe(false)
  expect(modOn(withMod(on, 'naudh1r-darts', false), 'naudh1r-darts')).toBe(false)
})
