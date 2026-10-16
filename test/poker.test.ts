import { describe, expect, it } from 'vitest'
import type { Card, SkillLevel as Skill, Suit } from '../src/shared/minigameKit'
import { MINI_GAMES_LIST, settledOptions } from '../src/shared/minigames'
import {
  act,
  actionsLine,
  awardPots,
  dealHand,
  evaluate,
  freshDeck,
  gameOutcome,
  gameOver,
  girlAction,
  girlChoice,
  handStrength,
  handTold,
  judged,
  knownEquity,
  legal,
  nextButton,
  pokerProgress,
  potOf,
  proceed,
  seeded,
  sidePots,
  startingStack,
  styleTraits,
  type HandState,
  type Move,
  type Spot
} from '../src/shared/minigameRules/poker'

/** Poker's rules: what a hand is worth, how the pots are shared, and how she plays hers. */

const SUIT: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }
const RANK = '..23456789TJQKA'

/** Cards from shorthand: "Ah Kd 7s". */
const cards = (text: string): Card[] =>
  text.split(' ').map((mark) => ({ rank: RANK.indexOf(mark[0]), suit: SUIT[mark[1]] }))

const score = (text: string): number => evaluate(cards(text)).score
const category = (text: string): number => evaluate(cards(text)).category

const never = (): number => {
  throw new Error('guessed')
}

/** Every way of taking five cards from a longer hand. */
function fives(from: readonly Card[]): Card[][] {
  const out: Card[][] = []
  const pick = (start: number, held: Card[]): void => {
    if (held.length === 5) {
      out.push(held)
      return
    }
    for (let i = start; i < from.length; i++) pick(i + 1, [...held, from[i]])
  }
  pick(0, [])
  return out
}

/** A deck that deals `holes` in seat order and then `board`, the rest of the pack behind it. */
function stacked(holes: string[], board: string): Card[] {
  const top = cards([...holes, board].join(' '))
  const key = (card: Card): string => `${card.rank}${card.suit}`
  const used = new Set(top.map(key))
  return [...top, ...freshDeck(seeded(1)).filter((card) => !used.has(key(card)))]
}

/** Plays moves in turn, dealing the streets as the betting closes. */
function play(hand: HandState, ...moves: (Move | 'deal')[]): HandState {
  return moves.reduce((now, move) => (move === 'deal' ? proceed(now) : act(now, move)), hand)
}

const fold: Move = { kind: 'fold' }
const call: Move = { kind: 'call' }
const check: Move = { kind: 'check' }
const raise = (to: number): Move => ({ kind: 'raise', to })
const stacks = (hand: HandState): number[] => hand.seats.map((seat) => seat.stack)

