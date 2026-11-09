import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  CAFE_CATS,
  CAT_LINE,
  PAIRS,
  catDue,
  catMoved,
  catPick,
  catSwap,
  cleared,
  countLine,
  faceDown,
  gameAccount,
  gameOutcome,
  gameSummary,
  herFirst,
  herSecond,
  isOver,
  newGame,
  observe,
  pairCounts,
  playTurn,
  turnLine,
  turnTold,
  turnsMade,
  type CafeCat,
  type Game,
  type Memory
} from '@shared/minigameRules/catPairs'
import { listed } from '@shared/minigameKit'
import { gestures, quietPress, toggleLift } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/CatPairs.css'

/** How many times in a game the girls say something about a turn, between them, by how talkative they are to be. */
const REMARKS = { quiet: 0, some: 3, lots: 7 } as const

/** How long she takes over each card: long enough for the last turn to be read first. */
const HER_PAUSE_MS = 1300

/** The same around a fuller table, where a round is many turns. */
const GIRLS_PAUSE_MS = 850

/** How long two cards that do not match lie face up before they are turned back. */
const MISS_MS = 1500

/** How long a pair is looked at before the same player goes again. */
const PAIR_MS = 700

/** How long a cat takes to cross the table and swap two cards. */
const CAT_MS = 1700

/** Read at the reader's pace, the beat between a girl's first card and her second. */
const HER_BEAT_MS = 450

/** The longest the table waits on something being said. */
const SAY_WAIT_MS = 3000

/** The least the cards lie there once the wait for her line is over. */
const AFTER_REMARK_MS = 400

/**
 * How long the last pair lies on the table before the game is handed back, where the moves are
 * kept off the dialogue box: the last turn and how the game came out are read off the table.
 */
const LAST_PAIR_MS = 2000

/** The gap between two cards, in pixels. */
const GAP = 10

/**
 * A card's width and height in pixels, by how many columns the table has: smaller on the widest
 * tables, so that the longest game is no wider than a middling one. The grid is laid from these
 * and a swapped card travels by them, so the two cannot disagree.
 */
/**
 * How many columns the cards are laid in so the grid comes out full: three rows where they
 * divide by three, else four rows, else two, and three rows with a short last one only where
 * nothing fits the table (eleven pairs).
 */
function colsFor(cards: number): number {
  for (const rows of [3, 4, 2]) {
    if (cards % rows === 0 && cards / rows <= 8) return cards / rows
  }
  return Math.ceil(cards / 3)
}

function cardSize(cols: number): { w: number; h: number } {
  return cols >= 8 ? { w: 66, h: 88 } : cols === 7 ? { w: 74, h: 96 } : { w: 84, h: 106 }
}

/** Where the table is in a turn: cards to be picked, two lying face up, a cat crossing, or done. */
type Phase = 'pick' | 'show' | 'cat' | 'over'

