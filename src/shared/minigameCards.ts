import { shuffle } from './shuffle'

/** Playing cards, for any game that deals them: the framework's, so no pack leans on another's. */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

export interface Card {
  /** 2 to 14: the jack, queen, king and ace are 11 to 14. */
  rank: number
  suit: Suit
}

const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

/** A full deck, shuffled. */
export function freshDeck(rand: () => number = Math.random): Card[] {
  const deck = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i): Card => ({ rank: i + 2, suit }))
  )
  return shuffle(deck, rand)
}

const FACES: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }

/** A rank as a card prints it. */
export function rankMark(rank: number): string {
  return FACES[rank] ?? String(rank)
}

const WORDS: Record<number, string> = {
  2: 'a two',
  3: 'a three',
  4: 'a four',
  5: 'a five',
  6: 'a six',
  7: 'a seven',
  8: 'an eight',
  9: 'a nine',
  10: 'a ten',
  11: 'a jack',
  12: 'a queen',
  13: 'a king',
  14: 'an ace'
}

/** A rank as it is said aloud, with its article. */
export function rankWord(rank: number): string {
  return WORDS[rank] ?? String(rank)
}
