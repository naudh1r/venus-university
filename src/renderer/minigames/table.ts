import { MINI_GAMES } from '@shared/minigames'
import { finishSlotActivity } from '../stores/slotActivity'
import { writeAutosave } from '../stores/loop/saves'
import { currentRun, runStale } from '../stores/loop/state'
import { create } from 'zustand'
import { gamesOffered, gameSwitchOn, listed, type MiniGameDef } from '@shared/minigames'
import { modById, optionKey } from '@shared/mods'
import { parseSpriteRef } from '@shared/outfits'
import { charKeyOf, READER_SPEAKER, type Emotion } from '@shared/types'
import { useGameStore } from '../stores/gameStore'
import { submitAction, takeTurnFromReply } from '../stores/gameLoop'
import { advance } from '../stores/loop/hooks'
import { replyRowOfferOf } from '../stores/loop/playback'
import { useModsStore, modIsOn } from '../stores/modsStore'
import { splitOverflow } from '../stores/sceneSanitizer'
import { boxFits } from '../views/boxRows'
import { gameComponent, type PlayResult } from './play'
import { gameById, tunedGame, usePrefsStore } from './prefs'
import { checkpointResult, sceneMiniGame, useTableStore } from './session'
import { tableLine } from './talk'
import { useScenePlace } from './place'

/** Where the framework meets the scene: what is on offer in it, and how a result goes into it. */

/** A game can be played: the pack that brings it is on, and so is the game's own switch in it. */
export function gameIsOn(modId: string, game: MiniGameDef): boolean {
  if (!modIsOn(modId)) return false
  const { options } = useModsStore.getState().switches
  return gameSwitchOn(game, modById(modId), (optionId) => options[optionKey(modId, optionId)])
}

/** The games on offer in the scene on screen, each with a component to play it with. */
export function useGamesOffered(): MiniGameDef[] {
  const sceneLocation = useScenePlace()
  const activity = useGameStore(s => s.sceneActivity)
  const training = activity?.owner === MINI_GAMES && activity.status === 'pending' ? activity : null
  const location = training?.location ?? sceneLocation
  const girls = useGameStore((s) => s.cast.filter((id) => !s.departed.includes(id)).length)
  // Read so a switch moved mid-scene is answered at once.
  useModsStore((s) => s.switches)
  // Read so a game retuned on its page is offered as retuned.
  usePrefsStore((s) => s.byGame)
  // A game is played inside a scene. Before the reader's first action there is none yet, only
  // the slot's landing, and a game narrated onto it would pass for a scene already running.
  const under = useGameStore((state) =>
    state.currentSceneTranscript.some((line) => line.speaker === READER_SPEAKER)
  )
  if (!under) return []
  return gamesOffered({ location, girls }, gameIsOn)
    .filter(game => !training || game.id === training.id)
    .filter((game) => Boolean(gameComponent(game.id)))
    .map(tunedGame)
}

/** The girls in the scene, by id: the cast, less whoever has left it. */
export function usePresentGirls(): string[] {
  const cast = useGameStore((s) => s.cast)
  const departed = useGameStore((s) => s.departed)
  return cast.filter((id) => !departed.includes(id))
}

/** What the reader calls a girl: her first name once he has been told it, "her" until then. */
export function nameOf(charId: string): string {
  const game = useGameStore.getState()
  const known = game.charInfo[charId]?.nameKnown
  return (known && game.characters[charId]?.firstName) || 'her'
}

/** The reader is standing at his own turn, with nothing left to read. */
export function useAtTurn(): boolean {
  return useGameStore((s) => s.awaitingInput && !s.busy && s.pendingLines.length === 0)
}

/**
 * Asks a girl to play, or several at once, as the reader's turn in the scene: over a reply still being read it is an
 * interjection. Her answer comes back with the reply. False where no turn could be taken.
 */
export function proposeGame(gameId: string, charIds: readonly string[], words: string): boolean {
  const text = words.trim()
  if (!text || charIds.length === 0 || !takeTurnFromReply()) return false
  useTableStore.getState().setProposal({ gameId, charIds: [...charIds], text })
  void submitAction(text)
  return true
}

/**
 * The reader may start a game: wherever he may take a turn. That is his own turn, and also over
 * a reply he is still reading, on the terms an interjection is let through on.
 */