/** One café cat's face, drawn in the theme's own colours: coat, marking, eyes and one thing of its own. */
function CatFace({ cat }: { cat: CafeCat }): JSX.Element {
  const { marking, eyes, extra } = cat
  // An eye that sits on a marking is drawn in the coat's colour, to show against it.
  const leftOnMark = marking === 'patch' || marking === 'split' || marking === 'mask'
  const rightOnMark = marking === 'mask'
  const eye = (x: number, onMark: boolean, shut: boolean): JSX.Element =>
    shut ? (
      <path
        d={`M${x - 4} 33 q4 4 8 0`}
        className={onMark ? 'vu-catpairs-ink--coat' : 'vu-catpairs-ink'}
      />
    ) : (
      <ellipse cx={x} cy="34" rx="3" ry="4" className={onMark ? 'vu-catpairs-coat' : 'vu-catpairs-eye'} />
    )
  const earMark = marking === 'points'
  const ears =
    extra === 'folded'
      ? ['11,27 20,15 30,19', '53,27 44,15 34,19']
      : ['11,27 15,5 30,19', '53,27 49,5 34,19']
  return (
    <svg className="vu-catpairs-cat" data-coat={cat.coat} viewBox="0 0 64 64" aria-hidden="true">
      <polygon
        points={ears[0]}
        className={earMark || marking === 'split' ? 'vu-catpairs-mark vu-catpairs-edge' : 'vu-catpairs-coat vu-catpairs-edge'}
      />
      <polygon
        points={ears[1]}
        className={earMark ? 'vu-catpairs-mark vu-catpairs-edge' : 'vu-catpairs-coat vu-catpairs-edge'}
      />
      <ellipse cx="32" cy="36" rx="22" ry="19" className="vu-catpairs-coat vu-catpairs-edge" />
      {marking === 'stripes' && (
        <path d="M32 18 v8 M25 19 l2 7 M39 19 l-2 7 M11 35 h6 M12 40 h5 M47 35 h6 M47 40 h5" className="vu-catpairs-stroke" />
      )}
      {marking === 'spots' && (
        <g className="vu-catpairs-mark">
          <circle cx="19" cy="27" r="3" />
          <circle cx="45" cy="28" r="3.5" />
          <circle cx="35" cy="22" r="2.5" />
          <circle cx="21" cy="46" r="2.5" />
          <circle cx="46" cy="44" r="2" />
        </g>
      )}
      {marking === 'patch' && <ellipse cx="23" cy="33" rx="8.5" ry="8" className="vu-catpairs-mark" />}
      {marking === 'blaze' && (
        <path d="M29 17.5 Q32 30 27 46 h10 Q32 30 35 17.5 Z" className="vu-catpairs-mark" />
      )}
      {marking === 'muzzle' && <ellipse cx="32" cy="45" rx="11" ry="8" className="vu-catpairs-mark" />}
      {marking === 'split' && <path d="M32 17 A22 19 0 0 0 32 55 Z" className="vu-catpairs-mark" />}
      {marking === 'mask' && <ellipse cx="32" cy="33" rx="18" ry="7.5" className="vu-catpairs-mark" />}
      {eye(23, leftOnMark, eyes === 'sleepy')}
      {eye(41, rightOnMark, eyes !== 'open')}
      {extra === 'tongue' && <ellipse cx="32" cy="48.5" rx="2.6" ry="3.2" className="vu-catpairs-mark" />}
      <path d="M29.5 41 h5 l-2.5 3 z" className="vu-catpairs-nose" />
      <path
        d="M32 44 q-3 4 -6 1 M32 44 q3 4 6 1"
        className={marking === 'muzzle' ? 'vu-catpairs-ink--coat' : 'vu-catpairs-ink'}
      />
      <path
        d={
          extra === 'whiskers'
            ? 'M13 42 L0 38 M13 45 L0 45 M13 48 L1 52 M51 42 L64 38 M51 45 L64 45 M51 48 L63 52'
            : 'M12 43 L4 41 M12 46 L4 48 M52 43 L60 41 M52 46 L60 48'
        }
        className="vu-catpairs-whisker"
      />
      {extra === 'bow' && <path d="M32 57 l-8 -4 v8 z M32 57 l8 -4 v8 z" className="vu-catpairs-bow" />}
    </svg>
  )
}

/** The back of a card: a paw print. */
function Paw(): JSX.Element {
  return (
    <svg className="vu-catpairs-paw" viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="26" rx="9" ry="7.5" />
      <ellipse cx="8" cy="17" rx="3.4" ry="4.4" />
      <ellipse cx="16" cy="10" rx="3.4" ry="4.6" />
      <ellipse cx="25" cy="10" rx="3.4" ry="4.6" />
      <ellipse cx="32.5" cy="17" rx="3.4" ry="4.4" />
    </svg>
  )
}

/**
 * Cat Pairs: the café's cats two to a deck, face down in a grid. Whoever's turn it is turns two;
 * a pair is kept and earns another go, anything else is turned back and the turn passes, the
 * reader first and the girls after him in the order they sit. Now and then a café cat crosses
 * the table and two face-down cards trade places in plain sight. Each girl plays from what she
 * remembers, at her skill. Alone it is the same table, counted in turns. The table shows every
 * move, whose turn it is, the count and how it came out; the dialogue box tells the moves only
 * where play-by-play is on.
 */
