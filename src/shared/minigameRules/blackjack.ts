import { freshDeck, rankWord, type Card, type SkillLevel as Skill } from '../minigameKit'
import { listed } from '../minigameKit'

/**
 * Blackjack's rules, with no dealer: what a hand is worth, which hand wins among everyone at
 * the table, and how a girl plays hers. The reader's is seat 0 wherever seats are counted; the
 * girls follow in the order they play.
 */

export type Move = 'hit' | 'stand'

/** How many hands a match is where nothing was settled. */
export const HANDS = 3

/** The deck is shuffled afresh before a hand that would start with fewer cards than this. */
export const RESHUFFLE_UNDER = 16

/** What a hand comes to: aces are 11 while that keeps it at 21 or under. `soft` is one that is. */
export function handTotal(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const card of cards) {
    if (card.rank === 14) aces++
    total += card.rank === 14 ? 11 : Math.min(card.rank, 10)
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return { total, soft: aces > 0 }
}

/** A 21 in two cards. */
export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21
}

/**
 * Where a hand stands against another: its total, with a bust below everything and a two-card
 * 21 above a 21 made with more.
 */
export function standing(cards: readonly Card[]): number {
  const { total } = handTotal(cards)
  return total > 21 ? -1 : isNatural(cards) ? 22 : total
}

export type HandWinner = 'reader' | 'her' | 'push'

/** Who takes a finished hand. The reader plays first, so his bust loses it whatever she holds. */
export function handWinner(mine: readonly Card[], hers: readonly Card[]): HandWinner {
  const [a, b] = [standing(mine), standing(hers)]
  if (a < 0) return 'her'
  return a > b ? 'reader' : a < b ? 'her' : 'push'
}

/**
 * The seat that takes a finished hand among everyone's, the reader's first: the best one not
 * over 21, where one seat alone holds it. Null is a push: the best is shared, or all are bust.
 */
export function tableWinner(hands: readonly (readonly Card[])[]): number | null {
  const marks = hands.map(standing)
  const best = Math.max(...marks)
  if (best < 0 || marks.filter((mark) => mark === best).length > 1) return null
  return marks.indexOf(best)
}

/**
 * The top card and the deck without it; a fresh deck is cut where the old one has run out, less
 * the cards `inPlay` on the table, so that none of them turns up twice.
 */
export function drawCard(
  deck: readonly Card[],
  rand: () => number = Math.random,
  inPlay: readonly Card[] = []
): [Card, Card[]] {
  const from =
    deck.length > 0
      ? deck
      : freshDeck(rand).filter(
          (card) => !inPlay.some((held) => held.rank === card.rank && held.suit === card.suit)
        )
  return [from[0], from.slice(1)]
}

/** A card that shows is a ten or an ace: the hand behind it is likely a strong one. */
function strongUp(card: Card): boolean {
  return card.rank >= 10
}

/**
 * The right move for a girl, who sees what she has to beat: `shown` is every hand finished
 * before hers, the reader's among them, and `behind` the up-cards of the girls still to play.
 * A card for as long as she is behind, and on level totals a card only while it is likelier to
 * help than to break her. A two-card 21 cannot be caught, so she leaves a beaten hand alone.
 * Ahead, or with everyone before her bust, she stands where nobody plays after her; with girls
 * still to come she builds a hand they will have to beat, a little further where one of them
 * shows a ten or an ace.
 */
export function soundAt(
  hers: readonly Card[],
  shown: readonly (readonly Card[])[],
  behind: readonly Card[] = []
): Move {
  const [a, b] = [standing(hers), Math.max(...shown.map(standing))]
  if (b === 22) return 'stand'
  if (a < b) return 'hit'
  const { total, soft } = handTotal(hers)
  if (a > b) {
    if (behind.length === 0) return 'stand'
    return total <= (soft ? 17 : behind.some(strongUp) ? 15 : 14) ? 'hit' : 'stand'
  }
  return total <= (soft ? 17 : 14) ? 'hit' : 'stand'
}