describe('Poker hands', () => {
  it('names every category from seven cards', () => {
    expect(category('Ah Kd 9s 7c 5h 3d 2c')).toBe(0)
    expect(category('Ah Ad 9s 7c 5h 3d 2c')).toBe(1)
    expect(category('Ah Ad 9s 9c 5h 3d 2c')).toBe(2)
    expect(category('Ah Ad As 9c 5h 3d 2c')).toBe(3)
    expect(category('6h 7d 8s 9c Th 3d 2c')).toBe(4)
    expect(category('Ah Jh 8h 6h 2h Kd Kc')).toBe(5)
    expect(category('Ah Ad As 9c 9h 3d 2c')).toBe(6)
    expect(category('Ah Ad As Ac 9h 9d 2c')).toBe(7)
    expect(category('5h 6h 7h 8h 9h Ad Ac')).toBe(8)
  })

  it('ranks the categories in order', () => {
    const ladder = [
      'Ah Kd 9s 7c 5h',
      '2h 2d 4s 5c 7h',
      '2h 2d 3s 3c 4h',
      '2h 2d 2s 4c 5h',
      'Ah 2d 3s 4c 5h',
      '2h 4h 5h 7h 8h',
      '2h 2d 2s 3c 3h',
      '2h 2d 2s 2c 3h',
      'Ah 2h 3h 4h 5h'
    ].map(score)
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeGreaterThan(ladder[i - 1])
  })

  it('plays the ace low in a wheel, under a six-high straight, and not round the corner', () => {
    expect(evaluate(cards('Ah 2d 3s 4c 5h Kd Qc')).ranks).toEqual([5])
    expect(score('2d 3s 4c 5h 6d')).toBeGreaterThan(score('Ah 2d 3s 4c 5h'))
    expect(score('Th Jd Qs Kc Ah')).toBeGreaterThan(score('9h Td Js Qc Kh'))
    expect(category('Qh Kd As 2c 3h 8d 9c')).toBe(0)
  })

  it('is not fooled by seven cards: two sets, three pairs, a flush beside a straight', () => {
    // Two sets of three make a full house, the higher set on top.
    expect(evaluate(cards('Ah Ad As Kh Kd Ks Qc'))).toMatchObject({ category: 6, ranks: [14, 13] })
    // Three pairs are the best two, and the third pair's rank is the kicker if nothing beats it.
    expect(evaluate(cards('Ah Ad Kh Kd Qs Qc Jc'))).toMatchObject({ category: 2, ranks: [14, 13, 12] })
    // A flush and a straight in different cards are a flush, not a straight flush.
    expect(evaluate(cards('Ah Kh Qh Jh 9h Ts 2c'))).toMatchObject({ category: 5, ranks: [14, 13, 12, 11, 9] })
    // A wheel in one suit is a straight flush to the five, under one to the six.
    expect(evaluate(cards('Ah 2h 3h 4h 5h Kd Kc'))).toMatchObject({ category: 8, ranks: [5] })
    expect(score('2h 3h 4h 5h 6h Ah Kc')).toBeGreaterThan(score('Ah 2h 3h 4h 5h Kd Kc'))
    // Four of a kind on the board: only the kicker counts, and a pocket pair is no help.
    expect(score('9h 9d 9s 9c 4h Ad 2c')).toBeGreaterThan(score('9h 9d 9s 9c 4h Kd Kc'))
    expect(score('9h 9d 9s 9c Ah Kd Kc')).toBe(score('9h 9d 9s 9c Ah 3d 2c'))
  })

  it('breaks ties on kickers, down to the fifth card', () => {
    expect(score('Ah Ad Ks 7c 5h')).toBeGreaterThan(score('As Ac Qs 7d 5d'))
    expect(score('Ah Ad Ks 7c 5h')).toBeGreaterThan(score('As Ac Kd 7d 4d'))
    expect(score('Ah Kd 9s 7c 5h')).toBeGreaterThan(score('As Kc 9d 7d 4d'))
    expect(score('Kh Kd 4s 4c Ah')).toBeGreaterThan(score('Ks Kc 4d 4h Qh'))
    expect(score('Kh Kd 4s 4c Ah')).toBeGreaterThan(score('Qs Qc Jd Jh Ah'))
    expect(score('7h 7d 7s Ac 2h')).toBeGreaterThan(score('7h 7d 7s Kc Qh'))
    expect(score('Ah Jh 8h 6h 3h')).toBeGreaterThan(score('Ad Jd 8d 6d 2d'))
    expect(score('3h 3d 3s 2c 2h')).toBeGreaterThan(score('2h 2d 2s Ac Ah'))
    expect(score('9h 9d 9s 9c 3h')).toBeGreaterThan(score('8h 8d 8s 8c Ah'))
    expect(score('9h 9d 9s 9c Ah')).toBeGreaterThan(score('9h 9d 9s 9c Kh'))
  })

  it('takes the best five of seven', () => {
    // Three pairs: the top two, and the best card left, which is the third pair's.
    expect(evaluate(cards('Ah Ad Ks Kc Qh Qd 2c')).ranks).toEqual([14, 13, 12])
    // Two sets of three: the higher full of the lower.
    expect(evaluate(cards('9h 9d 9s 4c 4h 4d Ac')).ranks).toEqual([9, 4])
    // Three of a kind and two pairs: full of the higher pair.
    expect(evaluate(cards('9h 9d 9s 4c 4h Kd Kc')).ranks).toEqual([9, 13])
    // Six of a suit: the five highest.
    expect(evaluate(cards('Ah Jh 8h 6h 3h 2h Kd')).ranks).toEqual([14, 11, 8, 6, 3])
    // A flush beats the straight that is also there.
    expect(category('5h 6h 7h 8h 9d Kh 2c')).toBe(5)
    // A straight flush lower than the flush's top card is still the straight flush.
    expect(evaluate(cards('5h 6h 7h 8h 9h Kh Ac')).ranks).toEqual([9])
    // Four suited cards to a straight with the fifth off suit: only a straight.
    expect(category('5h 6h 7h 8h 9d 2c 2d')).toBe(4)
    // A pair inside a straight is the straight.
    expect(evaluate(cards('5h 6d 7s 8c 9h 9d 2c')).ranks).toEqual([9])
    // A seven-card straight is its top five.
    expect(evaluate(cards('5h 6d 7s 8c 9h Td Jc')).ranks).toEqual([11])
    // Four of a kind with a pair: the kicker is the best other card.
    expect(evaluate(cards('7h 7d 7s 7c Kh Kd Ac')).ranks).toEqual([7, 14])
  })

  it('agrees with trying every five of seven, over many random hands', () => {
    const rand = seeded(7)
    for (let i = 0; i < 400; i++) {
      const seven = freshDeck(rand).slice(0, 7)
      const best = Math.max(...fives(seven).map((five) => evaluate(five).score))
      expect(evaluate(seven).score).toBe(best)
    }
  })

  it('finds equal hands equal: the board plays, and suits never count', () => {
    const board = 'Ah Kd Qs Jc Th'
    expect(score(`${board} 2c 3d`)).toBe(score(`${board} 9c 9d`))
    expect(score('Ah Kh 9h 7h 5h')).toBe(score('As Ks 9s 7s 5s'))
    expect(score('Ah Ad Ks 7c 5h 3d 2c')).toBe(score('As Ac Kd 7d 5d 4d 2s'))
  })
})

