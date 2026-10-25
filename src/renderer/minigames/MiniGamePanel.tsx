import { pendingTraining } from './training'
import { writeAutosave } from '../stores/loop/saves'
import { gameById } from './prefs'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import {
  aidsOf,
  CHAT_OPTIONS,
  defaultOptions,
  groupsFor,
  listed,
  MINI_GAMES,
  playersWords,
  settledOptions,
  type Chattiness,
  type MiniGameDef
} from '@shared/minigames'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import type { ScenePanelProps } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
import { TurnField } from '../views/Dialogue'
import { SceneDivider } from '../views/SceneChrome'
import { useTableInputLayout } from './inputLayout'
import { useModOption } from '../stores/modsStore'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  veilIn
} from '../views/motion'
import { gameComponent, type GamePlay, type Opponent, type PlayResult } from './play'
import { agreementAvailable, checkpointResult, keptAgreed, useTableStore, type Agreed } from './session'
import { tableRound } from './round'
import { skillOf } from './skill'
import {
  closeTable,
  compactTable,
  fileResult,
  nameOf,
  holdForReader,
  moveAtTable,
  narrateAtTable,
  openTable,
  readerPlaysAtTable,
  readerSaysAtTable,
  sayAtTable,
  speakAtTable,
  stepTable,
  tableQuietIn,
  tableRead,
  useStepStore,
  proposeGame,
  takeTurnForGame,
  useGamesOffered,
  usePresentGirls
} from './table'
import { noteFault } from './faults'
import { GameGuard } from './GameGuard'
import { ReportButton } from './ReportButton'
import { useScenePlace } from './place'
import '../vu_styles/MiniGames.css'

/** One thing the table can be opened for: a game alone, or one a girl or several are asked to play. */
interface Offer {
  game: MiniGameDef
  /** The girls to ask; none for a game played alone. */
  charIds: string[]
}

/** One way of playing a game, as its row says it. */
function wayWords(offer: Offer): string {
  return offer.charIds.length > 0 ? `Ask ${namesOf(offer.charIds)} to play` : 'Play alone'
}

/** What the reader calls the girls asked, in a row. */
function namesOf(charIds: readonly string[]): string {
  return listed(charIds.map(nameOf))
}

/** A game being played: against whom, and for what. */
export interface Sitting {
  game: MiniGameDef
  /** Null while a girl's skill is still being judged. */
  opponents: Opponent[] | null
  stake: string
  options: Record<string, number>
}

/** How long a finished game stands on the table before it is cleared. */
const RESULT_BEAT_MS = 1800

/** Nobody at the table but the reader. */
const NO_ONE: Opponent[] = []

/**
 * The sitting a game she agreed to opens on, her skill still to come. What was agreed is read
 * against the game as it is set now: an option agreed under a wider content setting, then kept
 * across a reload while the setting was turned back, falls to the game's default rather than
 * opening the table past what the player allows.
 */
export function sittingOf(agreed: Agreed | null): Sitting | null {
  const game = agreed && gameById(agreed.gameId)
  return game
    ? { game, opponents: null, stake: agreed.stake, options: settledOptions(game, agreed.options) }
    : null
}

/**
 * The framework's place over a scene, in two shapes.
 *
 * Choosing is a panel: opened from the rail it lists what can be played, and a game with a girl
 * is asked for in the reader's own words, as his turn in the scene.
 *
 * Playing is not: the scene stays lit and the game is drawn on its surface in the middle of it,
 * the girls still standing either side and the dialogue box still the scene's, saying what the
 * game narrates. The framework owns the way out. Before the first move it is free, and the reply
 * being read is left as it was; once a game is under way, leaving is walking away from it and is
 * said in the scene; once it is over, the table clears itself after a beat and the result goes
 * into the scene.
 */
