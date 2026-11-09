import { describe, expect, it } from 'vitest'
import {
  AIM_REACH,
  accountOf,
  canRerack,
  herRerack,
  herTarget,
  dropped,
  handScatter,
  herThrow,
  landingOf,
  newGame,
  outcomeOf,
  rackOf,
  readerThrow,
  rerack,
  resolve,
  scatterOf,
  shotTold,
  strays,
  summaryOf,
  sweepSpeed,
  sweepWobble,
  teamsOf,
  throwAt,
  throwBall,
  throwerOf,
  tightened,
  tipsiness,
  tipsyOf,
  type Cup,
  type Game,
  type Skill,
  type Throw
} from '../src/shared/minigameRules/beerPong'
import BEER_PONG from '../src/shared/minigameEntries/beer-pong'
import { gamesOffered, groupsFor, suggestRate } from '../src/shared/minigames'

/** Beer Pong's rules: where a ball lands, the turns, redemption and overtime, the drink and how she throws. */

function seeded(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296
}

const never = (): number => {
  throw new Error('asked the dice')
}

const MISS: Throw = { aim: 0, power: 0 }
/** A throw dead into the first cup the throwing side has to hit. */
const hit = (game: Game): Throw => {
  const cup = game.sides[game.turn === 0 ? 1 : 0].cups[0]
  return throwAt({ x: cup.x, y: cup.y })
}
/** Plays a string of throws: `x` a cup, `.` a miss. */
const playOut = (game: Game, throws: string): Game =>
  [...throws].reduce((now, each) => throwBall(now, each === 'x' ? hit(now) : MISS, never), game)
const whos = (game: Game): number[] => game.log.map((shot) => shot.who)

describe('Beer Pong throws', () => {
  it('racks 6, 10 and 3 cups in touching rows', () => {
    for (const count of [3, 6, 10]) {
      const rack = rackOf(count)
      expect(rack).toHaveLength(count)
      expect(strays(rack)).toBe(0)
    }
  })

  it('sinks a ball on a cup, misses between and short, and knows the table edge, without dice', () => {
    const rack = rackOf(6)
    expect(resolve({ x: 0.1, y: 0.1 }, rack, never)).toMatchObject({ kind: 'sunk', cup: { id: 1 } })
    expect(resolve({ x: 0, y: -1.2 }, rack, never).kind).toBe('miss')
    expect(resolve({ x: 2.3, y: 0 }, rack, never).kind).toBe('miss')
    expect(resolve({ x: 0, y: 4.4 }, rack, never).kind).toBe('off')
    expect(landingOf({ aim: 1, power: 0.3 }).x).toBe(AIM_REACH)
    const back = landingOf(throwAt({ x: -0.5, y: 0.866 }))
    expect(back.x).toBeCloseTo(-0.5)
    expect(back.y).toBeCloseTo(0.866)
  })

  it('lets the dice decide a rim, kinder the nearer the middle', () => {
    const cup: Cup[] = [{ id: 1, x: 0, y: 0 }]
    expect(resolve({ x: 0.45, y: 0 }, cup, () => 0).kind).toBe('rim-in')
    expect(resolve({ x: 0.45, y: 0 }, cup, () => 0.99).kind).toBe('rim-out')
    const rate = (far: number): number => {
      const rand = seeded(7)
      let made = 0
      for (let i = 0; i < 2000; i++) if (resolve({ x: far, y: 0 }, cup, rand).kind === 'rim-in') made++
      return made / 2000
    }
    expect(rate(0.38)).toBeGreaterThan(rate(0.57) + 0.25)
  })
})