describe('Poker pots', () => {
  it('gives a player all-in for less only what she matched', () => {
    // 40 all-in, two at 100: a main pot of 120 for all three and a side pot of 120 for two.
    expect(sidePots([100, 40, 100], [false, false, false])).toEqual([
      { amount: 120, eligible: [0, 1, 2] },
      { amount: 120, eligible: [0, 2] }
    ])
    // Three different depths make three pots.
    expect(sidePots([300, 50, 120], [false, false, false])).toEqual([
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 140, eligible: [0, 2] },
      { amount: 180, eligible: [0] }
    ])
  })

  it('leaves folded chips in the pots they were bet into', () => {
    // Seat 2 put in 60 and folded: 40 of it is in the main pot, 20 in the side pot.
    expect(sidePots([100, 40, 60, 100], [false, false, true, false])).toEqual([
      { amount: 160, eligible: [0, 1, 3] },
      { amount: 140, eligible: [0, 3] }
    ])
    // Everyone left has the same in: one pot, the folded chips with it.
    expect(sidePots([100, 100, 30], [false, false, true])).toEqual([{ amount: 230, eligible: [0, 1] }])
  })

  it('pays each pot to the best hand in it, and splits level hands with the odd chip left of the button', () => {
    const pots = sidePots([100, 40, 100], [false, false, false])
    // The short stack has the best hand: she takes the main pot, the better of the others the side.
    expect(awardPots(pots, [5, 9, 7], 0).gains).toEqual([0, 120, 120])
    expect(awardPots(pots, [9, 5, 7], 0).gains).toEqual([240, 0, 0])
    // Level at the top of a pot of 25 between seats 0 and 2: 13 and 12, the odd chip nearest the button's left.
    expect(awardPots([{ amount: 25, eligible: [0, 1, 2] }], [8, 3, 8], 0).gains).toEqual([12, 0, 13])
    expect(awardPots([{ amount: 25, eligible: [0, 1, 2] }], [8, 3, 8], 2).gains).toEqual([13, 0, 12])
    expect(awardPots([{ amount: 30, eligible: [0, 1, 2] }], [8, 8, 8], 1).gains).toEqual([10, 10, 10])
  })
})