export function useTableOpen(): boolean {
  return useGameStore((s) => {
    if (s.replaying || s.sceneQuiz) return false
    if (s.sceneActivity?.owner === MINI_GAMES && s.sceneActivity.status === 'pending') {
      return s.awaitingInput && !s.busy && s.pendingLines.length === 0
    }
    if (s.awaitingInput && !s.busy && s.pendingLines.length === 0) return true
    return replyRowOfferOf(s) === 'open'
  })
}

/**
 * The scene has nothing more to offer a game: it has resolved into its closing bookkeeping, or the
 * playthrough is over. The seat is then absent, where a turn merely out leaves it standing dim.
 */
export function useSceneSpent(): boolean {
  return useGameStore((s) => s.statusShown || s.statusModal !== null || s.activeGameOver !== null)
}

/**
 * Takes the turn for a game, as an interjection does: the lines of the reply not yet read are
 * dropped, and the scene stands at a decision point. Nothing to do where it already does.
 */
export function takeTurnForGame(): boolean {
  return takeTurnFromReply()
}

/**
 * Brings the scene to the reader's turn for something the table is about to send. At his turn
 * already, nothing to do; over a reply, the interjection's own steps. A table that has been
 * narrating stands on its own last line with nothing behind it, and where the scene will not
 * count that as a turn to take (a class scene's opening), the turn is simply opened.
 */
function reachTurn(): boolean {
  const game = useGameStore.getState()
  if (game.awaitingInput && !game.busy && game.pendingLines.length === 0) return true
  if (takeTurnFromReply()) return true
  if (game.busy || game.streaming || game.pendingLines.length > 0) return false
  game.setAwaitingInput(true)
  return true
}

/**
 * Every line of move-by-move narration a table has said and not yet taken back, as the very
 * objects on the scene's records: what {@link compactTable} removes, wherever they have got to.
 */
let moveLines = new Set<object>()

/**
 * Puts lines on the transcript and on the box at once, the box turning to the first of them.
 * `moves` marks a game's own narration of its moves, as against a result that stays in the scene.
 */
function playLines(text: string, speaker = '', moves = false, expression?: Emotion): void {
  const game = useGameStore.getState()
  const charId = game.charKeyToId[speaker]
  const outfit = charId ? parseSpriteRef(game.emotions[charId] ?? 'neutral')?.set : undefined
  const actions = expression && charId ? [`sprite:${speaker},${expression}${outfit ? `_${outfit}` : ''}`] : undefined
  const lines = splitOverflow({ speaker, text, ...(actions ? { actions } : {}) }, boxFits)
  if (moves) for (const line of lines) moveLines.add(line)
  game.appendSceneLines(lines)
  game.appendPendingLines(lines)
  game.setAwaitingInput(false)
  advance()
}

/**
 * The table's turn at the dialogue box. Every line is given the box for as long as it takes to
 * type itself out and be read, so nothing is replaced half-written: what follows waits behind
 * it, in order. A table that has closed says nothing more: whatever was still waiting is dropped
 * with it.
 */

/** The box's own pace: its arrival, and each character it types. */
const BOX_ARRIVAL_MS = 350
const BOX_TYPE_MS = 18
/** What a line is left on the box for once it is written: longer for something said. */
const NARRATED_BEAT_MS = 550
const SPOKEN_BEAT_MS = 1300

/** How long a line holds the box: written out in full, then a beat to read it. */
function holdFor(text: string, spoken: boolean): number {
  return BOX_ARRIVAL_MS + text.length * BOX_TYPE_MS + (spoken ? SPOKEN_BEAT_MS : NARRATED_BEAT_MS)
}

let sitting = 0
let heldUntil = 0

/**
 * A table read at the reader's own pace. A line stays on the box until he steps past it, and the
 * next waits for that; `chain` is everything waiting its turn, in order.
 */
let stepped = false
/** A line is on the box that he has not stepped past. */
let unread = false
let chain: Promise<void> = Promise.resolve()
let release: (() => void) | null = null

/** Whether something is waiting on the reader to step on: what the table shows a way on for. */
export const useStepStore = create<{ waiting: boolean }>(() => ({ waiting: false }))

/** Resolves once the reader has stepped past the line on the box; at once with none there. */
function stepPast(): Promise<void> {
  if (!unread) return Promise.resolve()
  return new Promise((resolve) => {
    release = resolve
    useStepStore.setState({ waiting: true })
  })
}