export function MiniGamePanel({ theme, onClose }: ScenePanelProps): JSX.Element | null {
  const training = pendingTraining()
  useEffect(() => {
    useTableStore.setState({ active: true })
    return () => { useTableStore.setState({ active: false }) }
  }, [])
  const offered = useGamesOffered()
  const girls = usePresentGirls()
  // How much she says for herself, as the player has it in the Mods screen.
  const quiet = useModOption(MINI_GAMES, CHAT_OPTIONS.quiet)
  const lots = useModOption(MINI_GAMES, CHAT_OPTIONS.lots)
  const chattiness: Chattiness = quiet ? 'quiet' : lots ? 'lots' : 'some'
  const location = useScenePlace()
  // Who is standing where on the stage: left, middle, right.
  const slots = useGameStore((s) => s.slots)
  // The game she agreed to, taken off the table's own state as the panel opens on it.
  const [agreed] = useState(() => {
    const due = useTableStore.getState().agreed ?? keptAgreed()
    return due && agreementAvailable(due, location, offered) ? due : null
  })
  useEffect(() => {
    if (agreed) useTableStore.getState().dropAgreed()
  }, [agreed])

  const offers = useMemo<Offer[]>(
    () =>
      offered.flatMap((game) => [
        ...(game.players.max >= 1 && game.players.min <= 1
          ? girls.map((charId): Offer => ({ game, charIds: [charId] }))
          : []),
        ...groupsFor(game, girls).map((charIds): Offer => ({ game, charIds })),
        ...(game.players.min === 0 ? [{ game, charIds: [] }] : [])
      ]),
    [offered, girls]
  )

  // The list is a game to a row; one opened shows who can be asked to play it.
  const byGame = useMemo(
    () =>
      offered.map((game) => ({ game, ways: offers.filter((offer) => offer.game.id === game.id) })),
    [offered, offers]
  )
  const [openGame, setOpenGame] = useState<string | null>(training?.id ?? null)

  const [sitting, setSitting] = useState<Sitting | null>(() => sittingOf(agreed))
  const [asking, setAsking] = useState<Offer | null>(null)
  const [words, setWords] = useState('')
  // An agreed game is under way from the moment the table opens: she is sitting at it.
  const [underWay, setUnderWay] = useState(agreed !== null)
  const [result, setResult] = useState<PlayResult | null>(null)
  const [trainingFault, setTrainingFault] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // The one thing on offer, alone, is the game: nothing to pick.
  const only = offers.length === 1 && offers[0].charIds.length === 0 ? offers[0].game : null
  const seated = useMemo<Sitting | null>(
    () =>
      sitting ??
      (only ? { game: only, opponents: NO_ONE, stake: '', options: defaultOptions(only) } : null),
    [sitting, only]
  )
  const Game = seated ? gameComponent(seated.game.id) : undefined
  useEffect(() => {
    if (!seated || seated.opponents === null) return
    useTableStore.getState().setAgreed({ gameId: seated.game.id,
      charIds: seated.opponents.map(girl => girl.charId), location,
      stake: seated.stake, options: seated.options })
    useTableStore.getState().dropAgreed()
    void writeAutosave(useGameStore.getState().captureScene())
  }, [seated?.game.id, seated?.opponents, seated?.options, seated?.stake, location])

  // Her skill, judged when she agreed and ready by now more often than not.
  useEffect(() => {
    if (!agreed) return
    const game = gameById(agreed.gameId)
    const characters = agreed.charIds
      .map((charId) => useGameStore.getState().characters[charId])
      .filter((character) => character !== undefined)
    if (!game) return
    if (characters.length === 0) {
      setSitting(now => now ? { ...now, opponents: NO_ONE } : now)
      return
    }
    let live = true
    void Promise.all(
      characters.map(async (character): Promise<Opponent> => {
        const skill = await skillOf(character, game)
        return {
          charId: character.charId,
          name: nameOf(character.charId),
          skill: skill.level,
          style: skill.style,
          biases: skill.biases
        }
      })
    ).then((opponents) => {
      if (live) setSitting((now) => (now ? { ...now, opponents } : now))
    })
    return () => {
      live = false
    }
  }, [agreed])

  // Nothing to play: the mod was switched off, or the scene moved on.
  const nothing = !seated && offers.length === 0
  useEffect(() => {
    if (nothing) onClose()
  }, [nothing, onClose])

  /** Closes a table before its first move, letting go of the match kept for a reload. */
  function standUp(): void {
    useTableStore.getState().setAgreed(null)
    onClose()
  }

  /** Escape and a click outside leave only a table nothing is at stake on. */
  const dismiss = (): void => {
    if (!underWay && !result) {
      if (training && offered[0]) fileResult({ outcome: 'abandoned', summary: 'You leave the training session before completing it.' }, { game: offered[0], names: [], stake: '' })
      standUp()
    }
  }
  const { host, overlayProps } = useModalShell(dismiss)

  // The first move is the reader's turn taken, once: what the reply had left to say is dropped.
  const begun = useRef(false)
  function begin(): void {
    if (begun.current) return
    begun.current = true
    takeTurnForGame()
    openTable(Boolean(seated?.game.stepped))
    setUnderWay(true)
  }

  // How the game stands, as the game last said it: what she is reminded of when she speaks.
  const situation = useRef('')
  // What the game has said the scene should know of it so far, for a game walked away from.
  const soFar = useRef<readonly string[]>([])
  // A table taken down mid-game, by anything, says nothing more.
  useEffect(() => closeTable, [])

  // What the reader says at the table, whenever he likes. The game is not held for it; one
  // remark is out at a time, so her answers come back in the order he spoke.
  const [remark, setRemark] = useState('')
  // Who is answering him, by what he calls her; null with nobody answering.
  const [answering, setAnswering] = useState<string | null>(null)
  // With several at the table, whose turn it is to answer a remark that names nobody.
  const turnToAnswer = useRef(0)
  /** How the game stands as one girl is told it: the game's own words, and who else is playing. */
  function situationFor(charId: string): string {
    const others = (seated?.opponents ?? []).filter((girl) => girl.charId !== charId)
    return others.length === 0
      ? situation.current
      : `${situation.current} Also playing: ${listed(others.map((girl) => girl.name))}.`
  }
  // What the game has asked the reader to type, while it waits for it.
  const [asked, setAsked] = useState<{ placeholder: string } | null>(null)
  const inputRow = useRef<HTMLDivElement>(null)
  const [inputHover, setInputHover] = useState(false)
  const [inputPinned, setInputPinned] = useState(false)
  const [inputHeight, setInputHeight] = useState(70)
  const requiredInput = Boolean(seated?.game.typed || asked)
  const ownsInput = Boolean(host && seated && Game)
  const hasInput = Boolean(host && seated && Game && (seated.opponents?.length || asked))
  const inputOpen = requiredInput || inputHover || inputPinned
  const currentLine = useGameStore((state) => state.currentLine)

  function putChatAway(): void {
    setInputHover(false)
    setInputPinned(false)
    const field = inputRow.current?.querySelector('textarea, input')
    if (field instanceof HTMLElement && document.activeElement === field) field.blur()
  }

  // Release the old answer's focus when the game gives the field back to optional chat.
  useLayoutEffect(() => {
    if (!requiredInput) putChatAway()
  }, [requiredInput])

  // New dialogue ends a hover-only peek, but never interrupts a draft with the caret in it.
  useLayoutEffect(() => {
    if (!requiredInput && !inputPinned) setInputHover(false)
  }, [currentLine])

  useLayoutEffect(() => {
    const row = inputRow.current
    if (!hasInput || !row) return
    const measure = (): void => setInputHeight(row.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [hasInput])

  useLayoutEffect(() => {
    // Even solo games without a chat row own the input: the scene's action field must
    // not remain visible or focused behind the running game.
    useTableInputLayout.getState().setLayout(ownsInput ? { open: hasInput && inputOpen, height: hasInput ? inputHeight : 70 } : null)
  }, [ownsInput, hasInput, inputOpen, inputHeight])
  useLayoutEffect(() => () => useTableInputLayout.getState().setLayout(null), [])
  const answerTo = useRef<((text: string | null) => void) | null>(null)
  /** Ends whatever is being asked, unanswered. */
  function endAsking(): void {
    const resolve = answerTo.current
    answerTo.current = null
    setAsked(null)
    resolve?.(null)
  }
  // A table taken down leaves no game waiting on an answer that cannot come.
  useEffect(
    () => () => {
      answerTo.current?.(null)
      answerTo.current = null
    },
    []
  )

  // Something is waiting on the reader to step past the line on the box.
  const waiting = useStepStore((s) => s.waiting)
  useEffect(() => {
    if (!waiting) return
    // Space and Enter step on, as they do through a scene's own lines; a field keeps its keys,
    // and a button under focus answers for itself.
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, button, [contenteditable="true"]')) return
      event.preventDefault()
      event.stopPropagation()
      stepTable()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [waiting])

  function speak(): void {
    // What the game asked for is the game's, not a word across the table.
    if (answerTo.current) {
      const text = remark.trim()
      if (!text || result) return
      // Answering is moving on: the line he answered needs no step of its own.
      stepTable()
      const resolve = answerTo.current
      answerTo.current = null
      setAsked(null)
      setRemark('')
      resolve(text)
      return
    }
    if (seated?.game.typed) return
    const table = seated?.opponents ?? []
    if (table.length === 0 || answering !== null || !remark.trim() || result) return
    // The girl he names answers; where he names nobody, they take it in turns.
    const said = remark.toLowerCase()
    const her =
      table.find((girl) => girl.name !== 'her' && said.includes(girl.name.toLowerCase())) ??
      table[turnToAnswer.current++ % table.length]
    begin()
    const words = remark
    setRemark('')
    putChatAway()
    setAnswering(her.name)
    void readerSaysAtTable(her.charId, situationFor(her.charId), words).finally(() =>
      setAnswering(null)
    )
  }

  const play = useMemo<GamePlay>(
    () => ({
      opponents: seated?.opponents ?? [],
      location,
      stepped: Boolean(seated?.game.stepped),
      aids: seated ? aidsOf(seated.game) : {},
      moved: () => stepTable(),
      read: () => (seated?.game.stepped ? tableRead() : Promise.resolve()),
      stake: seated?.stake ?? '',
      chattiness,
      options: seated?.options ?? {},
      started: () => begin(),
      playByPlay: Boolean(seated?.game.playByPlay),
      narrate: (text) => {
        begin()
        return seated?.game.playByPlay ? narrateAtTable(text) : moveAtTable()
      },
      say: (charId, cue) => {
        begin()
        return sayAtTable(charId, situationFor(charId), cue)
      },
      speak: (charId, text, expression) => {
        begin()
        return speakAtTable(charId, text, expression)
      },
      readerSays: (text) => {
        begin()
        readerPlaysAtTable(text)
      },
      round: (ask) => {
        begin()
        const characters = useGameStore.getState().characters
        const players = (seated?.opponents ?? [])
          .map((girl) => characters[girl.charId])
          .filter((character) => character !== undefined)
        return tableRound(
          seated?.game.name ?? '',
          players,
          situation.current,
          seated?.stake ?? '',
          ask
        )
      },
      situation: (text) => {
        situation.current = text
      },
      ask: (placeholder) => {
        begin()
        answerTo.current?.(null)
        return new Promise<string | null>((resolve) => {
          answerTo.current = resolve
          setAsked({ placeholder })
        })
      },
      stopAsking: () => endAsking(),
      progress: (account) => {
        soFar.current = account
      },
      finish: (ended) => {
        checkpointResult(ended, seated?.opponents?.map(girl => girl.name) ?? [])
        void writeAutosave(useGameStore.getState().captureScene())
        setResult(ended)
      }
    }),
    [seated?.game.name, seated?.game.stepped, seated?.game.playByPlay, seated?.opponents, seated?.stake, seated?.options, chattiness, location]
  )

  function leave(ended: PlayResult): void {
    if (training && ended.outcome === 'broken') {
      closeTable()
      compactTable()
      setResult(null)
      setTrainingFault(true)
      return
    }
    closeTable()
    compactTable()
    if (!seated) return
    // Whoever sat down, judged yet or not: she was at the table either way.
    const names = seated.opponents?.map((opponent) => opponent.name) ?? (agreed?.charIds ?? []).map(nameOf)
    fileResult(ended, { game: seated.game, names, stake: seated.stake })
    onClose()
  }

  // A finished game stands for a beat, then clears itself: there is nothing to answer.
  useEffect(() => {
    if (!result) return
    // After whatever the table is still saying has been read: by its own time, or, at a table
    // read at the reader's pace, once he has stepped past the last of it.
    if (seated?.game.stepped) {
      let live = true
      holdForReader()
      void tableRead().then(() => {
        if (live) leave(result)
      })
      return () => {
        live = false
      }
    }
    const timer = setTimeout(() => leave(result), tableQuietIn() + RESULT_BEAT_MS)
    return () => clearTimeout(timer)
    // The result is set once, and what `leave` reads has settled by then.
  }, [result])

  function pick(offer: Offer): void {
    if (offer.charIds.length === 0) {
      setSitting({ game: offer.game, opponents: NO_ONE, stake: '', options: defaultOptions(offer.game) })
      return
    }
    setWords(
      `I ask ${namesOf(offer.charIds)} if ${offer.charIds.length > 1 ? 'they want' : 'she wants'} to play a game of ${offer.game.name}.`
    )
    setAsking(offer)
  }

  function ask(): void {
    if (!asking || !words.trim()) return
    const { game, charIds } = asking
    onClose()
    proposeGame(game.id, charIds, words)
  }

  if (!host || nothing) return null

  const title = asking ? `Ask ${namesOf(asking.charIds)}` : 'Play a game'
  const against = seated?.opponents?.[0]
  /** Everyone at the table, judged yet or not, as the reader calls them. */
  const tableNames =
    seated?.opponents?.map((girl) => girl.name) ?? (agreed?.charIds ?? []).map(nameOf)

  /**
   * Where a table hangs so it covers nobody who matters. One girl alone stands in the middle, so
   * it goes beside her. Two stand either side of the middle, which is free. Three leave no room:
   * it hangs over one who is not playing, the middle one unless she is the one at the table.
   */
  const onStage = slots.filter(Boolean).length
  const playing = seated?.opponents?.map((girl) => girl.charId) ?? agreed?.charIds ?? []
  // With all three at the table there is nobody to spare, and it keeps the middle.
  const aside =
    (seated?.game.surface ?? 'table') === 'table' &&
    (onStage === 1 ||
      (onStage >= 3 && playing.length < onStage && playing.includes(slots[1] ?? '')))

  if (seated && Game) {
    // Keyed apart from the list, so a game picked there mounts its own table rather than taking
    // over the list's elements mid-animation, which left the table drawn at no opacity.
    return createPortal(
      <motion.div
        key="table"
        data-game={seated.game.id}
        className={`vu-veil vu-minigame-veil${aside ? ' vu-minigame-veil--aside' : ''}`}
        data-theme={theme}
        style={{ '--minigame-turn-h': `${hasInput ? inputHeight : 70}px` } as CSSProperties}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        {...overlayProps}
        // A click on the scene around the table steps on, as a click through a scene's lines does.
        onClick={(event) => {
          if (waiting && event.target === event.currentTarget) stepTable()
        }}
      >
        <motion.div
          id="minigame-table"
          className={`vu-minigame-surface vu-minigame-surface--${seated.game.surface ?? 'table'} vu-paper`}
          role="dialog"
          aria-modal="true"
          aria-label={seated.game.name}
          // A move of his own in the game is moving on too.
          onPointerDownCapture={() => stepTable()}
          initial={{ y: -18, scale: 0.96 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <p className="vu-minigame-name">{seated.game.name}</p>
          {trainingFault ? (
            <div className="vu-empty" role="alert">
              <p>The game could not continue. Retry this training session or end it without a reward.</p>
              <button className="vu-btn vu-btn--primary vu-paper" onClick={() => {
                begun.current = false
                soFar.current = []
                situation.current = ''
                setUnderWay(false)
                setAttempt(n => n + 1)
                setTrainingFault(false)
              }}>Retry training</button>
              <button className="vu-btn vu-paper" onClick={() => leave({ outcome: 'abandoned', summary: 'You end the training session after a technical problem, without completing it.' })}>End session</button>
            </div>
          ) : seated.opponents ? (
            <GameGuard key={attempt}
              onFault={(error) => {
                noteFault(seated.game.id, error)
                if (result) return
                if (!underWay && !training) {
                  standUp()
                  return
                }
                leave({
                  outcome: 'broken',
                  summary: `The game of ${seated.game.name}${
                    tableNames.length > 0 ? ` with ${listed(tableNames)}` : ''
                  } breaks off before it is over.`,
                  ...(soFar.current.length > 0
                    ? { account: soFar.current }
                    : situation.current
                      ? { account: [`How it stood when it broke off: ${situation.current}`] }
                      : {})
                })
              }}
            >
              <Game play={play} />
            </GameGuard>
          ) : (
            <p className="vu-empty">
              {tableNames.length > 1 ? 'They are getting settled…' : 'She is getting settled…'}
            </p>
          )}
          {/* The way on, at a table read at the reader's own pace, while something waits on it. */}
          {seated.game.stepped && (
            <motion.button
              id="minigame-next"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel vu-minigame-next"
              type="button"
              disabled={!waiting}
              {...gestures(!waiting, lift, press)}
              onClick={() => stepTable()}
            >
              Continue
            </motion.button>
          )}
          <div className="vu-minigame-foot">
            {/* Standing through the result's beat, dead, so the table does not jump as it ends. */}
            <motion.button
              id="minigame-walk"
              className="vu-pill vu-minigame-leave"
              type="button"
              disabled={result !== null}
              {...gestures(result !== null, quietLift, quietPress)}
              onClick={() =>
                underWay
                  ? leave({
                      outcome: 'abandoned',
                      summary: `You walk away from the game of ${seated.game.name}${
                        tableNames.length > 0 ? ` with ${listed(tableNames)}` : ''
                      } before it is over.`,
                      // What the game said of itself so far, or failing that how it last stood.
                      ...(soFar.current.length > 0
                        ? { account: soFar.current }
                        : situation.current
                          ? { account: [`How it stood when he left: ${situation.current}`] }
                          : {})
                    })
                  : dismiss()
              }
            >
              {underWay ? 'Walk away' : 'Not now'}
            </motion.button>
            {/* For the beta: what a bug report needs, copied in one press. */}
            <ReportButton
              id="minigame-report"
              report={() => ({
                game: seated.game,
                girls: seated.opponents?.length ?? 0,
                options: seated.options,
                account:
                  soFar.current.length > 0
                    ? soFar.current
                    : situation.current
                      ? // What was riding on it stays out of a report that may be pasted anywhere.
                        [situation.current.replace(/\s*Riding on it:.*$/s, '')]
                      : []
              })}
            />
          </div>
        </motion.div>

        {/* A word across the table, for a game with someone to say it to: the scene's own well,
            where the scene's own stands, and Go beside it. Enter sends from here, the scene's
            own listener being shut out while a table is up. */}
        {(against || asked) && (
          <div
            ref={inputRow}
            className="vu-turn vu-scene-row vu-minigame-input"
            data-well={inputOpen ? 'out' : 'away'}
            data-required={requiredInput ? 'true' : 'false'}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return
              event.stopPropagation()
              speak()
            }}
          >
            {/* The scene's row has its tips mark before the well and the gift after Go. Neither
                is offered at the table, and both keep their room, so the well stands exactly
                where the scene's does. */}
            <span className="vu-scene-help vu-minigame-room" aria-hidden="true" />
            <TurnField
              // A requested answer starts with a fresh enabled editor after the idle field.
              key={asked ? 'answer' : 'chat'}
              action={remark}
              onAction={setRemark}
              onSubmit={speak}
              sending={false}
              submitDead={
                asked
                  ? !remark.trim() || result !== null
                  : answering !== null || !remark.trim() || result !== null || Boolean(seated.game.typed)
              }
              inputDead={result !== null || (Boolean(seated.game.typed) && !asked)}
              focus={Boolean(asked)}
              revealed={inputOpen}
              overlay={<SceneDivider state={inputOpen ? 'hidden' : 'shown'} word="hover" className="vu-minigame-divider" />}
              onHover={setInputHover}
              onFocus={() => setInputPinned(true)}
              onBlur={() => setInputPinned(false)}
              placeholder={
                asked
                  ? asked.placeholder
                  : seated.game.typed
                    ? 'Use the game panel to continue…'
                    : answering !== null
                      ? `${answering} is answering…`
                      : tableNames.length > 1
                        ? 'Say something to the table…'
                        : `Say something to ${against?.name ?? 'her'}…`
              }
              multiline
            />
            <span className="vu-scene-gift vu-minigame-room" aria-hidden="true">
              <span className="vu-scene-giftseat">
                <span className="vu-deadnote">
                  <span className="vu-scene-rule" />
                  <span className="vu-scene-giftbtn">
                    <svg width="20" height="20" />
                  </span>
                </span>
              </span>
            </span>
          </div>
        )}
      </motion.div>,
      host
    )
  }

  return createPortal(
    <motion.div
      key="list"
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.div
        id="minigame-panel"
        className="vu-sheet vu-minigame vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        variants={panelUnderTab}
      >
        <TitleTab>{title}</TitleTab>

        <div className="vu-minigame-body" data-list={!asking}>
          {asking ? (
            <form
              className="vu-minigame-ask"
              onSubmit={(event) => {
                event.preventDefault()
                ask()
              }}
              // Enter asks, as it sends a turn in the scene; Shift+Enter still breaks a line.
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return
                event.preventDefault()
                event.stopPropagation()
                ask()
              }}
            >
              <TextField
                id="minigame-ask-text"
                label="What you say"
                hint="Your turn in the scene. Say it your way, and name what is riding on it if you like. She may say no."
                value={words}
                onChange={setWords}
                maxLength={400}
                multiline
                rows={3}
                autoFocus
              />
            </form>
          ) : (
            <ul className="vu-rows">
              {byGame.map(({ game, ways }) => {
                const open = openGame === game.id
                return (
                  <li key={game.id} className="vu-minigame-game">
                    <motion.button
                      type="button"
                      id={`minigame-game-${game.id}`}
                      className="vu-row vu-minigame-pick"
                      aria-expanded={ways.length > 1 ? open : undefined}
                      {...gestures(false, rowLift, rowPress)}
                      // A game there is only one way to play is picked outright.
                      onClick={() =>
                        ways.length === 1 ? pick(ways[0]) : setOpenGame(open ? null : game.id)
                      }
                    >
                      <span className="vu-minigame-pickicon" aria-hidden="true">
                        {game.icon}
                      </span>
                      <span className="vu-minigame-pickname">{game.name}</span>
                      <span className="vu-minigame-pickblurb">
                        {ways.length === 1 ? wayWords(ways[0]) : playersWords(game)}
                      </span>
                    </motion.button>
                    {open && ways.length > 1 && (
                      <ul className="vu-rows vu-minigame-ways">
                        {ways.map((offer) => (
                          <li key={offer.charIds.join('+') || 'alone'}>
                            <motion.button
                              type="button"
                              className="vu-row vu-minigame-way"
                              {...gestures(false, rowLift, rowPress)}
                              onClick={() => pick(offer)}
                            >
                              {wayWords(offer)}
                            </motion.button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="vu-foot">
          {asking ? (
            <>
              <motion.button
                id="minigame-back"
                className="vu-btn vu-btn--quiet"
                type="button"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => setAsking(null)}
              >
                Back
              </motion.button>
              <motion.button
                id="minigame-ask"
                className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
                type="button"
                disabled={!words.trim()}
                {...gestures(!words.trim(), lift, press)}
                onClick={ask}
              >
                Ask {namesOf(asking.charIds)}
              </motion.button>
            </>
          ) : (
            <motion.button
              id="minigame-close"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={dismiss}
            >
              Not now
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