describe('Poker betting', () => {
  it('has the button post the small blind and act first heads-up, and last after the flop', () => {
    const hand = dealHand([200, 200], 1, 1, stacked(['Ah Kd', '7c 2s'], '3h 8d Jc 4s 9h'))
    expect([hand.smallBlind, hand.bigBlind, hand.toAct]).toEqual([1, 0, 1])
    expect(stacks(hand)).toEqual([190, 195])
    const flop = play(hand, call, check, 'deal')
    expect(flop.board).toHaveLength(3)
    expect(flop.toAct).toBe(0)
  })

  it('puts the blinds left of the button around a table, and skips a seat with no chips', () => {
    const hand = dealHand([200, 200, 200, 200], 3, 1, freshDeck(seeded(2)))
    expect([hand.smallBlind, hand.bigBlind, hand.toAct]).toEqual([0, 1, 2])
    const short = dealHand([200, 0, 200, 200], 0, 2, freshDeck(seeded(2)))
    expect([short.smallBlind, short.bigBlind, short.toAct]).toEqual([2, 3, 0])
    expect(short.seats[1].hole).toEqual([])
    // Two left of three: the heads-up order.
    const two = dealHand([200, 0, 200], 2, 3, freshDeck(seeded(2)))
    expect([two.smallBlind, two.bigBlind, two.toAct]).toEqual([2, 0, 2])
  })

  it('gives the big blind the last word before the flop, and ends a street when all have matched', () => {
    const hand = dealHand([200, 200, 200], 2, 1, freshDeck(seeded(3)))
    // Button and small blind call; the big blind may still raise.
    const limped = play(hand, call, call)
    expect(limped.toAct).toBe(1)
    expect(legal(limped, 1)).toMatchObject({ owed: 0, canCheck: true, canRaise: true, minTo: 20 })
    expect(play(limped, check).toAct).toBeNull()
    // A raise goes back round to everyone.
    const raised = play(limped, raise(40))
    expect(raised.toAct).toBe(2)
    expect(play(raised, call, call).toAct).toBeNull()
  })

  it('sizes half the pot and the pot from the pot as it would stand after calling', () => {
    const hand = dealHand([200, 200, 200], 2, 1, freshDeck(seeded(3)))
    // 15 in, 10 to call: a pot raise is to 35, half of it to 25 (rounded to fives), all-in 200.
    expect(legal(hand, 2)).toMatchObject({ owed: 10, minTo: 20, halfTo: 25, potTo: 35, maxTo: 200 })
  })

  it('takes a fold with nothing to call as a check, and holds a raise to what is allowed', () => {
    const hand = dealHand([200, 200], 1, 1, freshDeck(seeded(4)))
    const called = play(hand, call)
    const checked = act(called, fold)
    expect(checked.seats[0].folded).toBe(false)
    expect(checked.log[checked.log.length - 1].kind).toBe('check')
    // Under the minimum is the minimum; over the stack is all-in.
    expect(act(hand, raise(11)).seats[1].bet).toBe(20)
    const shove = act(hand, raise(9999))
    expect(shove.seats[1]).toMatchObject({ bet: 200, stack: 0, allIn: true })
  })

  it('hands the pot to the last player in, with the unmatched part of her bet returned', () => {
    const hand = dealHand([200, 200], 1, 1, freshDeck(seeded(5)))
    const done = play(hand, raise(60), fold)
    expect(done.over).toBe(true)
    expect(done.showdown).toBe(false)
    // The raiser wins the big blind only: 20 in the pot, 10 of it hers.
    expect(done.pots).toEqual([{ amount: 20, eligible: [1], winners: [1] }])
    expect(stacks(done)).toEqual([190, 210])
  })

  it('deals the board out with nobody left to bet, and settles main and side pots', () => {
    // Seat 1 is short with the best hand; seat 0 beats seat 2 for the side pot.
    const deck = stacked(['Kh Kd', 'Ah Ad', 'Qh Qd'], '2c 7s 9d 3h 4s')
    const hand = dealHand([200, 60, 200], 2, 1, deck)
    // The button shoves for 200, the small blind calls with all of hers, the big blind with her 60.
    const allIn = play(hand, raise(200), call, call)
    expect(allIn.toAct).toBeNull()
    expect(allIn.runoutFrom).toBe(0)
    const done = play(allIn, 'deal', 'deal', 'deal', 'deal')
    expect(done.board).toHaveLength(5)
    expect(done.showdown).toBe(true)
    expect(done.pots).toEqual([
      { amount: 180, eligible: [0, 1, 2], winners: [1] },
      { amount: 280, eligible: [0, 2], winners: [0] }
    ])
    expect(stacks(done)).toEqual([280, 180, 0])
  })

  it('returns what a deeper stack bet beyond anyone who could call it', () => {
    const deck = stacked(['Kh Kd', 'Ah Ad'], '2c 7s 9d 3h 4s')
    const hand = dealHand([200, 60], 0, 1, deck)
    const done = play(hand, raise(200), call, 'deal', 'deal', 'deal', 'deal')
    expect(done.pots).toEqual([{ amount: 120, eligible: [0, 1], winners: [1] }])
    expect(stacks(done)).toEqual([140, 120])
  })

  it('splits a pot between equal hands', () => {
    const deck = stacked(['2c 3d', '2d 3c'], 'Ah Kd Qs Jc Th')
    const hand = dealHand([200, 200], 1, 1, deck)
    const done = play(hand, call, check, 'deal', check, check, 'deal', check, check, 'deal', check, check, 'deal')
    expect(done.pots[0].winners).toEqual([0, 1])
    expect(stacks(done)).toEqual([200, 200])
  })

  it('does not reopen the betting for an all-in short of a full raise', () => {
    const hand = dealHand([200, 200, 75], 2, 1, freshDeck(seeded(6)))
    // The button, with 75, calls; the small blind raises to 60 and the big blind calls.
    const round = play(hand, call, raise(60), call)
    expect(round.toAct).toBe(2)
    // The button goes all-in to 75: 15 more, short of the 50 a raise must add.
    const short = act(round, raise(75))
    expect(short.seats[2].allIn).toBe(true)
    expect(short.toAct).toBe(0)
    expect(legal(short, 0)).toMatchObject({ owed: 15, canRaise: false })
    const closed = play(short, call, call)
    expect(closed.toAct).toBeNull()
    expect(potOf(closed)).toBe(225)
  })

  it('lets a short blind go all-in for what it has', () => {
    const hand = dealHand([200, 4], 0, 1, stacked(['7c 2s', 'Ah Ad'], 'As 8d Jc 4s 9h'))
    // The big blind has 4: the small blind's 5 already covers it, and there is nothing to decide.
    expect(hand.toAct).toBeNull()
    const done = play(hand, 'deal', 'deal', 'deal', 'deal')
    expect(stacks(done)).toEqual([196, 8])
  })

  it('keeps the big blind the bet to match when the seat posting it is short', () => {
    const deck = stacked(['7c 2s', 'Kh Qd', 'Ah Ad'], 'As 8d Jc 4s 9h')
    const hand = dealHand([200, 200, 4], 0, 1, deck)
    expect([hand.smallBlind, hand.bigBlind, hand.toAct]).toEqual([1, 2, 0])
    expect(hand.seats[2]).toMatchObject({ bet: 4, allIn: true })
    expect(legal(hand, 0)).toMatchObject({ owed: 10, minTo: 20 })
    // Both call the full blind: the short stack can win 4 from each, the rest is between the two.
    const called = play(hand, call, call)
    expect(called.toAct).toBeNull()
    const flop = proceed(called)
    expect(flop.toAct).toBe(1)
    const done = play(flop, check, check, 'deal', check, check, 'deal', check, check, 'deal')
    expect(done.pots).toEqual([
      { amount: 12, eligible: [0, 1, 2], winners: [2] },
      { amount: 12, eligible: [0, 1], winners: [1] }
    ])
    expect(stacks(done)).toEqual([190, 202, 12])
    // Folded round to the small blind, whose 5 already covers her: nothing is asked of it, and its odd chip comes back.
    const alone = act(hand, fold)
    expect(alone.toAct).toBeNull()
    expect(alone.runoutFrom).toBe(0)
    expect(stacks(play(alone, 'deal', 'deal', 'deal', 'deal'))).toEqual([200, 196, 8])
  })

  it('shares three all-ins of different sizes into a main pot, a side pot and a refund', () => {
    const deck = stacked(['Ah Ad', 'Kh Kd', '7c 2s'], '3h 8d Jc 4s 9h')
    const hand = dealHand([50, 120, 300], 2, 1, deck)
    expect(hand.toAct).toBe(2)
    const in3 = play(hand, raise(300), call, call)
    expect(in3.toAct).toBeNull()
    expect(in3.runoutFrom).toBe(0)
    // What nobody could match is back before a card is dealt.
    expect(in3.seats[2]).toMatchObject({ stack: 180, allIn: false })
    const done = play(in3, 'deal', 'deal', 'deal', 'deal')
    expect(done.showdown).toBe(true)
    expect(done.pots).toEqual([
      { amount: 150, eligible: [0, 1, 2], winners: [0] },
      { amount: 140, eligible: [1, 2], winners: [1] }
    ])
    expect(stacks(done)).toEqual([150, 140, 180])
  })

  it('does not close the betting on a call that was all-in for less while others are still to act', () => {
    const hand = dealHand([200, 40, 200], 2, 1, freshDeck(seeded(8)))
    const raised = act(hand, raise(100))
    expect(raised.toAct).toBe(0)
    const short = play(raised, fold, call)
    // The big blind is in for her 40; the raiser's other 60 comes back and the board is dealt out.
    expect(short.toAct).toBeNull()
    expect(short.seats[1]).toMatchObject({ stack: 0, allIn: true, total: 40 })
    expect(short.seats[2].stack).toBe(160)
    expect(potOf(short)).toBe(85)
  })

  it('lets a player raise again after a full raise, at no less than the last raise', () => {
    const hand = dealHand([400, 400, 400], 2, 1, freshDeck(seeded(9)))
    // The button raises to 30, the small blind to 90: the button may raise again, by 60 at least.
    const back = play(hand, raise(30), raise(90), fold)
    expect(back.toAct).toBe(2)
    expect(legal(back, 2)).toMatchObject({ owed: 60, canRaise: true, minTo: 150 })
    // A raise asked for below that is brought up to it.
    expect(act(back, raise(100)).seats[2].bet).toBe(150)
  })

  it('never loses or makes a chip, whatever is played, and always ends', () => {
    const rand = seeded(11)
    for (let game = 0; game < 60; game++) {
      const players = 2 + (game % 3)
      let chips: number[] = Array.from({ length: players }, () => 100 + 50 * (game % 4))
      const total = chips.reduce((a, b) => a + b, 0)
      let button = players - 1
      for (let no = 1; no <= 12 && chips.filter((stack) => stack > 0).length > 1; no++) {
        let hand = dealHand(chips, button, no, freshDeck(rand))
        for (let step = 0; !hand.over; step++) {
          expect(step).toBeLessThan(200)
          if (hand.toAct === null) {
            hand = proceed(hand)
            continue
          }
          const can = legal(hand, hand.toAct)
          const roll = rand()
          hand = act(
            hand,
            roll < 0.15
              ? fold
              : roll < 0.6
                ? call
                : raise([can.minTo, can.halfTo, can.potTo, can.maxTo][Math.floor(rand() * 4)])
          )
          const held = stacks(hand).reduce((a, b) => a + b, 0)
          expect(held + (hand.over ? 0 : potOf(hand))).toBe(total)
        }
        chips = stacks(hand)
        expect(Math.min(...chips)).toBeGreaterThanOrEqual(0)
        expect(hand.pots.reduce((sum, pot) => sum + pot.amount, 0)).toBe(potOf(hand))
        // Whatever happened can be told.
        expect(handTold(['Ana', 'Bea', 'Cy'].slice(0, players - 1), hand, 200).line).toContain(`Hand ${no}:`)
        button = nextButton(chips, button)
      }
    }
  })
})