describe('Beer Pong sides and turns', () => {
  it('makes the sides for one, two and three girls', () => {
    expect(teamsOf(1)).toEqual([[0], [1]])
    expect(teamsOf(2)).toEqual([[0], [1, 2]])
    expect(teamsOf(3)).toEqual([[0, 1], [2, 3]])
  })

  it('gives each side two throws a turn, one per teammate where there are two', () => {
    expect(whos(playOut(newGame(1, 6), '......'))).toEqual([0, 0, 1, 1, 0, 0])
    expect(whos(playOut(newGame(2, 6), '......'))).toEqual([0, 0, 1, 2, 0, 0])
    expect(whos(playOut(newGame(3, 6), '........'))).toEqual([0, 1, 2, 3, 0, 1, 2, 3])
  })

  it('takes the cup, has the other side drink it in turn, and brings the balls back once', () => {
    const game = playOut(newGame(2, 6), 'xx')
    expect(game.sides[1].cups).toHaveLength(4)
    expect(game.drinks).toEqual([0, 1, 1])
    expect(game.log[1].ballsBack).toBe(true)
    expect(game.turn).toBe(0)
    // Two more sunk on the balls back earn nothing further.
    const again = playOut(game, 'xx')
    expect(again.log[3].ballsBack).toBe(false)
    expect(again.turn).toBe(1)
    expect(again.drinks).toEqual([0, 2, 2])
    expect(throwerOf(again)).toBe(1)
    // One of two is just a turn.
    expect(playOut(newGame(1, 6), 'x.').turn).toBe(1)
  })

  it('allows one re-rack a side, at four, three or two cups, on its own turn', () => {
    let game = newGame(1, 6)
    expect(canRerack(game, 0)).toBe(false)
    game = playOut(game, 'xxx...')
    expect(game.sides[1].cups).toHaveLength(3)
    expect(canRerack(game, 0)).toBe(true)
    expect(canRerack(game, 1)).toBe(false)
    const racked = rerack(game, 0)
    expect(racked.sides[1].cups.map((cup) => cup.id)).toEqual(game.sides[1].cups.map((cup) => cup.id))
    expect(strays(racked.sides[1].cups)).toBe(0)
    expect(racked.sides[0].reracked).toBe(true)
    expect(canRerack(racked, 0)).toBe(false)
    expect(rerack(racked, 0)).toBe(racked)
    for (const count of [2, 3, 4]) expect(strays(tightened(rackOf(10).slice(-count)))).toBe(0)
  })

  it('has her call her re-rack when the cups are scattered and keep it when they are not', () => {
    const at = (cups: Cup[]): Game => {
      const game = newGame(1, 6)
      return { ...game, turn: 1, sides: [{ ...game.sides[0], cups }, game.sides[1]] }
    }
    const rack = rackOf(6)
    expect(herRerack(at([rack[0], rack[3], rack[5]]), 1)).toBe(true)
    expect(herRerack(at([rack[0], rack[1], rack[2]]), 1)).toBe(false)
    expect(herRerack(at([rack[0], rack[1], rack[2], rack[5]]), 1)).toBe(false)
    expect(herRerack(at(rack.slice(0, 5)), 1)).toBe(false)
  })
})

describe('Beer Pong endings', () => {
  /** The reader clears all six, the other side having sunk nothing. */
  const cleared = (): Game => playOut(newGame(1, 6), '..' + '..' + 'xxxx' + '..' + 'xx')

  it('gives the cleared side a redemption that ends on its first miss', () => {
    const game = cleared()
    expect(game.log[game.log.length - 1].cleared).toBe(true)
    expect(game.winner).toBeNull()
    expect(game.leader).toBe(0)
    expect(game.turn).toBe(1)
    // She keeps throwing while they drop, past two.
    const three = playOut(game, 'xxx')
    expect(three.winner).toBeNull()
    expect(three.turn).toBe(1)
    const lost = playOut(three, '.')
    expect(lost.winner).toBe(0)
    expect(outcomeOf(lost)).toBe('won')
    expect(lost.log[lost.log.length - 1].final).toBe(true)
    expect(throwBall(lost, MISS, never)).toBe(lost)
  })

  it('goes to a three-cup overtime when the redemption clears the rest, and plays that out', () => {
    const game = playOut(cleared(), 'xxxxxx')
    expect(game.log[game.log.length - 1].overtime).toBe(true)
    expect(game.overtimes).toBe(1)
    expect(game.winner).toBeNull()
    expect(game.sides.map((side) => side.cups.length)).toEqual([3, 3])
    expect(game.turn).toBe(0)
    expect(game.drinks).toEqual([6, 6])
    // She clears the overtime rack; the reader's redemption fails.
    const end = playOut(game, '..xx' + 'x' + '.')
    expect(end.winner).toBe(1)
    expect(outcomeOf(end)).toBe('lost')
    expect(end.drinks).toEqual([9, 6])
  })
})

