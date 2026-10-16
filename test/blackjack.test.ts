import { describe, expect, it } from 'vitest'
import {
  drawCard,
  gameOutcome,
  gameOver,
  girlMove,
  handTotal,
  handWinner,
  isNatural,
  matchSummary,
  remarkBy,
  resultLine,
  soundAt,
  tableAccount,
  tableDeal,
  tableSummary,
  tableTold,
  tableWinner,
  tableWon,
  type Move,
  type TableHand
} from '../src/shared/minigameRules/blackjack'
import type { Card } from '../src/shared/minigameKit'
import { MINI_GAMES, MINI_GAMES_LIST, settledOptions } from '../src/shared/minigames'

/** Blackjack's rules: what a hand is worth, which hand wins, and how she plays hers. */

const hand = (...ranks: number[]): Card[] => ranks.map((rank) => ({ rank, suit: 'spades' }))

const never = (): number => {
  throw new Error('guessed')
}

describe('Blackjack', () => {
  it('counts each ace as eleven only while the hand stays at 21 or under', () => {
    expect(handTotal(hand(14, 6))).toEqual({ total: 17, soft: true })
    expect(handTotal(hand(14, 6, 13))).toEqual({ total: 17, soft: false })
    expect(handTotal(hand(14, 14, 9))).toEqual({ total: 21, soft: true })
    expect(handTotal(hand(12, 13, 5)).total).toBe(25)
  })

  it('puts a two-card 21 over a longer one, and loses the reader his bust whatever she holds', () => {
    expect(handWinner(hand(14, 13), hand(7, 7, 7))).toBe('reader')
    expect(handWinner(hand(10, 5, 6), hand(14, 12))).toBe('her')
    expect(handWinner(hand(10, 9), hand(9, 10))).toBe('push')
    expect(handWinner(hand(10, 9, 5), hand(10, 9, 5))).toBe('her')
  })

  it('has the best player draw until she is ahead and no further', () => {
    const his = hand(10, 8)
    expect(soundAt(hand(10, 7), [his])).toBe('hit')
    expect(soundAt(hand(10, 9), [his])).toBe('stand')
    // Level: worth a card on fourteen, not on eighteen.
    expect(soundAt(hand(10, 4), [hand(8, 6)])).toBe('hit')
    expect(soundAt(hand(10, 8), [his])).toBe('stand')
    // He has bust, or holds a two-card 21 she cannot catch: she leaves her hand alone.
    expect(soundAt(hand(2, 3), [hand(10, 6, 9)])).toBe('stand')
    expect(soundAt(hand(10, 6), [hand(14, 13)])).toBe('stand')
    expect(girlMove(hand(10, 7), [his], [], 5, never)).toBe('hit')
  })

  it('has a weak player lose her nerve or overreach, and only where a person would', () => {
    const his = hand(10, 8)
    // Behind on a hand a card could break: she may stand on it.
    expect(girlMove(hand(10, 5), [his], [], 1, () => 0)).toBe('stand')
    expect(girlMove(hand(10, 5), [his], [], 1, () => 0.9)).toBe('hit')
    // The same roll does not catch a better player.
    expect(girlMove(hand(10, 5), [his], [], 4, () => 0.2)).toBe('hit')
    // Behind on a hand no card can break: nobody stands.
    expect(girlMove(hand(5, 4), [his], [], 1, never)).toBe('hit')
    // Ahead on a middling hand she may draw again; on a strong one she never does.
    expect(girlMove(hand(10, 6), [hand(10, 5)], [], 1, () => 0)).toBe('hit')
    expect(girlMove(hand(10, 10), [his], [], 1, never)).toBe('stand')
    expect(girlMove(hand(10, 2), [hand(10, 6, 9)], [], 1, never)).toBe('stand')
  })

  it('ends the match once the lead cannot be caught', () => {
    expect(gameOver([2, 0], 2, 3)).toBe(true)
    expect(gameOver([1, 0], 2, 3)).toBe(false)
    expect(gameOver([1, 1], 3, 3)).toBe(true)
    // Two pushes and a hand in hand: one behind with one to play is still alive.
    expect(gameOver([0, 1], 4, 5)).toBe(false)
  })

  it('knows a two-card 21 from any other, and calls level hands a push', () => {
    expect(isNatural(hand(14, 12))).toBe(true)
    expect(isNatural(hand(7, 7, 7))).toBe(false)
    expect(isNatural(hand(14, 9))).toBe(false)
    expect(handWinner(hand(14, 10), hand(14, 13))).toBe('push')
    expect(handWinner(hand(7, 7, 7), hand(10, 5, 6))).toBe('push')
    expect(handWinner(hand(10, 10), hand(10, 6, 9))).toBe('reader')
  })

  it('draws from the top, and cuts a new deck when the old one runs out', () => {
    const [top, rest] = drawCard(hand(5, 9))
    expect(top.rank).toBe(5)
    expect(rest.map((c) => c.rank)).toEqual([9])
    const [, fresh] = drawCard([], () => 0.5)
    expect(fresh.length).toBe(51)
    // A deck cut mid-hand leaves out every card on the table.
    const held: Card[] = [
      { rank: 14, suit: 'spades' },
      { rank: 10, suit: 'hearts' },
      { rank: 2, suit: 'clubs' }
    ]
    const [first, others] = drawCard([], () => 0.5, held)
    const cut = [first, ...others]
    expect(cut.length).toBe(49)
    for (const card of held) {
      expect(cut.some((c) => c.rank === card.rank && c.suit === card.suit)).toBe(false)
    }
  })

  it('slips more often the weaker she is, and never at her best', () => {
    // A seeded roll, so the same hands are played the same way every run.
    const seeded = (seed: number) => (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    const his = hand(10, 8)
    const slips = ([1, 2, 3, 4, 5] as const).map((skill) => {
      const rand = seeded(7)
      let wrong = 0
      for (let i = 0; i < 400; i++) {
        // Behind on fifteen, where a card is right, and ahead on sixteen, where it is not.
        if (girlMove(hand(10, 5), [his], [], skill, rand) !== 'hit') wrong++
        if (girlMove(hand(10, 6), [hand(10, 5)], [], skill, rand) !== 'stand') wrong++
      }
      return wrong
    })
    expect(slips[4]).toBe(0)
    for (let i = 0; i < 4; i++) expect(slips[i]).toBeGreaterThan(slips[i + 1])
  })

  it('counts the hands each has won, pushes to nobody', () => {
    const played = (mine: Card[], hers: Card[]): TableHand => ({
      mine,
      hits: [],
      girls: [{ cards: hers, moves: [] }]
    })
    const hands = [
      played(hand(10, 10), hand(10, 9)),
      played(hand(10, 8), hand(10, 8)),
      played(hand(10, 6, 9), hand(5, 5))
    ]
    expect(tableWon(hands, 1)).toEqual([1, 1])
    expect(gameOver([1, 1], 3, 3)).toBe(true)
  })

  it('says the deal, the result and the match as the scene narrates them', () => {
    expect(tableDeal(['Mio'], 2, hand(13, 6), hand(9))).toBe(
      'Hand 2. You are dealt a king and a six: 16. Mio shows a nine, her other card face down.'
    )
    expect(resultLine('Mio', hand(10, 6, 9), hand(5, 5))).toBe("The hand is Mio's.")
    expect(resultLine('Mio', hand(10, 9), hand(10, 6, 9))).toBe('The hand is yours.')
    expect(resultLine('Mio', hand(10, 9), hand(10, 9))).toContain('a push')
    expect(resultLine('Mio', hand(14, 13), hand(7, 7, 7))).toBe(
      'Your 21 in two cards beats her 21: the hand is yours.'
    )
    expect(matchSummary('Mio', 2, 1)).toBe('You play blackjack with Mio and win, 2 hands to 1.')
    expect(matchSummary('Mio', 0, 1)).toBe('You play blackjack with Mio and lose, 0 hands to 1.')
    expect(matchSummary('Mio', 1, 1)).toBe('You play blackjack with Mio and it ends level, 1 hand each.')
  })

  it('tells bad play from bad luck in the account', () => {
    // He drew on a hard eighteen and went over; she never had to play.
    const reckless: TableHand = {
      mine: hand(10, 8, 9),
      hits: [{ total: 18, soft: false }],
      girls: [{ cards: hand(10, 2), moves: [] }]
    }
    // He stood on twenty; she drew to 21 from behind: one point in it.
    const beaten: TableHand = {
      mine: hand(10, 10),
      hits: [],
      girls: [{ cards: hand(10, 6, 5), moves: [
        { move: 'hit', total: 16, sound: 'hit' },
        { move: 'stand', total: 21, sound: 'stand' }
      ] }]
    }
    // She stood on fifteen while still behind his eighteen.
    const timid: TableHand = {
      mine: hand(10, 8),
      hits: [],
      girls: [{ cards: hand(10, 5), moves: [{ move: 'stand', total: 15, sound: 'hit' }] }]
    }
    // She was ahead on sixteen, drew anyway and went over.
    const greedy: TableHand = {
      mine: hand(10, 5),
      hits: [],
      girls: [{ cards: hand(10, 6, 10), moves: [{ move: 'hit', total: 16, sound: 'stand' }] }]
    }
    const first = tableTold(['Mio'], reckless, 1)
    expect(first.line).toContain('hit on 18 and bust with 27, a reckless call')
    expect(first.line).toContain('Mio had only to turn her card, holding 12')
    expect(first.notable).toBe(true)
    const second = tableTold(['Mio'], beaten, 2)
    expect(second.line).toContain('the reader stood on 20')
    expect(second.line).toContain('Mio hit on 16 and stood on 21')
    expect(second.line).toContain('Mio won it by a single point')
    expect(tableTold(['Mio'], timid, 3).line).toContain('a mistake: she was still behind his 18')
    expect(tableTold(['Mio'], greedy, 4).line).toContain('she was already ahead on 16 and threw the hand away')

    const account = tableAccount(['Mio'], [reckless, beaten], 3)
    expect(account[0]).toContain('over 3 hands')
    expect(account).toHaveLength(5)
    expect(account[3]).toBe('The match stopped there: the lead could no longer be caught.')
    expect(account[4]).toBe('Final count of hands: the reader 0, Mio 2.')
    const full = tableAccount(['Mio'], [timid, greedy, beaten], 3)
    expect(full).toHaveLength(5)
    expect(full[4]).toBe('Final count of hands: the reader 2, Mio 1.')
  })

  it('gives a hand to the one best seat at a table of three or four, and to nobody otherwise', () => {
    // Sole best, wherever it sits.
    expect(tableWinner([hand(10, 8), hand(10, 9), hand(10, 7)])).toBe(1)
    expect(tableWinner([hand(10, 10), hand(10, 9), hand(10, 6, 9), hand(9, 9)])).toBe(0)
    expect(tableWinner([hand(10, 6, 9), hand(10, 5, 9), hand(10, 4, 9), hand(2, 3)])).toBe(3)
    // The best shared is a push, even with a third hand beaten under it.
    expect(tableWinner([hand(10, 9), hand(9, 10), hand(10, 7)])).toBeNull()
    expect(tableWinner([hand(10, 7), hand(10, 9), hand(10, 2), hand(9, 10)])).toBeNull()
    // Everyone bust.
    expect(tableWinner([hand(10, 6, 9), hand(10, 5, 9), hand(10, 4, 9)])).toBeNull()
    expect(tableWinner([hand(10, 6, 9), hand(10, 5, 9), hand(10, 4, 9), hand(10, 3, 9)])).toBeNull()
    // A two-card 21 over one made with more, and level with another.
    expect(tableWinner([hand(7, 7, 7), hand(14, 13), hand(10, 10)])).toBe(1)
    expect(tableWinner([hand(7, 7, 7), hand(10, 5, 6), hand(10, 10), hand(14, 12)])).toBe(3)
    expect(tableWinner([hand(14, 13), hand(14, 12), hand(7, 7, 7)])).toBeNull()
  })

  it('has the girls play the hand out among themselves once the reader has bust', () => {
    const bust = hand(10, 6, 9)
    // Heads-up she leaves her hand alone; with another girl still to play she builds one.
    expect(soundAt(hand(5, 4), [bust])).toBe('stand')
    expect(soundAt(hand(5, 4), [bust], hand(7))).toBe('hit')
    expect(soundAt(hand(10, 8), [bust], hand(7))).toBe('stand')
    // A ten or an ace showing behind her is worth one card more.
    expect(soundAt(hand(10, 5), [bust], hand(7))).toBe('stand')
    expect(soundAt(hand(10, 5), [bust], hand(13))).toBe('hit')
    // The last girl plays against the girl before her, not the bust hand.
    expect(soundAt(hand(10, 6), [bust, hand(10, 8)])).toBe('hit')
    expect(soundAt(hand(10, 9), [bust, hand(10, 8)])).toBe('stand')
    expect(soundAt(hand(5, 4), [bust, hand(10, 5, 9)])).toBe('stand')
    expect(girlMove(hand(10, 6), [bust, hand(10, 8)], [], 5, never)).toBe('hit')
  })

  it('calls the game for the reader only when he alone has most hands', () => {
    expect(gameOutcome([2, 1, 0])).toBe('won')
    expect(gameOutcome([2, 2, 1])).toBe('draw')
    expect(gameOutcome([1, 1, 1, 1])).toBe('draw')
    // Ahead of two of three and still beaten.
    expect(gameOutcome([2, 0, 3, 1])).toBe('lost')
    expect(gameOutcome([0, 1])).toBe('lost')
  })

  it('stops a game early only once nobody at all can catch the leader', () => {
    // Two up on one girl with one to play, but another is only one behind.
    expect(gameOver([2, 0, 1], 4, 5)).toBe(false)
    expect(gameOver([3, 0, 1], 4, 5)).toBe(true)
    expect(gameOver([0, 3, 1, 0], 3, 5)).toBe(false)
    expect(gameOver([0, 3, 0, 0], 3, 5)).toBe(true)
    // Level at the top is never settled early, and the last hand always ends it.
    expect(gameOver([2, 2, 0], 4, 5)).toBe(false)
    expect(gameOver([1, 1, 1], 3, 3)).toBe(true)
  })

  it('plays a one-girl table exactly as heads-up, decision for decision', () => {
    const seeded = (seed: number) => (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    // The heads-up player as she was before the table took more girls.
    const slipOf = { 1: 0.42, 2: 0.3, 3: 0.18, 4: 0.08, 5: 0 } as const
    const worth = (cards: Card[]): number => {
      const { total } = handTotal(cards)
      return total > 21 ? -1 : isNatural(cards) ? 22 : total
    }
    const soundBefore = (hers: Card[], mine: Card[]): Move => {
      const [a, b] = [worth(hers), worth(mine)]
      if (b < 0 || a > b || b === 22) return 'stand'
      if (a < b) return 'hit'
      const { total, soft } = handTotal(hers)
      return total <= (soft ? 17 : 14) ? 'hit' : 'stand'
    }
    const moveBefore = (hers: Card[], mine: Card[], skill: 1 | 2 | 3 | 4 | 5, rand: () => number): Move => {
      const sound = soundBefore(hers, mine)
      const slip = slipOf[skill]
      if (slip === 0) return sound
      const { total, soft } = handTotal(hers)
      if (sound === 'hit') {
        if (soft || total < 12) return 'hit'
        return rand() < slip ? 'stand' : 'hit'
      }
      const [a, b] = [worth(hers), worth(mine)]
      if (b < 0 || b === 22 || a <= b || total > 17) return 'stand'
      return rand() < slip / 2 ? 'hit' : 'stand'
    }
    // A scripted deck, dealt hand after hand: the reader draws to sixteen, then she plays.
    const cut = seeded(11)
    const deck: Card[] = Array.from({ length: 4000 }, () => ({
      rank: 2 + Math.floor(cut() * 13),
      suit: 'spades' as const
    }))
    for (const skill of [1, 2, 3, 4, 5] as const) {
      const [now, before] = [seeded(skill), seeded(skill)]
      let at = 0
      for (let n = 0; n < 150; n++) {
        const mine = [deck[at], deck[at + 2]]
        const start = [deck[at + 1], deck[at + 3]]
        at += 4
        while (handTotal(mine).total < 16) mine.push(deck[at++])
        const play = (move: (hers: Card[]) => Move): { cards: Card[]; moves: Move[] } => {
          const cards = [...start]
          const moves: Move[] = []
          let from = at
          while (handTotal(cards).total <= 21) {
            const made = move(cards)
            moves.push(made)
            if (made === 'stand') break
            cards.push(deck[from++])
          }
          return { cards, moves }
        }
        // His bust is her hand as it lies: she is never asked for a move.
        const busted = handTotal(mine).total > 21
        const a = busted ? { cards: start, moves: [] } : play((hers) => girlMove(hers, [mine], [], skill, now))
        const b = busted ? { cards: start, moves: [] } : play((hers) => moveBefore(hers, mine, skill, before))
        expect(a).toEqual(b)
        expect(soundAt(start, [mine])).toBe(soundBefore(start, mine))
        const winner = tableWinner([mine, a.cards])
        expect(winner === 0 ? 'reader' : winner === 1 ? 'her' : 'push').toBe(handWinner(mine, b.cards))
        at += 6
      }
    }
  })

  it('names every girl in the summary and the account, with the standings at the end', () => {
    // He stood on eighteen; Ana drew to nineteen; Bea drew past both and went over.
    const first: TableHand = {
      mine: hand(10, 8),
      hits: [],
      girls: [
        {
          cards: hand(10, 5, 4),
          moves: [
            { move: 'hit', total: 15, sound: 'hit' },
            { move: 'stand', total: 19, sound: 'stand' }
          ]
        },
        { cards: hand(10, 6, 9), moves: [{ move: 'hit', total: 16, sound: 'hit' }] }
      ]
    }
    // He went over; Ana stood thin with Bea to come, and Bea stood level with her.
    const second: TableHand = {
      mine: hand(10, 6, 9),
      hits: [{ total: 16, soft: false }],
      girls: [
        { cards: hand(10, 3), moves: [{ move: 'stand', total: 13, sound: 'hit' }] },
        { cards: hand(9, 4), moves: [{ move: 'stand', total: 13, sound: 'hit' }] }
      ]
    }
    const names = ['Ana', 'Bea']
    expect(tableWon([first, second], 2)).toEqual([0, 1, 0])
    const told = tableTold(names, first, 1)
    expect(told.line).toContain('the reader stood on 18')
    expect(told.line).toContain('Ana hit on 15 and stood on 19')
    expect(told.line).toContain("Bea hit on 16 and bust with 25, bad luck: she had to draw to beat Ana's 19")
    expect(told.line).toContain('Ana won it by a single point')
    const push = tableTold(names, second, 2).line
    expect(push).toContain('Ana stood on 13, timid play: a thin total with Bea still to play')
    expect(push).toContain('Bea stood on 13, timid play: level with Ana')
    expect(push).toContain('A push, Ana and Bea level on 13: nobody won it')
    // The one who took the hand speaks for it; in a push the word goes to whoever has had it least.
    expect(remarkBy(first, [])).toBe(0)
    expect(remarkBy(second, [1, 0])).toBe(1)

    const account = tableAccount(names, [first, second], 2)
    expect(account).toHaveLength(4)
    expect(account[0]).toContain('the reader, Ana and Bea')
    expect(account[3]).toBe('Final count of hands: the reader 0, Ana 1, Bea 0: Ana took the game.')
    const four = tableAccount(['Ana', 'Bea', 'Cy'], [{ ...first, girls: [...first.girls, { cards: hand(10, 7), moves: [] }] }], 1)
    expect(four).toHaveLength(3)
    for (const name of ['Ana', 'Bea', 'Cy']) for (const line of four) expect(line).toContain(name)

    expect(tableSummary(names, [2, 1, 0])).toBe(
      "You play blackjack with Ana and Bea and win, 2 hands to Ana's 1 and Bea's 0."
    )
    expect(tableSummary(names, [1, 1, 0])).toBe(
      "You play blackjack with Ana and Bea and finish level with Ana on 1 hand each, ahead of Bea's 0."
    )
    expect(tableSummary(['Ana', 'Bea', 'Cy'], [1, 0, 2, 0])).toBe(
      "You play blackjack with Ana, Bea and Cy and lose: Bea takes it with 2 hands, to your 1, Ana's 0 and Cy's 0."
    )
    expect(tableSummary(['Mio'], [2, 1])).toBe(matchSummary('Mio', 2, 1))
  })

  it('is one of the games this build carries, three hands where nothing was said', () => {
    const def = MINI_GAMES_LIST.find((game) => game.id === 'blackjack')
    expect(def).toBeDefined()
    expect(def?.players).toEqual({ min: 1, max: 3 })
    expect(def?.modId).not.toBe(MINI_GAMES)
    expect(settledOptions(def!, {})).toEqual({ hands: 3 })
    expect(settledOptions(def!, { hands: 5 })).toEqual({ hands: 5 })
    expect(settledOptions(def!, { hands: 9 })).toEqual({ hands: 3 })
  })
})