describe('Poker game', () => {
  it('ends after the agreed hands, when the reader is out, or when one player has it all', () => {
    expect(gameOver([200, 200], 4, 5)).toBe(false)
    expect(gameOver([200, 200], 5, 5)).toBe(true)
    expect(gameOver([0, 300, 300], 2, 5)).toBe(true)
    expect(gameOver([600, 0, 0], 2, 5)).toBe(true)
    expect(gameOver([300, 0, 300], 2, 5)).toBe(false)
  })

  it('gives the game to the most chips, and calls level at the top a draw', () => {
    expect(gameOutcome([300, 100, 200])).toBe('won')
    expect(gameOutcome([200, 300, 100])).toBe('lost')
    expect(gameOutcome([250, 250, 100])).toBe('draw')
    expect(gameOutcome([200, 200])).toBe('draw')
  })

  it('passes the button to the next seat with chips', () => {
    expect(nextButton([200, 200, 200], 2)).toBe(0)
    expect(nextButton([200, 0, 200], 0)).toBe(2)
  })

  it('is declared as the table plays it', () => {
    const game = MINI_GAMES_LIST.find((entry) => entry.id === 'poker')!
    expect(game.players).toEqual({ min: 1, max: 3 })
    expect(settledOptions(game, {})).toEqual({ hands: 5, stack: 2 })
    expect(settledOptions(game, { hands: 11, stack: 5 })).toEqual({ hands: 5, stack: 5 })
    expect([1, 2, 3, 4, 5].map(startingStack)).toEqual([100, 200, 300, 400, 500])
  })
})

describe('Poker chances', () => {
  it('knows a strong hand from a weak one', () => {
    const rand = seeded(21)
    const aces = handStrength(cards('Ah Ad'), [], 1, rand, 600)
    const trash = handStrength(cards('7c 2s'), [], 1, rand, 600)
    expect(aces).toBeGreaterThan(0.8)
    expect(trash).toBeLessThan(0.4)
    // The nuts cannot lose.
    expect(handStrength(cards('Ah Kh'), cards('Qh Jh Th 2c 3d'), 2, rand, 100)).toBe(1)
    // It reads the same at a fuller table: brought back to one opponent.
    expect(Math.abs(handStrength(cards('Ah Ad'), [], 3, rand, 1500) - aces)).toBeLessThan(0.08)
  })

  it('shares known hands their chances', () => {
    const [aces, kings] = knownEquity([cards('Ah Ad'), cards('Kh Kd')], [], seeded(22), 800)
    expect(aces).toBeGreaterThan(0.75)
    expect(aces + kings).toBeCloseTo(1, 5)
    expect(knownEquity([cards('Ah Ad'), cards('Kh Kd')], cards('Ks 7c 2d 9h 3s'))).toEqual([0, 1])
  })
})

