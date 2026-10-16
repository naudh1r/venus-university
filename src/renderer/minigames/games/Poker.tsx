import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { freshDeck, rankMark, type Card, type Suit } from '@shared/minigameKit'
import { listed } from '@shared/minigameKit'
import {
  BIG_BLIND,
  SMALL_BLIND,
  act,
  bustedIn,
  actionLine,
  actionsLine,
  chipsLine,
  cardWord,
  dealHand,
  dealLine,
  evaluate,
  gameOutcome,
  gameOver,
  girlAction,
  handName,
  handTold,
  holeWord,
  legal,
  nextButton,
  owedBy,
  pokerAccount,
  pokerProgress,
  pokerSummary,
  potOf,
  proceed,
  remarkBy,
  resultLines,
  startingStack,
  streetLine,
  type ActionMade,
  type HandState,
  type Move,
  type Pot
} from '@shared/minigameRules/poker'
import { gestures, lift, press, useReducedMotion } from '../kit'
import { BunnyMark } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/Poker.css'

const SUIT_MARK: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

/** How many times in a game the girls say something about a hand, between them, by how talkative they are to be. */
const REMARKS = { quiet: 0, some: 3, lots: 6 } as const

/** How long a girl takes over a move: long enough for the last one to be read first. */
const GIRL_MS = 1300

/** The same once the reader has folded and is only watching. */
const WATCHING_MS = 800

/** How long the betting stays closed before the next street is dealt, or the hands are shown. */
const STREET_MS = 1300

/** How long a finished hand lies on the table before the next is dealt. */
const NEXT_HAND_MS = 2800

/** The longest the next hand waits on something being said: her line may land over the deal. */
const SAY_WAIT_MS = 3000

/** The least a hand lies there once the wait for her line is over. */
const AFTER_REMARK_MS = 600

/** At the reader's own pace, the beat a move takes on the board once the text allows it. */
const STEP_MS = 400

/** How long the last hand lies on the table before the game is handed back, where the box is not saying how it ended. */
const LAST_HAND_MS = 2800

/** The table: the hand on it, and the hands already finished, this one among them once it is over. */
interface Table {
  hand: HandState
  done: HandState[]
}

function CardFace({ card }: { card: Card }): JSX.Element {
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <span
      className={`vu-poker-card${red ? ' vu-poker-card--red' : ''}`}
      aria-label={`${rankMark(card.rank)} of ${card.suit}`}
    >
      <span className="vu-poker-rank">{rankMark(card.rank)}</span>
      <span className="vu-poker-suit">{SUIT_MARK[card.suit]}</span>
    </span>
  )
}

function CardBack(): JSX.Element {
  return (
    <span className="vu-poker-back" aria-label="a card face down">
      <BunnyMark />
    </span>
  )
}