/** How often she gets a decision wrong where there is one to get wrong, by skill. */
const SLIP: Record<Skill, number> = { 1: 0.42, 2: 0.3, 3: 0.18, 4: 0.08, 5: 0 }

/**
 * A girl's move. The best player always makes the sound one. The rest make a person's mistakes,
 * the more often the weaker they are: losing their nerve and standing on a total that is still
 * beaten or only level, or thin with others still to play, where a card could break them, and
 * reaching for one more card on a middling hand that was already ahead.
 */
export function girlMove(
  hers: readonly Card[],
  shown: readonly (readonly Card[])[],
  behind: readonly Card[],
  skill: Skill,
  rand: () => number = Math.random
): Move {
  const sound = soundAt(hers, shown, behind)
  const slip = SLIP[skill]
  if (slip === 0) return sound
  const { total, soft } = handTotal(hers)
  if (sound === 'hit') {
    if (soft || total < 12) return 'hit'
    return rand() < slip ? 'stand' : 'hit'
  }
  const [a, b] = [standing(hers), Math.max(...shown.map(standing))]
  if (b < 0 || b === 22 || a <= b || total > 17) return 'stand'
  return rand() < slip / 2 ? 'hit' : 'stand'
}

/**
 * Whether the game is over, from the hands each seat has won: every hand played, or the leader
 * too far ahead for anyone to catch.
 */
export function gameOver(won: readonly number[], played: number, hands: number): boolean {
  const [first, second = 0] = [...won].sort((a, b) => b - a)
  return played >= hands || first - second > hands - played
}

/** How a game came out for the reader: his alone, shared at the top, or somebody else's. */
export function gameOutcome(won: readonly number[]): 'won' | 'lost' | 'draw' {
  const top = Math.max(...won)
  if (won[0] < top) return 'lost'
  return won.filter((count) => count === top).length > 1 ? 'draw' : 'won'
}

/** A card the reader asked for, and what he held when he asked. */
export interface HitMade {
  total: number
  soft: boolean
}

/** A move of hers, what she held when she made it, and what the sound move was. */
export interface HerMoveMade {
  move: Move
  total: number
  sound: Move
}

/** A girl's side of a finished hand: the cards she ended with, and the moves she made. */
export interface SeatPlayed {
  cards: readonly Card[]
  moves: readonly HerMoveMade[]
}

/** One finished hand at a table of any size: the reader's side, and each girl's in playing order. */
export interface TableHand {
  mine: readonly Card[]
  hits: readonly HitMade[]
  girls: readonly SeatPlayed[]
}

/** Everyone's cards in a finished hand, by seat. */
function allCards(hand: TableHand): (readonly Card[])[] {
  return [hand.mine, ...hand.girls.map((girl) => girl.cards)]
}

/** Hands won by each seat over the hands played so far, at a table of `girls` girls. */
export function tableWon(hands: readonly TableHand[], girls: number): number[] {
  const won = Array.from({ length: girls + 1 }, () => 0)
  for (const hand of hands) {
    const winner = tableWinner(allCards(hand))
    if (winner !== null) won[winner]++
  }
  return won
}

/**
 * The girl to say something about a finished hand, by her place among the girls: the one who
 * took it; failing that one who turned a two-card 21, one level at the top of a push, or the
 * one the reader's hand beat most narrowly. Among equals it is whoever has spoken least so far,
 * `spoken` being how often each has.
 */
export function remarkBy(hand: TableHand, spoken: readonly number[]): number {
  const marks = allCards(hand).map(standing)
  const winner = tableWinner(allCards(hand))
  if (winner !== null && winner > 0) return winner - 1
  const hers = marks.slice(1)
  const top = Math.max(...marks)
  const among = (mark: number): number[] =>
    hers.flatMap((own, i) => (own === mark ? [i] : []))
  const group = [among(22), winner === null && top >= 0 ? among(top) : [], among(Math.max(...hers))].find(
    (girls) => girls.length > 0
  )!
  return group.reduce((least, i) => ((spoken[i] ?? 0) < (spoken[least] ?? 0) ? i : least))
}