describe('Poker, her play', () => {
  const spot = (over: Partial<Spot> = {}): Spot => ({
    owed: 0,
    canCheck: true,
    canRaise: true,
    minTo: 10,
    halfTo: 30,
    potTo: 60,
    maxTo: 400,
    pot: 60,
    stack: 400,
    opponents: 1,
    street: 'flop',
    ...over
  })
  /** Facing a bet of the pot: 60 into 60. */
  const facing = spot({ owed: 60, canCheck: false, pot: 120, minTo: 120, halfTo: 150, potTo: 240 })
  const skills: Skill[] = [1, 2, 3, 4, 5]

  it('has everyone bet a strong hand and raise a very strong one, unless she is too timid to', () => {
    const sure = (): number => 0.99
    for (const skill of skills) {
      expect(girlChoice(0.95, spot(), skill, '', sure)).toEqual({ kind: 'raise', to: 60 })
      expect(girlChoice(0.75, spot(), skill, '', sure).kind).toBe('raise')
      expect(girlChoice(0.96, facing, skill, '', sure)).toEqual({ kind: 'raise', to: 240 })
    }
    // A poor player sometimes only checks or calls it; a good one takes no guess about it.
    expect(girlChoice(0.95, spot(), 1, '', () => 0)).toEqual({ kind: 'check' })
    expect(girlChoice(0.96, facing, 1, '', () => 0)).toEqual({ kind: 'call' })
    expect(girlChoice(0.95, spot(), 5, '', never)).toEqual({ kind: 'raise', to: 60 })
    expect(girlChoice(0.96, facing, 5, '', never)).toEqual({ kind: 'raise', to: 240 })
  })

  it('has the best player bet a thinner hand than the others, and count the players still in', () => {
    expect(girlChoice(0.63, spot(), 5, '', never)).toEqual({ kind: 'raise', to: 30 })
    expect(girlChoice(0.63, spot(), 3, '', () => 0.99)).toEqual({ kind: 'check' })
    expect(girlChoice(0.73, spot({ opponents: 3 }), 5, '', never)).toEqual({ kind: 'check' })
    expect(girlChoice(0.73, spot({ opponents: 3 }), 1, '', () => 0.99).kind).toBe('raise')
  })

  it('has a poor player misjudge a middling hand, never a sure one, and the best judge every hand right', () => {
    const rand = seeded(5)
    let off = 0
    for (let i = 0; i < 200; i++) off += Math.abs(judged(0.5, 1, rand) - 0.5)
    expect(off / 200).toBeGreaterThan(0.12)
    expect(judged(1, 1, rand)).toBe(1)
    expect(judged(0, 1, rand)).toBe(0)
    expect(judged(0.5, 5, never)).toBe(0.5)
  })

  it('never folds when checking is free', () => {
    for (const skill of skills) {
      expect(girlChoice(0.05, spot(), skill, '', () => 0.99).kind).toBe('check')
      expect(girlChoice(0.05, spot({ canRaise: false }), skill, '', never).kind).toBe('check')
    }
  })

  it('has the best player call by the price and fold without a guess, and the weakest call on hope', () => {
    // A middling hand against a pot-sized bet: not enough for a player who reads the bet.
    expect(girlChoice(0.5, facing, 5, '', never)).toEqual({ kind: 'fold' })
    expect(girlChoice(0.5, facing, 1, '', () => 0.9)).toEqual({ kind: 'call' })
    expect(girlChoice(0.62, facing, 5, '', never)).toEqual({ kind: 'call' })
    // A small bet is cheap enough for the same middling hand.
    const cheap = spot({ owed: 15, canCheck: false, pot: 75, minTo: 30, halfTo: 60, potTo: 105 })
    expect(girlChoice(0.5, cheap, 5, '', never)).toEqual({ kind: 'call' })
    // Rubbish is folded to a big bet by a player who can count, and called by one who cannot.
    expect(girlChoice(0.2, facing, 4, '', never)).toEqual({ kind: 'fold' })
    expect(girlChoice(0.2, facing, 1, '', () => 0.9)).toEqual({ kind: 'call' })
  })

  it('needs more to call with more players behind the bet', () => {
    expect(girlChoice(0.62, { ...facing, opponents: 3 }, 5, '', never)).toEqual({ kind: 'fold' })
  })

  it('has a weak player frightened off a good hand by a big bet, never the best', () => {
    expect(girlChoice(0.8, facing, 1, '', () => 0.01)).toEqual({ kind: 'fold' })
    expect(girlChoice(0.8, facing, 5, '', never)).toEqual({ kind: 'call' })
  })

  it('has the best player bluff only where it can work, and a weak one anywhere', () => {
    const eager = (): number => 0
    // Heads-up after the flop with nothing: now and then.
    expect(girlChoice(0.2, spot(), 5, '', eager)).toEqual({ kind: 'raise', to: 30, bluff: true })
    expect(girlChoice(0.2, spot(), 5, '', () => 0.5)).toEqual({ kind: 'check' })
    // Not into two players, not before the flop, not into a bet: no guess is even taken.
    expect(girlChoice(0.2, spot({ opponents: 2 }), 5, '', never)).toEqual({ kind: 'check' })
    expect(girlChoice(0.2, spot({ street: 'preflop' }), 5, '', never)).toEqual({ kind: 'check' })
    expect(girlChoice(0.1, facing, 5, '', never)).toEqual({ kind: 'fold' })
    // The weakest does all three.
    expect(girlChoice(0.2, spot({ opponents: 3 }), 1, '', eager).bluff).toBe(true)
    expect(girlChoice(0.2, spot({ street: 'preflop' }), 1, '', eager).bluff).toBe(true)
    expect(girlChoice(0.02, { ...facing, opponents: 3 }, 1, '', eager)).toMatchObject({ kind: 'raise', bluff: true })
  })

  it('opens a good hand before the flop, and commits rather than leave a crumb behind', () => {
    const open = spot({ street: 'preflop', owed: 5, canCheck: false, pot: 15, minTo: 20, halfTo: 20, potTo: 30 })
    expect(girlChoice(0.7, open, 5, '', never)).toEqual({ kind: 'raise', to: 30 })
    expect(girlChoice(0.95, spot({ maxTo: 80, stack: 80 }), 3, '', () => 0.99)).toEqual({ kind: 'raise', to: 80 })
  })

  it('leans with the words of her style', () => {
    expect(styleTraits('reckless and loves to bluff')).toMatchObject({ bold: 1, sly: 1 })
    expect(styleTraits('Cautious, an open book')).toMatchObject({ bold: -1, sly: -1 })
    expect(styleTraits('')).toEqual({ bold: 0, loose: 0, sly: 0 })
    // A bold player bets a hand a cautious one checks.
    expect(girlChoice(0.65, spot(), 5, 'aggressive', never).kind).toBe('raise')
    expect(girlChoice(0.65, spot(), 5, 'cautious', () => 0.99).kind).toBe('check')
    // A sly one bluffs on a roll a plain one lets go.
    expect(girlChoice(0.2, spot(), 5, 'sly', () => 0.13).bluff).toBe(true)
    expect(girlChoice(0.2, spot(), 5, '', () => 0.13).kind).toBe('check')
  })

  it('has each skill beat the one below it heads-up', () => {
    // Every deal is played twice, the two changing seats, so the luck of the cards cancels.
    const won = (deck: Card[], button: number, no: number, skills: [Skill, Skill], rand: () => number): number => {
      let hand = dealHand([300, 300], button, no, deck)
      while (!hand.over) {
        hand = hand.toAct === null ? proceed(hand) : act(hand, girlAction(hand, hand.toAct, skills[hand.toAct], '', rand, 30))
      }
      return hand.seats[0].stack - 300
    }
    // The top two are the closest, and take more deals to tell apart.
    const ladder: [Skill, number, number][] = [
      [2, 700, 1.5],
      [3, 700, 1.5],
      [4, 700, 1.5],
      [5, 6000, 0]
    ]
    for (const [better, deals, least] of ladder) {
      const worse = (better - 1) as Skill
      const rand = seeded(100 + better)
      let ahead = 0
      for (let no = 1; no <= deals; no++) {
        const deck = freshDeck(rand)
        ahead += won(deck, no % 2, no, [better, worse], rand) - won(deck, no % 2, no, [worse, better], rand)
      }
      // In chips a hand, over many seeds: about 5.5, 6.5 and 6 for the lower rungs, 1 for the top.
      expect(ahead / (2 * deals), `skill ${better} against ${worse}`).toBeGreaterThan(least)
    }
  })

  it('makes only moves the table allows, and plays better the higher her skill', () => {
    const rand = seeded(31)
    let ahead = 0
    for (let no = 1; no <= 3000; no++) {
      // Seat 0 is the strong player, seat 1 the weak one; the button alternates.
      let hand = dealHand([300, 300], no % 2, no, freshDeck(rand))
      for (let step = 0; !hand.over; step++) {
        expect(step).toBeLessThan(100)
        if (hand.toAct === null) {
          hand = proceed(hand)
          continue
        }
        const at = hand.toAct
        const can = legal(hand, at)
        const move = girlAction(hand, at, at === 0 ? 5 : 1, '', rand, 30)
        if (move.kind === 'raise') {
          expect(can.canRaise).toBe(true)
          expect(move.to).toBeGreaterThanOrEqual(can.minTo)
          expect(move.to).toBeLessThanOrEqual(can.maxTo)
        }
        if (move.kind === 'fold') expect(can.owed).toBeGreaterThan(0)
        hand = act(hand, move)
      }
      ahead += hand.seats[0].stack - 300
    }
    // Over this many hands the better player's edge is well clear of the luck of the cards:
    // more than half a big blind a hand.
    expect(ahead).toBeGreaterThan(3000 * 5)
  })
})