/** A card landing where it is dealt. */
function Dealt({ children }: { children: JSX.Element }): JSX.Element {
  const still = useReducedMotion()
  return (
    <motion.span
      className="vu-poker-slot"
      initial={still ? false : { opacity: 0, y: -14, rotate: -5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
    >
      {children}
    </motion.span>
  )
}

/** What a seat last did on this street, or how it stands in the hand, in a word or two. */
function standingOf(hand: HandState, at: number): string {
  const seat = hand.seats[at]
  if (seat.out) return 'out'
  if (hand.over) {
    const won = hand.pots.some((pot) => pot.winners.includes(at))
    return seat.folded ? 'folded' : won ? 'wins' : ''
  }
  if (seat.folded) return 'folded'
  if (seat.allIn) return 'all-in'
  const last = [...hand.log].reverse().find((made) => made.seat === at && made.street === hand.street)
  if (!last) return hand.toAct === at ? 'to act' : ''
  if (hand.toAct === at) return 'to act'
  return last.kind === 'check' ? 'checks' : last.kind === 'call' ? 'calls' : last.kind === 'bet' ? 'bets' : 'raises'
}

/** The seat's place in the deal: the button, a blind, or nothing. */
function placeOf(hand: HandState, at: number): string {
  const marks = [
    ...(hand.button === at ? ['D'] : []),
    ...(hand.smallBlind === at ? ['SB'] : hand.bigBlind === at ? ['BB'] : [])
  ]
  return marks.join(' · ')
}

/**
 * How a finished hand came out, short enough for the line under the pot: who took which pot,
 * and who lost the last of their chips in it. "Ana takes 120 · side pot: you take 40 · Bea is out"
 */
function handOutcome(names: readonly string[], hand: HandState): string {
  const who = (seat: number): string => (seat === 0 ? 'you' : names[seat - 1])
  // Pots that went to the same players are said as one.
  const taken: Pot[] = []
  for (const pot of hand.pots) {
    if (pot.amount <= 0) continue
    const last = taken[taken.length - 1]
    if (last && last.winners.join() === pot.winners.join()) last.amount += pot.amount
    else taken.push({ ...pot })
  }
  const said = taken.map((pot, i) => {
    const verb = pot.winners.length > 1 ? 'split' : pot.winners[0] === 0 ? 'take' : 'takes'
    return `${i > 0 ? 'side pot: ' : ''}${listed(pot.winners.map(who))} ${verb} ${pot.amount}`
  })
  const gone = bustedIn(hand)
  if (gone.length) said.push(`${listed(gone.map(who))} ${gone.length > 1 || gone[0] === 0 ? 'are' : 'is'} out`)
  return said.join(' · ')
}

/** Who won the game, once it is over: the most chips, alone or level. */
function gameWinner(names: readonly string[], stacks: readonly number[]): string {
  const top = Math.max(...stacks)
  const leaders = stacks.flatMap((chips, i) => (chips === top ? [i === 0 ? 'you' : names[i - 1]] : []))
  if (leaders.length > 1) return `${listed(leaders)} finish level`
  return leaders[0] === 'you' ? 'you win the game' : `${leaders[0]} wins the game`
}

/**
 * Texas hold'em for play chips, heads-up or with two or three girls, each for herself. Everyone
 * starts with the same stack; a set number of hands is played, or fewer if the reader loses his
 * chips or one player takes them all, and the most chips at the end wins. The reader folds,
 * checks or calls, or bets half the pot, the pot or everything; each girl plays her own hand at
 * her skill. The board shows the cards, the chips, the pot, what each seat last did and, under
 * the pot, how a hand and the game came out; with the play-by-play on, the scene's dialogue box
 * says it too.
 */
export function Poker({ play }: { play: GamePlay }): JSX.Element | null {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const hands = play.options.hands ?? 5
  const stack = startingStack(play.options.stack ?? 2)
  const [table, setTable] = useState<Table>(() => ({
    // The last girl deals the first hand, and the button goes round from her.
    hand: dealHand(
      Array.from({ length: girls.length + 1 }, () => stack),
      girls.length,
      1,
      freshDeck()
    ),
    done: []
  }))
  // One of them is saying something about the last hand: the next one waits for it.
  const [speaking, setSpeaking] = useState(false)
  const remarks = useRef(0)
  // How often each girl has had the word, so that it goes round.
  const spoken = useRef<number[]>([])
  // The framework may clear the table at any moment; nothing is set on one that is gone.
  const live = useRef(true)
  // The game has been handed back: nothing more is said or played.
  const finished = useRef(false)
  // Which remark the table is waiting on, and the timer that ends the wait.
  const awaited = useRef(0)
  const sayCap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // When the hand on the table was settled.
  const settledAt = useRef(0)
  // Her line is still being written: nobody else is asked for one until it is in.
  const saying = useRef(false)
  // The hand as it stood when the last move was made from it: one move a position, however fast the clicks.
  const movedFrom = useRef<HandState | null>(null)
  // The checks, calls and folds made since the last line: they are said together, in one.
  const unsaid = useRef<ActionMade[]>([])
  // The last line said: once it is on the box, the reader has reached everything said so far.
  const reached = useRef<Promise<void>>(Promise.resolve())
  // The finished hand the next was dealt from: one deal a hand.
  const dealtFrom = useRef<HandState | null>(null)

  /** Says a line, and keeps hold of when the reader gets to it. */
  function tell(text: string): Promise<void> {
    const shown = play.narrate(text)
    reached.current = shown
    return shown
  }
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      clearTimeout(sayCap.current)
    }
  }, [])

  const seated = girls.length > 0
  const { hand, done } = table
  const chips = hand.seats.map((seat) => seat.stack)
  const over = hand.over && gameOver(chips, done.length, hands)
  const myTurn = hand.toAct === 0 && !hand.over
  const can = legal(hand, 0)
  // The text is read at the reader's own pace and the moves are in it: stepping past a line is
  // what moves the game on. Otherwise the board keeps its own time, so nothing flashes past.
  const paced = play.stepped && play.playByPlay

  // The game is on from the moment they sit down, and the first deal is said.
  useEffect(() => {
    if (!seated) return
    // On the next tick, so a mount that is at once undone and redone (StrictMode's) says it once.
    const timer = setTimeout(() => {
      const dealer = names[names.length - 1]
      tell(
        `${dealer} shuffles and deals hold'em for ${listed(['you', ...names.slice(0, -1), 'herself'])}: ${stack} in play chips each, blinds ${SMALL_BLIND} and ${BIG_BLIND}, up to ${hands} hands, and the most chips at the end wins.`
      )
      tell(dealLine(names, hand))
    }, 0)
    return () => clearTimeout(timer)
    // Once, as the table opens.
  }, [])

  /** The routine moves not yet said, as one line, or nothing where there are none. */
  function routine(): string {
    const made = unsaid.current
    unsaid.current = []
    return made.length ? actionsLine(names, made) : ''
  }

  /**
   * The hand has moved on: what happened is said, and where it ended the hand is closed. A
   * check, a call or a fold waits to be said with the others of its round, in one line: when the
   * reader is to move, before a bet or a raise, with the next card, or with how the hand ended.
   */
  function carry(next: HandState, line?: string, own = false): void {
    let last: Promise<void> | undefined
    const said = (text: string): void => {
      const all = [routine(), text].filter(Boolean).join(' ')
      if (all) last = tell(all)
    }
    const rest: string[] = []
    if (!next.over) {
      if (line || next.toAct === 0) said(line ?? '')
    } else {
      const [first, ...more] = resultLines(names, next)
      said([line, first].filter(Boolean).join(' '))
      rest.push(...more)
      if (rest.length) last = tell(rest.join(' '))
    }
    const land = (): void => {
      if (!next.over) {
        setTable({ hand: next, done })
        return
      }
      settledAt.current = performance.now()
      const all = [...done, next]
      setTable({ hand: next, done: all })
      const stacks = next.seats.map((seat) => seat.stack)
      if (!gameOver(stacks, all.length, hands)) {
        // Should he walk away now, the scene knows how far the game got. No cards are in it.
        play.progress(pokerProgress(names, stacks, all.length, stack, hands))
        remark(all)
        return
      }
      finished.current = true
      const result = {
        outcome: gameOutcome(stacks),
        summary: pokerSummary(names, stacks, all.length),
        account: pokerAccount(names, all, stack, hands)
      }
      // Where the box says how it ended, the table stands while that is read. Where it does not,
      // the last hand and who won lie on the board a while before the game is handed back.
      if (play.playByPlay) play.finish(result)
      else
        setTimeout(() => {
          if (live.current) play.finish(result)
        }, LAST_HAND_MS)
    }
    // The board shows a girl's move, a card or a result only once its line is on the box, at
    // the reader's own pace or the text's. His own move shows at once, and so does one that
    // leaves him to act: his buttons are never kept waiting, and pressing one is him moving on.
    const held = !own && last && (next.over || next.toAct !== 0)
    if (!held || !last) {
      land()
      return
    }
    void last.then(() => {
      if (live.current && !finished.current) land()
    })
  }

  /**
   * Has one of the girls say something about the hand just finished, where it is worth it: a
   * bluff that worked or was caught, a bad beat or a bad call, an all-in, a big pot, somebody
   * losing her last chip. A few times a game at most between them all, one voice a hand, and
   * never on the last hand, which the scene's own reply answers, nor while an earlier line is
   * still being written. She is told what the table saw and nothing else: no hand that was
   * folded or never turned over, her own included, so nothing she says can give one away.
   */
  function remark(all: readonly HandState[]): void {
    if (saying.current || remarks.current >= REMARKS[play.chattiness]) return
    const last = all[all.length - 1]
    const told = handTold(names, last, stack)
    // Talkative, they have a word for an ordinary hand too.
    if (!told.notable && play.chattiness !== 'lots') return
    remarks.current++
    const by = remarkBy(last, spoken.current)
    spoken.current[by] = (spoken.current[by] ?? 0) + 1
    const own = last.seats[by + 1].out ? ` ${names[by]} was already out of chips and only watched.` : ''
    const stacks = last.seats.map((seat) => seat.stack)
    const cue = `${told.seen}${own} The chips now: ${chipsLine(names, stacks, 'the reader')}.${all.length + 1 === hands ? ' The next hand is the last.' : ''}`
    // The next hand waits for her line, but not for long: a slow one lands over the deal.
    const mine = ++awaited.current
    const release = (): void => {
      if (!live.current || awaited.current !== mine) return
      awaited.current++
      clearTimeout(sayCap.current)
      setSpeaking(false)
    }
    setSpeaking(true)
    clearTimeout(sayCap.current)
    sayCap.current = setTimeout(release, SAY_WAIT_MS)
    const landed = (): void => {
      saying.current = false
      release()
    }
    saying.current = true
    void Promise.resolve()
      .then(() => play.say(girls[by].charId, cue))
      .then(landed, landed)
  }

  /** The seat to act makes a move, and it is said. */
  function move(made: Move): void {
    if (finished.current || !live.current || hand.over || hand.toAct === null) return
    if (movedFrom.current === hand) return
    movedFrom.current = hand
    const next = act(hand, made)
    const did = next.log[next.log.length - 1]
    // A bet, a raise and anything all-in has a line to itself, after what led to it.
    if (did.kind === 'bet' || did.kind === 'raise' || did.allIn) {
      const before = routine()
      if (before) tell(before)
      carry(next, actionLine(names, did), did.seat === 0)
      return
    }
    unsaid.current.push(did)
    carry(next, undefined, did.seat === 0)
  }

  /** The reader's move, from one of his buttons. */
  function mine(made: Move): void {
    if (myTurn) move(made)
  }

  /** The next thing that happens without the reader: a girl's move, a street, or the showdown. */
  function step(): void {
    if (finished.current || !live.current || hand.over) return
    if (hand.toAct === null) {
      if (movedFrom.current === hand) return
      movedFrom.current = hand
      const next = proceed(hand)
      carry(next, next.board.length > hand.board.length ? streetLine(next) : undefined)
      return
    }
    if (hand.toAct === 0) return
    const girl = girls[hand.toAct - 1]
    move(girlAction(hand, hand.toAct, girl.skill, girl.style))
  }

  // How the game stands, for anything said at the table. Nobody's hidden cards are in it.
  useEffect(() => {
    if (!seated) return
    const who = (seat: number): string => (seat === 0 ? 'the reader' : names[seat - 1])
    const state = hand.seats.flatMap((seat, i) =>
      seat.out ? [`${who(i)} is out of chips`] : seat.folded ? [`${who(i)} has folded`] : seat.allIn && !hand.over ? [`${who(i)} is all-in`] : []
    )
    play.situation(
      [
        `The game is Texas hold'em for play chips between the reader and ${listed(names)}, each for herself: ${hands} hands at most, blinds ${SMALL_BLIND} and ${BIG_BLIND}, everyone started with ${stack}, and the most chips at the end wins. The chips are only counters.`,
        `Chips: ${chipsLine(names, chips, 'the reader')}.`,
        hand.over
          ? `Hand ${hand.no} has just finished.`
          : `Hand ${hand.no} is being played: ${hand.board.length ? `the board shows ${listed(hand.board.map(cardWord))}` : 'no cards are on the board yet'}, and the pot is ${potOf(hand)}.${state.length ? ` ${state.join('; ')}.` : ''}`,
        over
          ? 'The last hand has just been played.'
          : hand.over
            ? 'The next hand is about to be dealt.'
            : hand.toAct === null
              ? 'The betting is closed and the next card is about to come.'
              : `It is ${who(hand.toAct)}'s move${owedBy(hand, hand.toAct) > 0 ? `, with ${owedBy(hand, hand.toAct)} to call` : ''}.`,
        'Everyone keeps her own two cards to herself: nobody says what she holds while a hand is on, and a folded hand is never shown.',
        ...(play.stake ? [`Riding on the game: ${play.stake}`] : [])
      ].join(' ')
    )
  })

  // The girls' moves and the cards to come, after a beat, one step at a time.
  useEffect(() => {
    if (!seated || hand.over || hand.toAct === 0) return
    const wait = hand.toAct === null ? STREET_MS : hand.seats[0].folded || hand.seats[0].out ? WATCHING_MS : GIRL_MS
    // A beat for the board, the text's own time being the least of it where it keeps one, and
    // then not before the last line said is on the box.
    let gone = false
    const timer = setTimeout(
      () => {
        void reached.current.then(() => {
          if (!gone) step()
        })
      },
      paced ? STEP_MS : wait
    )
    return () => {
      gone = true
      clearTimeout(timer)
    }
    // Every step puts a new hand on the table.
  }, [hand])

  // The next hand, once the last has been looked at and whoever spoke has said what she had to say.
  useEffect(() => {
    if (!seated || !hand.over || over || speaking) return
    // Counted from when the hand was settled, so time spent waiting on her line is not added to.
    const lain = performance.now() - settledAt.current
    let gone = false
    const timer = setTimeout(
      () => {
        // Not before how the last hand ended is on the box.
        void reached.current.then(() => {
          if (gone || !live.current || finished.current || dealtFrom.current === hand) return
          dealtFrom.current = hand
          const stacks = hand.seats.map((seat) => seat.stack)
          const next = dealHand(stacks, nextButton(stacks, hand.button), hand.no + 1, freshDeck())
          // The cards are dealt once the deal's own line is on the box.
          void tell(dealLine(names, next)).then(() => {
            if (live.current && !finished.current) setTable({ hand: next, done })
          })
        })
      },
      paced ? STEP_MS : Math.max(NEXT_HAND_MS - lain, AFTER_REMARK_MS)
    )
    return () => {
      gone = true
      clearTimeout(timer)
    }
    // A hand ends once, which the hand itself says.
  }, [hand, over, speaking])

  // Poker is played against someone; with nobody seated there is no game to draw.
  if (!seated) return null

  const waiting = !myTurn
  const me = hand.seats[0]
  const pot = potOf(hand)
  const winners = new Set(hand.over ? hand.pots.flatMap((each) => each.winners) : [])
  const held =
    !me.out && hand.board.length >= 3 ? handName(evaluate([...me.hole, ...hand.board])) : !me.out ? holeWord(me.hole) : ''
  const raising = hand.currentBet > 0
  // A size that comes to the same as a bigger one is left to the bigger one's button.
  const sizes = [
    { id: 'half', label: 'Half pot', to: can.halfTo, dead: can.halfTo >= can.potTo },
    { id: 'pot', label: 'Pot', to: can.potTo, dead: can.potTo >= can.maxTo },
    { id: 'all', label: 'All-in', to: can.maxTo, dead: false }
  ]

  return (
    <div className="vu-poker">
      <div className="vu-poker-girls">
        {girls.map((girl, i) => {
          const at = i + 1
          const seat = hand.seats[at]
          const up = hand.over && hand.showdown && !seat.folded && !seat.out
          return (
            <div
              key={girl.charId}
              className="vu-poker-seat"
              data-turn={(hand.toAct === at && !hand.over) || undefined}
              data-gone={seat.folded || seat.out || undefined}
              data-won={winners.has(at) || undefined}
            >
              <p className="vu-poker-who">
                {girl.name}
                <span className="vu-poker-place">{placeOf(hand, at)}</span>
              </p>
              <div className="vu-poker-hole" key={`${hand.no}:${up ? 'up' : 'down'}`}>
                {seat.out ? (
                  <span className="vu-poker-empty" />
                ) : (
                  seat.hole.map((card, k) => (
                    <Dealt key={k}>{up ? <CardFace card={card} /> : <CardBack />}</Dealt>
                  ))
                )}
              </div>
              <p className="vu-poker-chips">
                {seat.stack}
                <span className="vu-poker-bet">{seat.bet > 0 ? `in ${seat.bet}` : ''}</span>
              </p>
              <p className="vu-poker-state">
                {up ? handName(evaluate([...seat.hole, ...hand.board])) : standingOf(hand, at)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="vu-poker-middle">
        <div className="vu-poker-board" key={hand.no}>
          {Array.from({ length: 5 }, (_, i) =>
            hand.board[i] ? (
              <Dealt key={i}>
                <CardFace card={hand.board[i]} />
              </Dealt>
            ) : (
              <span key={i} className="vu-poker-slot">
                <span className="vu-poker-empty" />
              </span>
            )
          )}
        </div>
        <p className="vu-poker-pot">
          {hand.over ? 'pot won' : 'pot'} {hand.over ? hand.pots.reduce((sum, each) => sum + each.amount, 0) : pot}
          <span className="vu-poker-round" data-called={hand.over || undefined}>
            {over
              ? `game over · ${handOutcome(names, hand)} · ${gameWinner(names, chips)}`
              : hand.over
                ? `hand ${hand.no} of ${hands} · ${handOutcome(names, hand)}`
                : `hand ${hand.no} of ${hands} · blinds ${SMALL_BLIND}/${BIG_BLIND}`}
          </span>
        </p>
      </div>

      <div
        className="vu-poker-seat vu-poker-seat--mine"
        data-turn={myTurn || undefined}
        data-gone={me.folded || me.out || undefined}
        data-won={winners.has(0) || undefined}
      >
        <div className="vu-poker-hole" key={hand.no}>
          {me.out ? (
            <span className="vu-poker-empty" />
          ) : (
            me.hole.map((card, k) => (
              <Dealt key={k}>
                <CardFace card={card} />
              </Dealt>
            ))
          )}
        </div>
        <div className="vu-poker-mine">
          <p className="vu-poker-who">
            you
            <span className="vu-poker-place">{placeOf(hand, 0)}</span>
          </p>
          <p className="vu-poker-chips">
            {me.stack}
            <span className="vu-poker-bet">{me.bet > 0 ? `in ${me.bet}` : ''}</span>
          </p>
          <p className="vu-poker-state">{me.folded ? 'folded' : winners.has(0) ? `${held} · wins` : held}</p>
        </div>
      </div>

      {/* The moves keep their place when they cannot be made, so the board does not jump. */}
      <div className="vu-poker-moves" inert={waiting || undefined} data-waiting={waiting || undefined}>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          disabled={waiting || can.canCheck}
          {...gestures(waiting || can.canCheck, lift, press)}
          onClick={() => mine({ kind: 'fold' })}
        >
          Fold
        </motion.button>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          disabled={waiting}
          {...gestures(waiting, lift, press)}
          onClick={() => mine({ kind: 'call' })}
        >
          {can.canCheck || waiting ? 'Check' : `Call ${can.owed}`}
        </motion.button>
        <span className="vu-poker-sizes">
          <span className="vu-poker-sizing">{raising ? 'raise to' : 'bet'}</span>
          {sizes.map((size) => {
            const dead = waiting || !can.canRaise || size.dead
            return (
              <motion.button
                key={size.id}
                type="button"
                className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
                disabled={dead}
                {...gestures(dead, lift, press)}
                onClick={() => mine({ kind: 'raise', to: size.to })}
              >
                {size.label}
                <span className="vu-poker-amount">{waiting || !can.canRaise ? '' : size.to}</span>
              </motion.button>
            )
          })}
        </span>
      </div>
    </div>
  )
}