export function CatPairs({ play }: { play: GamePlay }): JSX.Element {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const several = girls.length > 1
  const seated = girls.length > 0
  const pairs = play.options.pairs ?? PAIRS
  const withCat = (play.options.cats ?? 1) === 1
  // Read at his own pace with every turn on the box, the table waits on its lines. With the turns
  // kept off the box a line is only a short beat, so the table keeps its own time instead.
  const paced = play.stepped && play.playByPlay
  // The cards are laid once.
  const [game, setGame] = useState<Game>(() => newGame(girls.length + 1, pairs, withCat))
  // The cards lying face up this turn, in the order they were turned.
  const [up, setUp] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('pick')
  // The two places a cat is swapping, while it crosses.
  const [swap, setSwap] = useState<[number, number] | null>(null)
  // One of them is saying something about the last turn: the table waits for it, a little.
  const [speaking, setSpeaking] = useState(false)
  // What each girl remembers of the table.
  const memories = useRef<Memory[]>(girls.map(() => []))
  const remarks = useRef(0)
  // How often each girl has had the word, so that it goes round.
  const spoken = useRef<number[]>(girls.map(() => 0))
  // The framework may clear the table at any moment; nothing is set on one that is gone.
  const live = useRef(true)
  // The game has been handed back: nothing more is said or played.
  const finished = useRef(false)
  const begun = useRef(false)
  // Which remark the table is waiting on, and the timer that ends the wait.
  const awaited = useRef(0)
  // Her line is still being written or shown, however long the table waited: no other is asked for.
  const saying = useRef(false)
  const sayCap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // When the two cards now face up were turned.
  const shownAt = useRef(0)
  // Read at the reader's pace: a miss left face up for him, until he turns his next card.
  const [held, setHeld] = useState<number[]>([])
  // Read at the reader's pace: the short wait on a remark being written, and what ends it.
  const hold = useRef<Promise<void>>(Promise.resolve())
  const freed = useRef<(() => void) | undefined>(undefined)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      clearTimeout(sayCap.current)
    }
  }, [])

  const counts = pairCounts(game)
  const left = faceDown(game).length / 2
  const myTurn = phase === 'pick' && game.turn === 0
  const cols = colsFor(game.cards.length)
  const card = cardSize(cols)
  // How far it is from one place to the next, along a row and down a column.
  const stepX = card.w + GAP
  const stepY = card.h + GAP

  // With girls at the table the game is on from the moment they sit down, and says so.
  useEffect(() => {
    if (!seated) return
    // On the next tick, so a mount that is at once undone and redone says it once.
    const timer = setTimeout(() => {
      play.narrate(
        `${names[0]} lays out ${pairs} pairs of the café's cats face down${several ? ` for ${listed(['you', ...names.slice(1), 'herself'])}` : ''}. Two cards a turn, a pair earns another go, and you turn first.${withCat ? ' The café cats are loose, so watch the table.' : ''}`
      )
    }, 0)
    return () => clearTimeout(timer)
    // Once, as the table opens.
  }, [])

  /**
   * Has one of the girls say something about the turn just taken, where it is worth it: a
   * blind guess that came in, a card forgotten, a cat spoiling a plan, three pairs in a row, or
   * the table coming down to its last pair. A few times a game between them all, one voice a
   * turn, and never on the last turn. She speaks for her own turn; for the reader's it is
   * whoever has spoken least.
   */
  function remark(now: Game): void {
    if (!seated || saying.current || remarks.current >= REMARKS[play.chattiness]) return
    const made = turnsMade(now).at(-1)
    if (!made) return
    const told = turnTold(names, made)
    const lastPair = faceDown(now).length === 2
    // Talkative, they have a word for an ordinary turn too.
    if (!told.notable && !lastPair && play.chattiness !== 'lots') return
    remarks.current++
    const by =
      made.seat > 0
        ? made.seat - 1
        : spoken.current.reduce((least, count, i) => (count < spoken.current[least] ? i : least), 0)
    spoken.current[by]++
    const cue = `${told.line} The count of pairs is ${countLine('the reader', names, pairCounts(now))}.${lastPair ? ' Only one pair is left on the table.' : ''}`
    // The table waits for her line, but not for long: a slow one lands over the next turn.
    const mine = ++awaited.current
    const release = (): void => {
      if (!live.current || awaited.current !== mine) return
      awaited.current++
      clearTimeout(sayCap.current)
      setSpeaking(false)
      freed.current?.()
    }
    if (paced) {
      hold.current = new Promise((resolve) => {
        freed.current = resolve
      })
    }
    setSpeaking(true)
    clearTimeout(sayCap.current)
    sayCap.current = setTimeout(release, SAY_WAIT_MS)
    saying.current = true
    const said = (): void => {
      saying.current = false
      release()
    }
    void Promise.resolve()
      .then(() => play.say(girls[by].charId, cue))
      .then(said, said)
  }

  /** The table is gone or the game handed back: whatever was waiting on a line does nothing more. */
  const gone = (): boolean => !live.current || finished.current

  /** The last pair is taken: the game is handed back, once. */
  function end(now: Game): void {
    setPhase('over')
    finished.current = true
    const final = pairCounts(now)
    const result = {
      outcome: seated ? gameOutcome(final) : ('played' as const),
      summary: gameSummary(names, final, now.turns),
      account: gameAccount(names, now, withCat)
    }
    // Told on the box, the last turn has had its time there; otherwise the table holds it.
    if (play.playByPlay) play.finish(result)
    else
      setTimeout(() => {
        if (live.current) play.finish(result)
      }, LAST_PAIR_MS)
  }

  /**
   * At the reader's pace, a girl's turn from the table as it stands at `from`: it begins once he
   * has moved past everything said so far, so a miss before hers lies face up until he has read
   * it. Her two cards are turned a beat apart and the turn is said in one line.
   */
  async function herTurn(from: Game): Promise<void> {
    const seat = from.turn - 1
    const first = herFirst(from, memories.current[seat] ?? [])
    await play.read()
    if (gone()) return
    memories.current = memories.current.map((memory, i) =>
      observe(memory, first, from.cards[first], girls[i].skill)
    )
    setHeld([])
    setUp([first])
    const second = herSecond(from, memories.current[seat] ?? [], first, girls[seat].skill)
    const now = playTurn(from, first, second)
    const made = turnsMade(now).at(-1)!
    const over = isOver(now)
    await new Promise((resolve) => setTimeout(resolve, HER_BEAT_MS))
    if (gone()) return
    play.narrate(
      `${turnLine(names[seat], made)}${!over && made.run > 0 ? ` ${countLine('You', names, pairCounts(now))}.` : ''}`
    )
    memories.current = memories.current.map((memory, i) =>
      observe(memory, second, from.cards[second], girls[i].skill)
    )
    if (made.run > 0) {
      memories.current = memories.current.map((memory) => cleared(memory, [first, second]))
    }
    setUp([first, second])
    setGame(now)
    if (over) {
      end(now)
      return
    }
    setPhase('show')
    await settled(now, made.run > 0, [first, second])
  }

  /**
   * At the reader's pace, what follows a turn whose line has been said: nothing here keeps time
   * for reading. His own turn is his at once, with a miss left face up until he turns a card;
   * a girl's turn and a cat's crossing begin only once he has moved past this one.
   */
  async function settled(now: Game, pair: boolean, cards: [number, number]): Promise<void> {
    remark(now)
    if (pair || !catDue(now)) {
      if (now.turn === 0) {
        setHeld(pair ? [] : cards)
        setUp([])
        setPhase('pick')
        return
      }
      await hold.current
      if (gone()) return
      if (pair) setUp([])
      setPhase('pick')
      await herTurn(now)
      return
    }
    await hold.current
    if (gone()) return
    await play.narrate(CAT_LINE)
    if (gone()) return
    const [a, b] = catPick(now)
    setUp([])
    setSwap([a, b])
    setPhase('cat')
    await new Promise((resolve) => setTimeout(resolve, CAT_MS))
    if (gone()) return
    memories.current = memories.current.map((memory, i) => catMoved(memory, a, b, girls[i].skill))
    const next = catSwap(now, a, b)
    setGame(next)
    setSwap(null)
    setPhase('pick')
    if (next.turn !== 0) await herTurn(next)
  }

  /** The player whose turn it is turns the card at `at`: the first of two, or the one that settles the turn. */
  function flip(at: number): void {
    if (finished.current || !live.current) return
    // At his own pace, a press on any card while a turn lies shown is him moving on, and no more.
    if (paced && phase === 'show') {
      play.moved()
      return
    }
    if (phase !== 'pick') return
    if (game.taken[at] !== null || up.includes(at) || up.length > 1) return
    // His own move, by press or by key, is him moving on from what was on the box.
    if (game.turn === 0) play.moved()
    if (held.length > 0) setHeld([])
    // Everyone at the table sees the card.
    memories.current = memories.current.map((memory, i) =>
      observe(memory, at, game.cards[at], girls[i].skill)
    )
    if (!begun.current) {
      begun.current = true
      play.started()
    }
    if (up.length === 0) {
      setUp([at])
      return
    }
    const [first] = up
    const who = game.turn === 0 ? 'You' : names[game.turn - 1]
    const now = playTurn(game, first, at)
    const made = turnsMade(now).at(-1)!
    if (made.run > 0) {
      memories.current = memories.current.map((memory) => cleared(memory, [first, at]))
    }
    shownAt.current = performance.now()
    setUp([first, at])
    setGame(now)
    if (!isOver(now)) {
      play.narrate(
        `${turnLine(who, made)}${seated && made.run > 0 ? ` ${countLine('You', names, pairCounts(now))}.` : ''}`
      )
      setPhase('show')
      if (paced) void settled(now, made.run > 0, [first, at])
      else remark(now)
      return
    }
    play.narrate(turnLine(who, made))
    end(now)
  }

  // How the game stands, for anything said at the table.
  useEffect(() => {
    if (!seated) return
    play.situation(
      [
        `The game is Cat Pairs, a memory game with ${pairs} pairs of café cats face down, between the reader${several ? `, ${listed(names)}` : ` and ${names[0]}`}${withCat ? ', with a café cat that now and then swaps two face-down cards' : ''}.`,
        `The count of pairs is ${countLine('the reader', names, counts)}, with ${left} still on the table.`,
        phase === 'over'
          ? 'The last pair has just been taken.'
          : phase === 'cat'
            ? 'A café cat is walking across the table and moving two cards.'
            : `It is ${game.turn === 0 ? "the reader's" : `${names[game.turn - 1]}'s`} turn.`,
        ...(play.stake ? [`Riding on it: ${play.stake}`] : [])
      ].join(' ')
    )
  })

  // A girl's turn, a card at a time after a beat: from what she remembers, at her skill.
  useEffect(() => {
    if (paced || phase !== 'pick' || speaking || game.turn === 0) return
    const timer = setTimeout(() => {
      const at = game.turn - 1
      const memory = memories.current[at] ?? []
      flip(
        up.length === 0
          ? herFirst(game, memory)
          : herSecond(game, memory, up[0], girls[at].skill)
      )
    }, several ? GIRLS_PAUSE_MS : HER_PAUSE_MS)
    return () => clearTimeout(timer)
    // Each card turned changes what is face up, and each turn settled changes the table.
  }, [phase, speaking, game, up])

  // Two cards lie face up: after a look a pair is left as taken and a miss is turned back, and
  // where a cat is due it comes now, with every card face down.
  useEffect(() => {
    if (paced || phase !== 'show' || speaking) return
    const pair = (turnsMade(game).at(-1)?.run ?? 0) > 0
    // Counted from when the cards were turned, so time spent waiting on her line is not added to.
    const lain = performance.now() - shownAt.current
    const timer = setTimeout(() => {
      if (finished.current) return
      setUp([])
      if (!pair && catDue(game)) {
        play.narrate(CAT_LINE)
        setSwap(catPick(game))
        setPhase('cat')
        return
      }
      setPhase('pick')
    }, Math.max((pair ? PAIR_MS : MISS_MS) - lain, AFTER_REMARK_MS))
    return () => clearTimeout(timer)
  }, [phase, speaking, game])

  // The cat's crossing: the two cards are seen to trade places, and then they have.
  useEffect(() => {
    if (paced || phase !== 'cat' || !swap) return
    const [a, b] = swap
    const timer = setTimeout(() => {
      if (finished.current) return
      memories.current = memories.current.map((memory, i) => catMoved(memory, a, b, girls[i].skill))
      setGame(catSwap(game, a, b))
      setSwap(null)
      setPhase('pick')
    }, CAT_MS)
    return () => clearTimeout(timer)
  }, [phase, swap])

  /** How far the card at `at` travels while a cat swaps it, in pixels. */
  function travel(at: number): { x: number; y: number } {
    if (!swap || !swap.includes(at)) return { x: 0, y: 0 }
    const to = swap[0] === at ? swap[1] : swap[0]
    return {
      x: ((to % cols) - (at % cols)) * stepX,
      y: (Math.floor(to / cols) - Math.floor(at / cols)) * stepY
    }
  }

  const owner = (seat: number): string => (seat === 0 ? 'you' : names[seat - 1])
  /** How the game came out, as the table shows it once it is over: "you win", "Ana wins", "level". */
  const outcomeWord = (): string => {
    const outcome = gameOutcome(counts)
    if (outcome === 'won') return 'you win'
    if (outcome === 'draw') return 'level'
    const top = Math.max(...counts)
    const leaders = names.filter((_, i) => counts[i + 1] === top)
    return leaders.length === 1 ? `${leaders[0]} wins` : `${listed(leaders)} share it`
  }
  return (
    <div className="vu-catpairs">
      <div className="vu-catpairs-grid" style={
          {
            '--vu-catpairs-cols': cols,
            '--vu-catpairs-w': `${card.w}px`,
            '--vu-catpairs-h': `${card.h}px`,
            '--vu-catpairs-gap': `${GAP}px`
          } as CSSProperties
        }>
        {game.cards.map((cat, at) => {
          const takenBy = game.taken[at]
          const faceUp = takenBy !== null || up.includes(at) || held.includes(at)
          // A miss left lying for him to read is turned back by his next card, which may be one of the two.
          // While a turn lies shown at his pace every card takes a press, as his way on.
          const dead = !(paced && phase === 'show') && (!myTurn || takenBy !== null || up.includes(at))
          const moving = swap?.includes(at) ?? false
          return (
            // The swap moves this wrapper; the card inside keeps its own gestures.
            <motion.div
              key={at}
              className="vu-catpairs-place"
              data-swapping={moving || undefined}
              animate={travel(at)}
              // A card goes to its new place in view; once the swap is made it is simply there.
              transition={moving ? { duration: 1.1, ease: 'easeInOut', delay: 0.3 } : { duration: 0 }}
            >
              <motion.button
                type="button"
                className="vu-catpairs-card"
                data-up={faceUp || undefined}
                data-taken={takenBy !== null || undefined}
                data-mine={takenBy === 0 || undefined}
                disabled={dead}
                aria-label={
                  faceUp
                    ? `${CAFE_CATS[cat].name}${takenBy !== null ? `, taken by ${owner(takenBy)}` : ''}`
                    : `card ${at + 1}, face down`
                }
                {...gestures(dead, toggleLift, quietPress)}
                onClick={() => flip(at)}
              >
                {/* Keyed on which side is up, so a card turned lands as a new one. */}
                <motion.span
                  key={faceUp ? 'face' : 'back'}
                  className={faceUp ? 'vu-catpairs-face' : 'vu-catpairs-back'}
                  initial={{ opacity: 0, rotateY: 80 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {faceUp ? (
                    <>
                      <CatFace cat={CAFE_CATS[cat]} />
                      <span className="vu-catpairs-catname">{CAFE_CATS[cat].name}</span>
                      {takenBy !== null && seated && (
                        <span className="vu-catpairs-owner">{owner(takenBy)}</span>
                      )}
                    </>
                  ) : (
                    <Paw />
                  )}
                </motion.span>
              </motion.button>
            </motion.div>
          )
        })}
        {/* The café cat itself, crossing the row of the first card it moves. */}
        {swap && (
          <motion.span
            className="vu-catpairs-walker"
            aria-hidden="true"
            style={{ top: Math.floor(swap[0] / cols) * stepY + (card.h - 44) / 2 }}
            initial={{ left: '-6%', opacity: 0 }}
            animate={{ left: '98%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: CAT_MS / 1000, ease: 'linear' }}
          >
            🐈
          </motion.span>
        )}
      </div>

      <p className="vu-catpairs-count">
        {seated ? (
          ['you', ...names].map((name, seat) => (
            <span
              key={seat}
              className="vu-catpairs-seat"
              data-turn={(phase !== 'over' && phase !== 'cat' && game.turn === seat) || undefined}
            >
              {`${name} ${counts[seat]}`}
            </span>
          ))
        ) : (
          <span className="vu-catpairs-seat">{`${counts[0]} of ${pairs} pairs`}</span>
        )}
        <span className="vu-catpairs-round">
          {phase === 'over'
            ? `game over · ${game.turns} turns${seated ? ` · ${outcomeWord()}` : ''}`
            : phase === 'cat'
              ? 'a cat on the table'
              : seated
                ? game.turn === 0
                  ? 'your turn'
                  : `${names[game.turn - 1]}'s turn`
                : `turn ${game.turns + 1}`}
        </span>
      </p>
    </div>
  )
}