/** Two or more cards said aloud: "a king and a six". */
export function cardsWord(cards: readonly Card[]): string {
  const words = cards.map((card) => rankWord(card.rank))
  return words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** A hand's total as the narration says it. */
export function totalWord(cards: readonly Card[]): string {
  return isNatural(cards) ? '21 in two cards' : String(handTotal(cards).total)
}

/** The deal of a hand, as the scene's narration says it. `ups` is each girl's card that shows. */
export function tableDeal(
  names: readonly string[],
  no: number,
  mine: readonly Card[],
  ups: readonly Card[]
): string {
  const shows =
    names.length === 1
      ? `${names[0]} shows ${rankWord(ups[0].rank)}, her other card face down.`
      : `${names[0]} shows ${listed([rankWord(ups[0].rank), ...names.slice(1).map((name, i) => `${name} ${rankWord(ups[i + 1].rank)}`)])}, each with a card face down.`
  return `Hand ${no}. You are dealt ${cardsWord(mine)}: ${totalWord(mine)}. ${shows}`
}

/** How a finished hand came out heads-up, as the scene's narration says it. */
export function resultLine(name: string, mine: readonly Card[], hers: readonly Card[]): string {
  const winner = handWinner(mine, hers)
  if (standing(mine) < 0) return `The hand is ${name}'s.`
  if (standing(hers) < 0) return 'The hand is yours.'
  if (winner === 'push') return `Both on ${totalWord(mine)}: a push, and nobody takes the hand.`
  return winner === 'reader'
    ? `Your ${totalWord(mine)} beats her ${totalWord(hers)}: the hand is yours.`
    : `Her ${totalWord(hers)} beats your ${totalWord(mine)}: the hand is ${name}'s.`
}

/** How a finished hand came out at a table of any size, as the scene's narration says it. */
export function tableResult(names: readonly string[], hand: TableHand): string {
  if (names.length === 1) return resultLine(names[0], hand.mine, hand.girls[0].cards)
  const cards = allCards(hand)
  const marks = cards.map(standing)
  const winner = tableWinner(cards)
  const best = Math.max(...marks)
  if (best < 0) return 'Everyone is bust: a push, and nobody takes the hand.'
  if (winner === null) {
    const level = ['You', ...names].filter((_, seat) => marks[seat] === best)
    return `${listed(level)} are level on ${totalWord(cards[marks.indexOf(best)])}: a push, and nobody takes the hand.`
  }
  const whose = winner === 0 ? 'yours' : `${names[winner - 1]}'s`
  if (marks.every((mark, seat) => seat === winner || mark < 0)) {
    return `Everyone else is bust: the hand is ${whose}.`
  }
  const holder = winner === 0 ? 'Your' : `${names[winner - 1]}'s`
  return `${holder} ${totalWord(cards[winner])} is the best hand: the hand is ${whose}.`
}

/** A count of hands: "1 hand", "2 hands". */
function handsWord(count: number): string {
  return `${count} hand${count === 1 ? '' : 's'}`
}

/** What a match comes to heads-up, as the scene's narration says it. */
export function matchSummary(name: string, mine: number, hers: number): string {
  const count = (a: number, b: number): string => `${a} hand${a === 1 ? '' : 's'} to ${b}`
  if (mine > hers) return `You play blackjack with ${name} and win, ${count(mine, hers)}.`
  if (mine < hers) return `You play blackjack with ${name} and lose, ${count(mine, hers)}.`
  return `You play blackjack with ${name} and it ends level, ${mine} hand${mine === 1 ? '' : 's'} each.`
}

/**
 * What a game comes to at a table of any size, as the scene's narration says it. `won` is the
 * hands each seat took, the reader's first.
 */
export function tableSummary(names: readonly string[], won: readonly number[]): string {
  if (names.length === 1) return matchSummary(names[0], won[0], won[1])
  const top = Math.max(...won)
  const open = `You play blackjack with ${listed(names)}`
  const girls = names.map((name, i) => ({ name, count: won[i + 1] }))
  const leaders = girls.filter((girl) => girl.count === top)
  const rest = girls.filter((girl) => girl.count < top).map((girl) => `${girl.name}'s ${girl.count}`)
  if (won[0] < top) {
    const took =
      leaders.length === 1
        ? `${leaders[0].name} takes it with ${handsWord(top)}`
        : `${listed(leaders.map((girl) => girl.name))} share it on ${handsWord(top)} each`
    return `${open} and lose: ${took}, to ${listed([`your ${won[0]}`, ...rest])}.`
  }
  if (leaders.length === 0) return `${open} and win, ${handsWord(top)} to ${listed(rest)}.`
  return `${open} and finish level with ${listed(leaders.map((girl) => girl.name))} on ${handsWord(top)} each${rest.length ? `, ahead of ${listed(rest)}` : ''}.`
}

/** One hand as the account tells it, and whether it was out of the ordinary. */
export interface HandTold {
  /** The hand in a line, each side's play with its judgment. */
  line: string
  /** Worth a remark at the table: a bust, a two-card 21, or a hand won by a single point. */
  notable: boolean
}

/** A list of totals said aloud: "12, 15 and 19". */
function totalsWord(totals: readonly number[]): string {
  return totals.length < 2
    ? totals.join('')
    : `${totals.slice(0, -1).join(', ')} and ${totals[totals.length - 1]}`
}

/**
 * The reader's side of a hand, judged. He plays without seeing a girl's total, so drawing on a
 * middling hand is a fair risk whatever comes; what is his own doing is drawing on a hard 17 or
 * better, or standing on a total no card could have broken.
 */
function readerTold(hand: Pick<TableHand, 'mine' | 'hits'>): string {
  if (isNatural(hand.mine)) return 'was dealt a two-card 21: luck, not play'
  const { total } = handTotal(hand.mine)
  const hits = hand.hits
  const last = hits[hits.length - 1]
  const rash = hits.some((hit) => !hit.soft && hit.total >= 17)
  const drew = hits.length ? `hit on ${totalsWord(hits.map((hit) => hit.total))} and ` : ''
  if (total > 21) {
    const note =
      !last.soft && last.total >= 17
        ? `a reckless call: almost nothing helps a ${last.total}`
        : last.total >= 15
          ? 'a gamble that failed'
          : 'a fair risk that failed: bad luck'
    return `${drew}bust with ${total}, ${note}`
  }
  const note = rash
    ? ', after a reckless draw that came off'
    : total <= 11
      ? ', a mistake: no card could have bust him'
      : ''
  return `${drew}stood on ${total}${note}`
}

/**
 * A girl's side of a hand, judged against the sound move at each step, which she could always
 * work out: she saw what she had to beat, the best of the hands finished before hers, and who
 * was still to play after her.
 */
function girlTold(names: readonly string[], hand: TableHand, at: number): string {
  const seat = hand.girls[at]
  const marks = allCards(hand).slice(0, at + 1).map(standing)
  const best = Math.max(...marks)
  const holder = marks.indexOf(best)
  const [whose, whom] = holder === 0 ? ['his', 'him'] : [`${names[holder - 1]}'s`, names[holder - 1]]
  const after = names.slice(at + 1)
  const { total } = handTotal(seat.cards)
  if (best < 0 && after.length === 0) return `had only to turn her card, holding ${total}`
  if (isNatural(seat.cards)) return 'turned over a two-card 21: luck, not play'
  if (best === 22) {
    return `could do nothing against ${names.length === 1 ? 'it' : `${whose} two-card 21`}, holding ${total}`
  }
  const moves = seat.moves
  const hits = moves.filter((made) => made.move === 'hit')
  const drew = hits.length ? `hit on ${totalsWord(hits.map((made) => made.total))} and ` : ''
  const greedy = moves.find((made) => made.move === 'hit' && made.sound === 'stand')
  const timid = moves.find((made) => made.move === 'stand' && made.sound === 'hit')
  if (total > 21) {
    if (greedy) {
      return `${drew}bust with ${total}, a mistake: she was already ahead on ${greedy.total} and threw the hand away`
    }
    return hits[hits.length - 1].total > best
      ? `${drew}bust with ${total}, bad luck: a fair risk with ${listed(after)} still to play`
      : `${drew}bust with ${total}, bad luck: she had to draw to beat ${whose} ${best}`
  }
  const note = timid
    ? timid.total < best
      ? `, a mistake: she was still behind ${whose} ${best} and gave the hand up`
      : timid.total === best
        ? `, timid play: level with ${whom} on a total that was worth another card`
        : `, timid play: a thin total with ${listed(after)} still to play`
    : greedy
      ? `, after a needless draw when she was already ahead on ${greedy.total}`
      : ''
  return `${drew}stood on ${total}${note}`
}

/**
 * Hand `no` of a game, counted from one, as the account tells it: each seat's play in the order
 * it was made, and who took the hand.
 */
export function tableTold(names: readonly string[], hand: TableHand, no: number): HandTold {
  const cards = allCards(hand)
  const marks = cards.map(standing)
  const winner = tableWinner(cards)
  const [first, second] = [...marks].sort((a, b) => b - a)
  const close = second > 0 && first < 22 && first - second === 1
  const heads = names.length === 1
  const level = ['the reader', ...names].filter((_, seat) => marks[seat] === first)
  const result =
    winner === null
      ? heads
        ? 'A push: nobody won it'
        : first < 0
          ? 'Everyone bust, a push: nobody won it'
          : `A push, ${listed(level)} level on ${first === 22 ? 'a two-card 21' : first}: nobody won it`
      : `${winner === 0 ? 'The reader' : names[winner - 1]} won it${close ? ' by a single point' : ''}`
  const girls = names.map((name, at) => `${name} ${girlTold(names, hand, at)}`)
  const busts = marks.filter((mark) => mark < 0).length
  return {
    line: `Hand ${no}: the reader ${readerTold(hand)}; ${girls.join('; ')}. ${result}.`,
    // Around a full table somebody busts most hands: it takes his own, or more than one.
    notable:
      marks.includes(22) ||
      close ||
      (heads ? busts > 0 : marks[0] < 0 || busts > 1 || winner === null)
  }
}

/**
 * How a game went at a table of any size, hand by hand, for the scene's writer: what each seat
 * did on what total, with bad play told apart from bad luck, the count of hands at the end and
 * whose game it was.
 */
export function tableAccount(
  names: readonly string[],
  hands: readonly TableHand[],
  agreed: number
): string[] {
  const won = tableWon(hands, names.length)
  const told = hands.map((hand, i) => tableTold(names, hand, i + 1).line)
  const stopped =
    hands.length < agreed ? ['The match stopped there: the lead could no longer be caught.'] : []
  if (names.length === 1) {
    const name = names[0]
    return [
      `It was heads-up blackjack over ${agreed} hand${agreed === 1 ? '' : 's'}, no dealer. The reader played each hand first without seeing ${name}'s face-down card; she then played knowing his total. Equal totals are a push.`,
      ...told,
      ...stopped,
      `Final count of hands: the reader ${won[0]}, ${name} ${won[1]}.`
    ]
  }
  const top = Math.max(...won)
  const leaders = ['the reader', ...names].filter((_, seat) => won[seat] === top)
  const took = leaders.length === 1 ? `${leaders[0]} took the game` : `${listed(leaders)} shared the lead`
  return [
    `It was blackjack between the reader, ${listed(names)} over ${agreed} hand${agreed === 1 ? '' : 's'}, no dealer, everyone against everyone. The reader played each hand first without seeing the girls' face-down cards; then ${names.join(', then ')}, each knowing the hands finished before hers and one card of any still to come. The best hand not over 21 took the hand; a shared best is a push.`,
    ...told,
    ...stopped,
    `Final count of hands: the reader ${won[0]}, ${names.map((name, i) => `${name} ${won[i + 1]}`).join(', ')}: ${took}.`
  ]
}