/**
 * The reader moves on: a click, a key, or a move of his own in the game. The line on the box
 * counts as read, and whatever was waiting behind it arrives.
 */
export function stepTable(): void {
  unread = false
  const waiting = release
  release = null
  if (useStepStore.getState().waiting) useStepStore.setState({ waiting: false })
  waiting?.()
}

/**
 * A finished game at a table read at the reader's own pace: it stands until he moves on, whether
 * or not anything is left on the box for him to read. Its ending is on the table itself.
 */
export function holdForReader(): void {
  if (stepped) unread = true
}

/** Resolves once everything the table has said has been read past, at the reader's own pace. */
export function tableRead(): Promise<void> {
  chain = chain.then(stepPast)
  return chain
}

/** A new table: nothing is waiting, and nothing from the last one may speak. */
export function openTable(readerPaced = false): void {
  sitting++
  heldUntil = 0
  stepped = readerPaced
  unread = false
  chain = Promise.resolve()
  stepTable()
}

/**
 * Takes a finished game's move-by-move narration back off the scene: off the transcript, which
 * every later request quotes; off the log, which the scene's closing bookkeeping reads and a
 * rewind walks; and off whatever was still waiting to be shown. A few games' worth of card turns
 * is a lot of scene to send and to think through for nothing, and the three records must go on
 * agreeing line for line. What was said across the table stays, and what the game came to goes
 * in once, with its result.
 */
export function compactTable(): void {
  const gone = moveLines
  moveLines = new Set()
  if (gone.size === 0) return
  const kept = <T extends object>(lines: readonly T[]): T[] => lines.filter((line) => !gone.has(line))
  const game = useGameStore.getState()
  useGameStore.setState({
    currentSceneTranscript: kept(game.currentSceneTranscript),
    sceneLog: kept(game.sceneLog),
    pendingLines: kept(game.pendingLines)
  })
}

/** The table is cleared; lines still waiting on the box are dropped. */
export function closeTable(): void {
  sitting++
  stepped = false
  stepTable()
}

/** How long until everything the table has said so far has had its time on the box. */
export function tableQuietIn(): number {
  return Math.max(0, heldUntil - performance.now())
}

/** Resolves once the line is on the box, which is after everything said before it. */
function show(text: string, speaker: string, expression?: Emotion): Promise<void> {
  // A line too long for the box is several, each given the box in its turn: put on together,
  // only the first would be shown and every later line would run one behind.
  const parts = splitOverflow({ speaker, text }, boxFits)
  if (parts.length > 1) {
    return parts.reduce<Promise<void>>(
      (said, part) => said.then(() => showOne(part.text, speaker, expression)),
      Promise.resolve()
    )
  }
  return showOne(text, speaker, expression)
}

function showOne(text: string, speaker: string, expression?: Emotion): Promise<void> {
  const at = sitting
  if (stepped) {
    // Behind whatever is still being read, and on the box as soon as he steps past it.
    chain = chain.then(stepPast).then(() => {
      if (at !== sitting) return
      playLines(text, speaker, speaker === '', expression)
      unread = true
    })
    return chain
  }
  const now = performance.now()
  const wait = Math.max(0, heldUntil - now)
  heldUntil = Math.max(now, heldUntil) + holdFor(text, speaker !== '')
  return new Promise((resolve) => {
    const put = (): void => {
      if (at === sitting) playLines(text, speaker, speaker === '', expression)
      resolve()
    }
    if (wait === 0) put()
    else setTimeout(put, wait)
  })
}

/** How long a move left out of the box is given before the game goes on: a beat to see it land. */
const MOVE_BEAT_MS = 800

/**
 * A move the game would narrate, at a table whose box keeps to what people say: nothing goes on
 * the box or the scene, and whatever is on the box stays. Resolves after a beat, so a game that
 * waits on its narration between her moves still lets each be seen on the table.
 */
export function moveAtTable(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOVE_BEAT_MS))
}

/** A line from the table in the scene's dialogue box, once the turn is the table's. */
export function narrateAtTable(text: string): Promise<void> {
  return show(text, '')
}

/**
 * A girl's line at the table, written by the model from the game's cue and shown in the scene's
 * dialogue box as hers. Resolves once it has been on the box long enough to read, or once it is
 * clear there will be none.
 */