describe('Beer Pong drink', () => {
  it('speeds and shakes the sweeps and widens her scatter with every cup, up to a cap', () => {
    expect(tipsiness(0, 1)).toBe(0)
    expect(tipsiness(3, 1)).toBeGreaterThan(tipsiness(3, 2))
    expect(tipsiness(40, 1)).toBe(1)
    expect(sweepSpeed(0)).toBe(1)
    expect(sweepWobble(0)).toBe(0)
    expect(sweepSpeed(1)).toBeGreaterThan(1)
    expect(sweepSpeed(1)).toBeLessThanOrEqual(1.5)
    expect(sweepWobble(1)).toBeLessThanOrEqual(0.08)
    expect(scatterOf(3, 1)).toBeGreaterThan(scatterOf(3, 0))
    const game = playOut(newGame(2, 6), 'xxxx')
    expect(tipsyOf(game, 1)).toBeCloseTo(2 / 6)
    expect(tipsyOf(game, 0)).toBe(0)
  })

  it('has a good player pick a cup and a poor one lob at the middle', () => {
    const pair: Cup[] = [{ id: 1, x: -1, y: 0 }, { id: 2, x: 1, y: 0 }]
    expect(herTarget(pair, 5)).toEqual({ x: -1, y: 0 })
    expect(herTarget(pair, 1)).toEqual({ x: 0, y: 0 })
  })

  it('sinks more the better she is, and fewer the more she has drunk', () => {
    const rate = (skill: Skill, tipsy: number): number => {
      const rand = seeded(11 + skill)
      const rack = rackOf(6)
      let made = 0
      for (let i = 0; i < 3000; i++) {
        const kind = resolve(landingOf(herThrow(rack, skill, tipsy, rand)), rack, rand).kind
        if (kind === 'sunk' || kind === 'rim-in') made++
      }
      return made / 3000
    }
    const sober = ([1, 2, 3, 4, 5] as const).map((skill) => rate(skill, 0))
    for (let i = 1; i < 5; i++) expect(sober[i]).toBeGreaterThan(sober[i - 1] + 0.03)
    expect(sober[0]).toBeGreaterThan(0.05)
    expect(sober[4]).toBeLessThan(0.9)
    expect(rate(4, 1)).toBeLessThan(sober[3] - 0.08)
  })
})

describe('Beer Pong, the reader and whole games', () => {
  it('lets a well-stopped throw drop about as often as a good player\'s, and still often enough at the cap', () => {
    const rack = rackOf(6)
    const dead = throwAt({ x: rack[4].x, y: rack[4].y })
    const rate = (tipsy: number): number => {
      const rand = seeded(23)
      let made = 0
      for (let i = 0; i < 4000; i++) if (dropped(resolve(landingOf(readerThrow(dead, tipsy, rand)), rack, rand).kind)) made++
      return made / 4000
    }
    expect(handScatter(1)).toBeGreaterThan(handScatter(0))
    expect(rate(0)).toBeGreaterThan(0.4)
    expect(rate(0)).toBeLessThan(0.65)
    expect(rate(1)).toBeGreaterThan(0.25)
    expect(rate(1)).toBeLessThan(rate(0))
  })

  it('always ends, and the drinks are the cups sunk, whoever is playing', () => {
    for (const girls of [1, 2, 3]) {
      for (const cups of [6, 10]) {
        for (let seed = 1; seed <= 40; seed++) {
          const rand = seeded(seed * 97 + girls * 7 + cups)
          let game = newGame(girls, cups)
          while (game.winner === null && game.log.length < 3000) {
            const side = game.turn
            if (herRerack(game, side)) game = rerack(game, side)
            // Whoever is up is on the side throwing, and there is always someone.
            expect(game.sides[side].members).toContain(throwerOf(game))
            const skill = ((seed + throwerOf(game)) % 5) + 1
            game = throwBall(game, herThrow(game.sides[side === 0 ? 1 : 0].cups, skill as Skill, tipsyOf(game, side), rand), rand)
          }
          expect(game.winner).not.toBeNull()
          const made = (side: number): number => game.log.filter((shot) => shot.side === side && dropped(shot.kind)).length
          const drunk = (side: 0 | 1): number[] => game.sides[side].members.map((who) => game.drinks[who])
          for (const side of [0, 1] as const) {
            expect(drunk(side).reduce((sum, each) => sum + each, 0)).toBe(made(side === 0 ? 1 : 0))
            expect(Math.max(...drunk(side)) - Math.min(...drunk(side))).toBeLessThanOrEqual(1)
            expect(game.reracks.filter((rack) => rack.side === side).length).toBeLessThanOrEqual(1)
          }
          for (const rack of game.reracks) expect([2, 3, 4]).toContain(rack.cups)
          // The balls come back once a turn at most, and a redemption is the last of a game or the start of an overtime.
          const backs = new Map<number, number>()
          for (const shot of game.log) if (shot.ballsBack) backs.set(shot.turn, (backs.get(shot.turn) ?? 0) + 1)
          for (const count of backs.values()) expect(count).toBe(1)
          expect(game.log.filter((shot) => shot.overtime).length).toBe(game.overtimes)
          expect(game.log.filter((shot) => shot.final).length).toBe(1)
          expect(game.log[game.log.length - 1]).toMatchObject({ final: true, redemption: true })
          expect(accountOf(['Ana', 'Bea', 'Cy'].slice(0, girls), game).length).toBeLessThanOrEqual(26)
        }
      }
    }
  })
})

