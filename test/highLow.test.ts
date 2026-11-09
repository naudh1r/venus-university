import { describe, expect, it } from 'vitest'
import {
  callTold,
  callWins,
  herCall,
  oddsCall,
  progressAccount,
  reshuffled,
  turnedCards,
  versusAccount,
  versusOver,
  type Call
} from '../src/shared/minigameRules/highLow'
import { freshDeck, seededRand, type Card } from '../src/shared/minigameKit'

/** High-Low's rules: what a call wins on, and the deck it is played from. */

const card = (rank: number): Card => ({ rank, suit: 'spades' })

describe('High-Low', () => {
  it('counts a card of the same rank as a miss whichever way the call went', () => {
    expect(callWins(card(7), card(7), 'higher')).toBe(false)
    expect(callWins(card(7), card(7), 'lower')).toBe(false)
    expect(callWins(card(7), card(8), 'higher')).toBe(true)
    expect(callWins(card(7), card(8), 'lower')).toBe(false)
    expect(callWins(card(14), card(2), 'lower')).toBe(true)
  })

  it('plays from all fifty-two cards, each once', () => {
    const deck = freshDeck()
    expect(new Set(deck.map((c) => `${c.rank}${c.suit}`)).size).toBe(52)
  })

  it('has every girl read an obvious card, and only a sharp one read a close one', () => {
    const king = card(13)
    const eight = card(8)
    const never = (): number => {
      throw new Error('guessed')
    }
    // A king is lower for anyone, with no guess taken.
    expect(herCall(king, [king], 1, never)).toBe('lower')
    // An eight with two low cards gone leans higher by a hair: the sharpest reads it, the
    // weakest guesses.
    const seen = [eight, card(2), card(3)]
    expect(herCall(eight, seen, 5, never)).toBe('higher')
    expect(herCall(eight, seen, 1, () => 0)).toBe('higher')
    expect(herCall(eight, seen, 1, () => 0.9)).toBe('lower')
  })

  it('ends sudden death only when one is ahead after equal turns', () => {
    const call = (hers: boolean, right: boolean) => ({ hers, call: 'higher' as const, right })
    // He is ahead, but she has not had her call.
    expect(versusOver([call(false, true)], 5, true)).toBe(false)
    // Level after a call each: on they go.
    expect(versusOver([call(false, true), call(true, true)], 5, true)).toBe(false)
    expect(versusOver([call(false, false), call(true, false)], 5, true)).toBe(false)
    // Ahead after equal turns: over, however few calls it took.
    expect(versusOver([call(false, false), call(true, true)], 5, true)).toBe(true)
    // A normal game runs its length whatever the count.
    expect(versusOver([call(false, false), call(true, true)], 5, false)).toBe(false)
  })

  it('goes on past the end of the deck in sudden death, on the turned cards reshuffled', () => {
    const call = (hers: boolean, right: boolean) => ({ hers, call: 'higher' as const, right })
    // Level through every card of the deck: still nobody ahead, so still not over.
    const level = Array.from({ length: 50 }, (_, i) => call(i % 2 === 1, true))
    expect(versusOver(level, 5, true)).toBe(false)
    expect(versusOver([...level, call(false, false), call(true, false)], 5, true)).toBe(false)
    expect(versusOver([...level, call(false, true), call(true, false)], 5, true)).toBe(true)

    const id = (c: Card): string => `${c.rank}${c.suit}`
    let deck = freshDeck(seededRand('high-low'))
    for (let round = 1; round <= 3; round++) {
      const before = deck
      deck = reshuffled(deck, seededRand(`again ${round}`))
      // What was dealt stays as it was; fifty-one more cards follow it.
      expect(deck.slice(0, before.length)).toEqual(before)
      expect(deck.length).toBe(52 + 51 * round)
      // The card left showing and the new pack are one whole deck, each card once.
      const pack = deck.slice(before.length - 1)
      expect(new Set(pack.map(id)).size).toBe(52)
    }
    // The count of cards starts over with the pack: only the card showing is out of a new one.
    expect(turnedCards(deck, 50)).toEqual(deck.slice(0, 51))
    expect(turnedCards(deck, 51)).toEqual([deck[51]])
    expect(turnedCards(deck, 60)).toEqual(deck.slice(51, 61))
    expect(turnedCards(deck, 102)).toEqual([deck[102]])
    // So the odds on a card of the new pack are read off the new pack alone.
    expect(oddsCall(deck[60], turnedCards(deck, 60))).toEqual(
      oddsCall(deck[60], deck.slice(51, 61))
    )
  })

  it('plays sudden death through reshuffles to a winner, every call judged', () => {
    // Two who always call with the odds, on decks that keep them level as long as they can be.
    for (let game = 0; game < 200; game++) {
      const rand = seededRand(`sudden ${game}`)
      let deck = freshDeck(rand)
      const made: { hers: boolean; call: Call; right: boolean }[] = []
      // Forced level for a long while, to drive the deck out; then the cards decide.
      while (!versusOver(made, 5, true)) {
        const i = made.length
        if (i + 1 >= deck.length) deck = reshuffled(deck, rand)
        const called = herCall(deck[i], turnedCards(deck, i), 5, rand)
        const right = i < 120 ? true : callWins(deck[i], deck[i + 1], called)
        made.push({ hers: i % 2 === 1, call: called, right })
        expect(made.length).toBeLessThan(2000)
      }
      expect(made.length).toBeGreaterThan(120)
      const mine = made.filter((c) => !c.hers && c.right).length
      const hers = made.filter((c) => c.hers && c.right).length
      expect(mine).not.toBe(hers)
      const account = versusAccount('Mia', deck, made, true)
      expect(account).toContain(
        'The deck ran out along the way: the turned cards were shuffled into a new one.'
      )
      expect(account.at(-1)).toBe(`Final count: the reader ${mine}, Mia ${hers}.`)
    }
  })

  describe('as the scene is told it', () => {
    const made = (hers: boolean, call: Call, right: boolean) => ({ hers, call, right })

    it('marks a call that could not win', () => {
      const told = callTold('Mia', [card(2), card(9)], [made(false, 'lower', false)], 0)
      expect(told.line).toBe(
        'The reader called lower on a two and a nine came: a miss, a call that could not win: nothing is lower than a two.'
      )
      expect(told.notable).toBe(true)
      const ace = callTold('Mia', [card(14), card(9)], [made(true, 'higher', false)], 0)
      expect(ace.line).toContain('Mia called higher on an ace')
      expect(ace.line).toContain('a call that could not win: nothing is higher than an ace')
    })

    it('tells a bad call against the odds from a long shot that lands', () => {
      // Higher on a queen: the cards clearly favour lower.
      const bad = callTold('Mia', [card(12), card(5)], [made(true, 'higher', false)], 0)
      expect(bad.line).toBe(
        'Mia called higher on a queen and a five came: a miss, a bad call: the cards clearly favoured lower.'
      )
      expect(bad).toMatchObject({ notable: true, poor: true })
      const landed = callTold('Mia', [card(12), card(13)], [made(false, 'higher', true)], 0)
      expect(landed.line).toBe(
        'The reader called higher on a queen and a king came: right, a long shot that came in.'
      )
      expect(landed).toMatchObject({ notable: true, poor: true })
    })

    it('calls a safe call that fails bad luck, not bad play', () => {
      const told = callTold('Mia', [card(3), card(2)], [made(false, 'higher', false)], 0)
      expect(told.line).toBe(
        'The reader called higher on a three and a two came: a miss, a safe call that failed: plain bad luck.'
      )
      expect(told).toMatchObject({ notable: true, poor: false })
    })

    it('says the same rank again, and leaves an ordinary call unmarked', () => {
      const again = callTold(
        'Mia',
        [card(9), { rank: 9, suit: 'hearts' }],
        [made(false, 'lower', false)],
        0
      )
      expect(again.line).toBe(
        'The reader called lower on a nine and a nine came: a miss, the same rank again.'
      )
      expect(again.notable).toBe(true)
      const plain = callTold('Mia', [card(9), card(4)], [made(true, 'lower', true)], 0)
      expect(plain.line).toBe('Mia called lower on a nine and a four came: right.')
      expect(plain).toMatchObject({ notable: false, poor: false })
    })

    it('judges a call on the cards turned by then, not the deck as it started', () => {
      // A nine after every higher card but one king has gone: lower is now the plain call.
      const deck = [card(8), card(9), card(13)]
      const calls = [made(false, 'higher', true), made(true, 'higher', true)]
      expect(callTold('Mia', deck, calls, 1).poor).toBe(false)
      const gone: Card[] = []
      for (const rank of [10, 11, 12, 13, 14])
        for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const)
          gone.push({ rank, suit })
      const thin = [...gone.slice(0, 19), card(9), gone[19]]
      const run = thin.slice(0, -1).map((_, i) => made(i % 2 === 1, 'higher', true))
      expect(callTold('Mia', thin, run, 19)).toMatchObject({ poor: true, notable: true })
    })

    it('tallies the account: calls each, who went against the odds, and the final count', () => {
      const deck = [card(12), card(13), card(2), card(9), card(4)]
      const calls = [
        made(false, 'higher', true), // against the odds, and it lands
        made(true, 'lower', true),
        made(false, 'lower', false), // on a two
        made(true, 'lower', true)
      ]
      const account = versusAccount('Mia', deck, calls)
      expect(account).toHaveLength(1 + 4 + 3)
      expect(account[0]).toContain('Each called 2 times, in turn')
      expect(account.slice(1, 5)).toEqual(calls.map((_, i) => callTold('Mia', deck, calls, i).line))
      expect(account.slice(5)).toEqual([
        'The reader called against the odds 2 times: poor play, not bad luck.',
        'Mia played the odds every time.',
        'Final count: the reader 1, Mia 2.'
      ])
      // A call that could not win is told as that, and counts as one against the odds.
      expect(account[3]).toContain('a call that could not win')

      const sudden = versusAccount('Mia', deck.slice(0, 3), calls.slice(0, 2), true)
      expect(sudden[0]).toContain('sudden death')
      expect(sudden[1]).toContain('Each called once')
      expect(sudden.at(-1)).toBe('Final count: the reader 1, Mia 1.')
    })

    it('says how a game stood for one walked away from', () => {
      const deck = [card(12), card(5), card(9), card(4)]
      const calls = [made(false, 'lower', true), made(true, 'higher', true), made(false, 'lower', true)]
      expect(progressAccount('Mia', deck, calls)).toEqual([
        ...calls.map((_, i) => callTold('Mia', deck, calls, i).line),
        'Count so far: the reader 2, Mia 1.'
      ])
      expect(progressAccount(null, deck, calls.slice(0, 1))).toEqual([
        'The reader had made 1 call and got 1 right.'
      ])
    })
  })
})