export async function sayAtTable(charId: string, situation: string, cue: string): Promise<void> {
  const at = sitting
  const character = useGameStore.getState().characters[charId]
  if (!character) return
  const line = await tableLine(character, situation, cue)
  if (!line || at !== sitting) return
  await show(line, charKeyOf(character.firstName, character.lastName))
  // At the reader's own pace the line is his to leave; otherwise it is given its time.
  if (!stepped) await new Promise((resolve) => setTimeout(resolve, holdFor(line, true)))
}

/** A girl's line at the table in words already written, shown as hers and given its time. */
export async function speakAtTable(charId: string, text: string, expression?: Emotion): Promise<void> {
  const character = useGameStore.getState().characters[charId]
  const line = text.trim()
  if (!character || !line) return
  await show(line, charKeyOf(character.firstName, character.lastName), expression)
  // At the reader's own pace the line is his to leave; otherwise it is given its time.
  if (!stepped) await new Promise((resolve) => setTimeout(resolve, holdFor(line, true)))
}

/** The reader's own words as part of a game: onto the scene as his, with nobody asked to answer. */
export function readerPlaysAtTable(words: string): void {
  const text = words.trim()
  if (text) useGameStore.getState().logPlayerAction(text, true)
}

/**
 * Something the reader says at the table, whenever he likes: his words go onto the scene as his
 * own, the game goes on, and she answers in a line when it comes.
 */
export async function readerSaysAtTable(
  charId: string,
  situation: string,
  words: string
): Promise<void> {
  const text = words.trim()
  if (!text) return
  useGameStore.getState().logPlayerAction(text, true)
  await sayAtTable(charId, situation, `The reader says across the table: "${text}"`)
}

/** How often, and how long apart, a result is tried again while the scene is busy: a minute in all. */
const FILE_TRIES = 120
const FILE_WAIT_MS = 500

/** Who a game was played with and for what, as far as filing its result goes. */
export interface PlayedWith {
  game: MiniGameDef
  /** What the reader calls each girl who played. */
  names: readonly string[]
  stake: string
}

// The matches whose result each stay in a game is saving, and has already put into the scene.
const resultRuns = new WeakMap<object, { filing: Set<string>; dispatched: Set<string> }>()
/** The results a stay in a game is filing and has filed, by match id. */
function resultRun(run: object) {
  let state = resultRuns.get(run)
  if (!state) { state = { filing: new Set(), dispatched: new Set() }; resultRuns.set(run, state) }
  return state
}

/** Persist the settled outcome before narration. Reload recovers it, never the match. */
export function fileResult(result: PlayResult, played: PlayedWith, tries = 0): void {
  const game = useGameStore.getState()
  const match = game.sceneMods.miniGame?.match
  if (!match || match.gameId !== played.game.id) { deliverResult(result, played, tries); return }
  const run = currentRun()
  const delivery = resultRun(run)
  const key = match.id
  if (delivery.filing.has(key) || delivery.dispatched.has(key)) return
  if (!reachTurn()) {
    if (tries < FILE_TRIES) setTimeout(() => {
      if (!runStale(run) && sceneMiniGame()?.match?.id === key) fileResult(result, played, tries + 1)
    }, FILE_WAIT_MS)
    return
  }
  checkpointResult(result, played.names)
  delivery.filing.add(key)
  useGameStore.setState({ busy: true })
  void writeAutosave(useGameStore.getState().captureScene()).then(() => {
    if (runStale(run)) return
    useGameStore.setState({ busy: false })
    delivery.dispatched.add(key)
    const saved = sceneMiniGame()?.match
    deliverResult(saved?.result ?? result, { ...played, names: saved?.names ?? played.names })
  }).finally(() => { delivery.filing.delete(key) })
}

/** Puts a result saved before its scene was told of it into the scene, once nothing else holds it. */
export function resumeMiniGameResult(): void {
  const state = useGameStore.getState()
  const match = state.sceneMods.miniGame?.match
  if (!match || match.status !== 'result' || !match.result || state.busy || state.turnError || state.sceneEnding || useTableStore.getState().active) return
  const game = gameById(match.gameId)
  if (game) fileResult(match.result, { game, names: match.names ?? [], stake: match.stake })
}