describe('Beer Pong told', () => {
  it('names everyone and what they drank in the summary and the account', () => {
    const names = ['Ana', 'Bea', 'Cy']
    let game = playOut(newGame(3, 6), 'xx' + 'xx' + '..' + 'x.')
    game = playOut(game, 'xx' + 'x.')
    const told = shotTold(names, playOut(newGame(3, 6), 'xx'))
    expect(told.moments).toContain('balls-back')
    expect(told.narration).toContain('Ana')
    // The reader's side clears the last, and the redemption misses.
    while (game.winner === null) game = playOut(game, game.leader !== null ? '.' : game.turn === 0 ? 'x' : '.')
    expect(game.winner).toBe(0)
    const summary = summaryOf(names, game)
    const account = accountOf(names, game).join('\n')
    for (const name of names) {
      expect(summary).toContain(name)
      expect(account).toContain(name)
    }
    expect(summary).toMatch(/^You and Ana play .* win/)
    expect(account).toContain('the reader')
    game.drinks.forEach((cups) => expect(account).toContain(`${cups === 0 ? 'no' : cups} cup`))
    expect(account).toMatch(/sober|buzzed|tipsy/)
    expect(game.drinks.reduce((sum, cups) => sum + cups, 0)).toBe(game.log.filter((shot) => shot.drinker !== null).length)
  })

  it('tells rim luck from aim in the account', () => {
    const cup = (game: Game): Cup => game.sides[game.turn === 0 ? 1 : 0].cups[0]
    let game = newGame(1, 6)
    for (let i = 0; i < 2; i++) game = throwBall(game, throwAt({ x: cup(game).x, y: cup(game).y - 0.45 }), () => 0)
    game = playOut(game, '..' + '..' + 'xxxx')
    game = playOut(game, '.')
    expect(accountOf(['Ana'], game).join('\n')).toContain('2 off the rim')
  })
})

describe('Beer Pong on offer', () => {
  it('is played where there are cups, one girl to three, and comes up most at the bar', () => {
    const on = (): boolean => true
    expect(gamesOffered({ location: 'stalestein_bar', girls: 1 }, on, [BEER_PONG])).toHaveLength(1)
    expect(gamesOffered({ location: 'stalestein_bar', girls: 0 }, on, [BEER_PONG])).toHaveLength(0)
    expect(gamesOffered({ location: 'library', girls: 2 }, on, [BEER_PONG])).toHaveLength(0)
    expect(groupsFor(BEER_PONG, ['a', 'b', 'c', 'd'])).toHaveLength(4)
    expect(suggestRate(BEER_PONG, 'stalestein_bar', false)).toBe('often')
    expect(suggestRate(BEER_PONG, 'room', false)).toBe('never')
  })
})