describe('Poker, the telling', () => {
  it('says a round of checks, calls and folds in one line, those who did the same together', () => {
    const made = (seat: number, kind: 'fold' | 'check' | 'call', paid = 0, allIn = false) => ({
      seat,
      street: 'preflop' as const,
      kind,
      to: paid,
      paid,
      allIn,
      pot: 15,
      toCall: paid
    })
    const names = ['Ana', 'Bea', 'Cy']
    expect(actionsLine(names, [made(1, 'fold'), made(2, 'call', 10), made(3, 'call', 10), made(0, 'check')])).toBe(
      'Ana folds; Bea and Cy call 10; you check.'
    )
    expect(actionsLine(names, [made(0, 'check'), made(1, 'check')])).toBe('You and Ana check.')
    expect(actionsLine(names, [made(1, 'call', 10), made(2, 'call', 5)])).toBe('Ana calls 10; Bea calls 5.')
    expect(actionsLine(names, [made(2, 'call', 40, true)])).toBe('Bea calls 40, all-in.')
  })

  it('tells a bluff that worked, and who folded the better hand, without showing it to the table', () => {
    // The reader holds nothing and bets the river; Ana folds a pair of kings.
    const deck = stacked(['7c 2s', 'Kh Qd'], 'Ks 9d 4c 3h Jh')
    const hand = dealHand([200, 200], 1, 1, deck)
    const done = play(hand, raise(40), call, 'deal', check, check, 'deal', check, check, 'deal', raise(40), fold)
    const told = handTold(['Ana'], done, 100)
    expect(told.bluffer).toBe(0)
    expect(told.notable).toBe(true)
    expect(told.line).toContain('bluffed Ana')
    expect(told.line).toContain('pair of kings')
    expect(told.seen).not.toContain('kings')
    expect(told.seen).not.toContain('seven')
  })

  it('does not call a raise that takes the blinds a bluff, nor a bet with the best hand', () => {
    // The reader raises seven-two before the flop and takes 50 from two callers of the blind.
    const deck = stacked(['7c 2s', 'Kh Qd', 'Ah Jd'], 'Ks 9d 4c 3h Jh')
    const early = play(dealHand([200, 200, 200], 0, 1, deck), raise(60), fold, fold)
    const pre = handTold(['Ana', 'Bea'], early, 200)
    expect(pre.bluffer).toBeNull()
    expect(pre.line).not.toContain('bluff')
    const limped = play(dealHand([200, 200], 1, 1, stacked(['7c 2s', 'Kh Qd'], 'Ks 9d 4c 3h Jh')), call, raise(60), fold)
    expect(handTold(['Ana'], limped, 100).bluffer).toBeNull()
    // On the flop with the best hand of those still in: a bet, however weak the hand.
    const ahead = play(dealHand([200, 200], 1, 1, stacked(['7c 2s', '5h 3d'], '7s 9d 4c Kh Jh')), raise(40), call, 'deal', check, raise(60), fold)
    const best = handTold(['Ana'], ahead, 100)
    expect(best.bluffer).toBeNull()
    expect(best.line).not.toContain('bluffed')
  })

  it('takes a girl at her word for a bluff: the flag her move carried, not the look of her hand', () => {
    const deck = stacked(['Kh Qd', '7c 2s'], 'Ks 9d 4c 3h Jh')
    const to = (bluff: boolean): HandState =>
      play(dealHand([200, 200], 0, 1, deck), raise(30), call, 'deal', { kind: 'raise', to: 40, bluff }, fold)
    const meant = to(true)
    expect(meant.log[meant.log.length - 2]).toMatchObject({ seat: 1, kind: 'bet', bluff: true })
    expect(handTold(['Ana'], meant, 100)).toMatchObject({ bluffer: 1 })
    expect(handTold(['Ana'], meant, 100).line).toContain('Ana bluffed the reader')
    const plain = to(false)
    expect(plain.log[plain.log.length - 2]).not.toHaveProperty('bluff')
    expect(handTold(['Ana'], plain, 100).bluffer).toBeNull()
  })

  it('judges nobody for an all-in the blinds forced', () => {
    // The reader has 6 on the small blind: 5 posted, and his last chip completes it.
    const short = play(dealHand([6, 200], 0, 1, stacked(['7c 2s', 'Ah Ad'], '7s 7d 2c 4s 9h')), call, 'deal', 'deal', 'deal', 'deal')
    expect(short.showdown).toBe(true)
    expect(stacks(short)).toEqual([12, 194])
    const beat = handTold(['Ana'], short, 200).line
    expect(beat).toContain('he blinds put the reader all-in')
    expect(beat).not.toMatch(/bad call|bad beat|pushed/)
    // The same with the aces holding: no bad call by a man who had none to make.
    const held = play(dealHand([6, 200], 0, 1, stacked(['7c 2s', 'Ah Ad'], 'Ks 8d 3c 4s 9h')), call, 'deal', 'deal', 'deal', 'deal')
    const lost = handTold(['Ana'], held, 200).line
    expect(lost).toContain('he blinds put the reader all-in')
    expect(lost).not.toMatch(/bad call|bad beat|pushed/)
    // A big blind posted short, with no move in the log at all.
    const blind = play(dealHand([200, 4], 0, 1, stacked(['Ah Ad', '7c 2s'], '7s 7d 2c 4s 9h')), 'deal', 'deal', 'deal', 'deal')
    const told = handTold(['Ana'], blind, 200).line
    expect(told).toContain('he blinds put Ana all-in')
    expect(told).not.toMatch(/bad call|bad beat|pushed/)
  })

  it('says how far a game has got without anybody\'s cards', () => {
    const lines = pokerProgress(['Ana', 'Bea'], [260, 140, 200], 2, 200, 5)
    expect(lines[1]).toContain('2 of the 5 hands')
    expect(lines[2]).toBe('Chips after hand 2: the reader 260, Ana 140, Bea 200: the reader was ahead.')
    expect(lines.join(' ')).not.toMatch(/ace|king|queen|jack|spades|hearts|diamonds|clubs/)
  })

  it('tells a bad beat from a bad push when the chips go in early', () => {
    const shoved = (board: string): HandState =>
      play(
        dealHand([200, 200], 1, 1, stacked(['Ah Ad', 'Kh Kd'], board)),
        raise(200),
        call,
        'deal',
        'deal',
        'deal',
        'deal'
      )
    // Aces against kings all-in before the flop; a king falls.
    expect(handTold(['Ana'], shoved('Ks 7c 2d 9h 3s'), 200).line).toContain('bad beat for the reader')
    // The same cards with the aces holding: Ana pushed with the worst of it.
    const told = handTold(['Ana'], shoved('Qs 7c 2d 9h 3s'), 200)
    expect(told.line).toContain('Ana pushed before the flop with the worst of it')
    expect(told.line).toContain('Ana was out of chips')
  })
})