/**
 * Puts a finished game into the scene, over whatever of the reply was still unread.
 *
 * A game played alone is a line of narration: on the transcript, where the next reply, the
 * scene's summary and its bookkeeping all read it, and on the box, where the reader does; reading
 * past it is his turn again.
 *
 * A game played with a girl is the reader's turn itself: the result goes out as his action, so
 * her reaction is the next thing written, and what the game has to say about how it went rides
 * with that one request.
 */
function deliverResult(result: PlayResult, played: PlayedWith, tries = 0): void {
  // The game's first move took the turn, and its narration has stood on the box since. Where the
  // scene is busy with something of its own just now, the result waits for it rather than being
  // lost: the model was promised it would be told how the game went.
  if (!reachTurn()) {
    if (tries < FILE_TRIES) setTimeout(() => deliverResult(result, played, tries + 1), FILE_WAIT_MS)
    return
  }

  const activity = useGameStore.getState().sceneActivity
  if (activity?.owner === MINI_GAMES && activity.id === played.game.id) {
    if (result.outcome === 'broken') return // training panel offers retry; never settle a technical failure
    const company = played.names.length ? ` Played with ${listed(played.names)}.` : ' Played alone.'
    const account = result.account?.join(' ') ?? ''
    void finishSlotActivity(MINI_GAMES, played.game.id, result.outcome !== 'abandoned',
      `${result.summary}${company} ${account}${played.stake ? ` Agreed stake: ${played.stake}.` : ''}`)
    return
  }

  if (played.names.length > 0) {
    const who = listed(played.names)
    // Walked away from: that he did is all the scene is told. What it means is theirs to settle.
    const left = result.outcome === 'abandoned'
    // Broken off: the game's own screen failed. Nobody's doing, and a small thing in the scene.
    const broke = result.outcome === 'broken'
    useTableStore.getState().setPlayed({
      text: result.summary,
      brief: broke
        ? [
            'MINI-GAME',
            `The reader and ${who} were playing ${played.game.name} for real, at the table, between your last lines and now. It broke off before it was over: the game itself went wrong, the way a machine jams or a deck gets muddled, not through anything either of them did. Nobody won it.`,
            ...(result.account ?? []),
            ...(played.stake ? [`Riding on it, as they agreed: ${played.stake}`] : []),
            `Let ${who} react in character, lightly: it is a small mishap. Anything riding on it is for them to settle in the scene.`
          ]
        : left
        ? [
            'MINI-GAME',
            `The reader and ${who} were playing ${played.game.name} for real, at the table, between your last lines and now. The reader walked away from it before it was over. Nobody won it.`,
            ...(result.account ?? []),
            ...(played.stake ? [`Riding on it, as they agreed: ${played.stake}`] : []),
            `Let ${who} react in character to him walking away. What it means, for the game and for anything riding on it, is for them to settle in the scene.`
          ]
        : [
            'MINI-GAME RESULT',
            `The reader and ${who} have just played ${played.game.name} for real, at the table, between your last lines and now. It is over and settled: do not replay it or change how it came out.`,
            ...(result.account ?? []),
            ...(played.stake
              ? [
                  result.outcome === 'won' || result.outcome === 'lost'
                    ? `Riding on it, as they agreed: ${played.stake} It is owed now.`
                    : `Riding on it, as they agreed: ${played.stake} Nobody won outright, so what becomes of it is theirs to settle.`
                ]
              : []),
            ...(played.game.resultBrief?.length
              ? played.game.resultBrief
              : [`Open on the result, then let ${who} react to it in character: how the game went, anything in it worth a remark, and the stake if there was one.`])
          ]
    })
    void submitAction(result.summary)
    return
  }

  // Played alone, what the game has to say about how it went rides with the next turn's prompt,
  // whoever is there to have watched.
  if (result.account?.length || sceneMiniGame()?.match) {
    useTableStore.getState().setPlayed({
      text: result.summary,
      next: true,
      brief: [
        'MINI-GAME',
        `The reader has just played ${played.game.name} on his own, for real, in this scene. It is over: do not replay it or change how it came out. Anyone here saw it and may bring it up.`,
        ...(result.account ?? []),
        ...(sceneMiniGame()?.match ? played.game.resultBrief ?? [] : [])
      ]
    })
  }
  if (sceneMiniGame()?.match?.status === 'result') {
    void submitAction(result.summary)
  } else playLines(result.summary)
}
