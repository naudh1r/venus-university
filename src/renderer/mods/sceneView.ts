import { useRef, useSyncExternalStore } from 'react'
import { appError } from '@shared/errors'
import type { SlotActivity } from '@shared/slotActivity'
import { READER_SPEAKER, type Result, type SceneLine } from '@shared/types'
import { isGraduationSlot } from '../prompts/graduation'
import { isOrientationSlot } from '../prompts/introScript'
import { useGameStore } from '../stores/gameStore'
import { replyRowOfferOf } from '../stores/loop/playback'
import { currentRun, loopState, runStale } from '../stores/loop/state'
import { modIsOn } from '../stores/modsStore'
import { sceneActiveOf } from '../stores/textingLoop'

/**
 * The scene on screen as mods read it: a read-only view the kit defines, mapped from the game's
 * store. It holds what mods read and grows by request; it is never the store's own shape.
 */

/** One line of the scene as a mod reads it. */
export interface SceneViewLine {
  /** `READER_SPEAKER` for the reader's own action, a girl's id for her line, `''` for narration. */
  readonly speaker: string
  /** What is said, as the scene holds it. */
  readonly text: string
}

/** A slot whose screen the game writes end to end. */
export type ScriptedSlot = 'orientation' | 'graduation'

/** The scene on screen. Every value is read-only, and arrays and objects in it are frozen. */
export interface SceneView {
  /** A scene owns the screen: the game's own test for "not free roam". */
  readonly active: boolean
  /** Everyone cast in the scene, by id. */
  readonly cast: readonly string[]
  /** The cast less whoever has left the scene, in cast order. */
  readonly present: readonly string[]
  /** Who stands in each portrait place, left to right, by id; null where nobody does. */
  readonly stage: readonly (string | null)[]
  /** The scene's lines so far, including lines still to be read. */
  readonly lines: readonly SceneViewLine[]
  /** The line on the box now, or null. */
  readonly line: SceneViewLine | null
  /** Where the scene is, as the game noted it: a place id, or plain words; null where unset. */
  readonly location: string | null
  /** The background playback has reached, by its base name; null before any. */
  readonly background: string | null
  /** The class this slot is, or null. */
  readonly classCode: string | null
  /** The job this slot is worked at, or null. */
  readonly jobId: string | null
  /** The class whose project this slot is spent on, or null. */
  readonly projectClass: string | null
  /** The slot activity running in the scene, a mod's or the game's own, or null. */
  readonly activity: Readonly<SlotActivity> | null
  /** A scene the player made himself. */
  readonly created: boolean
  /** A scene read again from the calendar. */
  readonly replay: boolean
  /** An exam is being sat in the scene. */
  readonly quiz: boolean
  /**
   * The orientation's or the graduation's slot, which the game writes end to end; else null, and
   * always null in a created scene or a replay.
   */
  readonly scripted: ScriptedSlot | null
  /** A turn is being taken, or something holds the turn. */
  readonly busy: boolean
  /** The reader's own turn, with nothing left to read. */
  readonly atTurn: boolean
  /** Over a reply, the reader may cut in now, as the scene's interjection row lets him. */
  readonly canInterject: boolean
  /** The last turn failed and waits on the reader. */
  readonly failed: boolean
  /** The scene is ending. */
  readonly ending: boolean
  /** The scene has resolved into its closing status sequence. */
  readonly resolved: boolean
  /** The playthrough is over. */
  readonly over: boolean
}

type Game = ReturnType<typeof useGameStore.getState>
type Ids = Readonly<Record<string, string>>

/** Freezes a copy all the way down, never the native object the game may still update. */
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) frozen(child)
    Object.freeze(value)
  }
  return value
}

/** Who says a line, by id: the reader, a girl the game knows by that key, or narration. */
function speakerOf(key: string, ids: Ids): string {
  if (key === READER_SPEAKER) return READER_SPEAKER
  return key && Object.hasOwn(ids, key) ? ids[key] : ''
}

function lineView(line: SceneLine, ids: Ids): SceneViewLine {
  return Object.freeze({ speaker: speakerOf(line.speaker, ids), text: line.text })
}

/** One value per pair of native objects, so a view is rebuilt only when either changes. */
function pairMemo<A extends object, B extends object, T>(make: (a: A, b: B) => T) {
  const made = new WeakMap<A, WeakMap<B, T>>()
  return (a: A, b: B): T => {
    let byB = made.get(a)
    if (!byB) made.set(a, (byB = new WeakMap()))
    if (!byB.has(b)) byB.set(b, make(a, b))
    return byB.get(b) as T
  }
}

/** One value per native object. */
function memo<A extends object, T>(make: (a: A) => T) {
  const made = new WeakMap<A, T>()
  return (a: A): T => {
    if (!made.has(a)) made.set(a, make(a))
    return made.get(a) as T
  }
}

const linesOf = pairMemo((lines: readonly SceneLine[], ids: Ids) =>
  Object.freeze(lines.map((line) => lineView(line, ids))))
const lineOf = pairMemo((line: SceneLine, ids: Ids) => lineView(line, ids))
const castOf = memo((cast: readonly string[]) => Object.freeze([...cast]))
const presentOf = pairMemo((cast: readonly string[], departed: readonly string[]) =>
  Object.freeze(cast.filter((id) => !departed.includes(id))))
const stageOf = memo((slots: readonly (string | null)[]) => Object.freeze([...slots]))
const backgroundOf = memo((log: readonly SceneLine[]): string | null => {
  for (let i = log.length - 1; i >= 0; i--) {
    const bg = log[i].bg
    if (bg !== undefined) return bg
  }
  return null
})
const activityOf = memo((activity: SlotActivity) => frozen(structuredClone(activity)))

/** A scene the screen can hold: the playthrough's, a created scene or a replay; none on the menu. */
function onScreen(game: Game): boolean {
  return game.playthroughId !== null || game.createdScene !== null || game.replaying !== null
}

/** Only the playthrough's own slots are scripted: a created scene or a replay merely shares a date. */
function scriptedOf(game: Game): ScriptedSlot | null {
  if (game.createdScene || game.replaying) return null
  if (isOrientationSlot(game.date, game.time, game.semesterIndex)) return 'orientation'
  return isGraduationSlot(game.date, game.time) ? 'graduation' : null
}

function viewOf(game: Game): SceneView {
  const atTurn = game.awaitingInput && !game.busy && game.pendingLines.length === 0
  return {
    active: sceneActiveOf(game),
    cast: castOf(game.cast),
    present: presentOf(game.cast, game.departed),
    stage: stageOf(game.slots),
    lines: linesOf(game.currentSceneTranscript, game.charKeyToId),
    line: game.currentLine ? lineOf(game.currentLine, game.charKeyToId) : null,
    location: game.sceneLocation,
    background: backgroundOf(game.sceneLog),
    classCode: game.sceneClass,
    jobId: game.sceneJob,
    projectClass: game.sceneProject,
    activity: game.sceneActivity ? activityOf(game.sceneActivity) : null,
    created: game.createdScene !== null,
    replay: game.replaying !== null,
    quiz: game.sceneQuiz !== null,
    scripted: scriptedOf(game),
    busy: game.busy,
    atTurn,
    canInterject: replyRowOfferOf(game) === 'open',
    failed: game.turnError !== null,
    ending: game.sceneEnding,
    resolved: game.statusShown || game.statusModal !== null,
    over: game.activeGameOver !== null
  }
}

/** The last view made, and the store state it was read from. */
let last: { game: Game; view: SceneView | null } | null = null

/** The same view object while nothing in it changed, so selectors and hooks see a stable value. */
function sameView(a: SceneView, b: SceneView): boolean {
  for (const key of Object.keys(a) as (keyof SceneView)[]) if (!Object.is(a[key], b[key])) return false
  return true
}

/**
 * The scene on screen: the playthrough's, a created scene's or a replay's; null on the menu. The
 * same object comes back until something in it changes. @since 0.8.0
 */
export function scene(): SceneView | null {
  const game = useGameStore.getState()
  if (last?.game === game) return last.view
  let view: SceneView | null = null
  if (onScreen(game)) {
    const next = viewOf(game)
    view = last?.view && sameView(last.view, next) ? last.view : Object.freeze(next)
  }
  last = { game, view }
  return view
}

/**
 * Calls back when the scene changes; with `select`, only when what it selects changes, compared
 * with `Object.is`. Returns the unsubscribe function. @since 0.8.0
 */
export function subscribeScene<T>(
  onChange: () => void,
  select: (view: SceneView | null) => T = (view) => view as T
): () => void {
  let before = select(scene())
  return useGameStore.subscribe(() => {
    const next = select(scene())
    if (Object.is(next, before)) return
    before = next
    onChange()
  })
}

/**
 * What `select` picks from the scene, in a component: it renders again when that changes,
 * compared with `Object.is`. `select` runs once per change of the view. @since 0.8.0
 */
export function useScene<T>(select: (view: SceneView | null) => T): T {
  // Kept per view and selector, so React's repeated reads within one render get the same value.
  const picked = useRef<{ view: SceneView | null; select: typeof select; value: T } | null>(null)
  const get = (): T => {
    const view = scene()
    const held = picked.current
    if (held && held.view === view && held.select === select) return held.value
    const value = select(view)
    picked.current = { view, select, value }
    return value
  }
  return useSyncExternalStore(useGameStore.subscribe, get, get)
}

function refused(code: string, message: string): Result<never> {
  return { ok: false, error: appError(code, message) }
}

/**
 * Holds the reader's turn while a mod settles something of its own, as the game holds it while a
 * turn is taken: the scene reads as busy, and no turn, hangout or autosave starts. Taken only at
 * the reader's own turn, in the playthrough or a created scene. The release it returns gives the
 * turn back, once; after the scene is left it does nothing. Refused with `MOD_WRITE_OFF`, `MOD_WRITE_NO_GAME` or, away from his turn,
 * `MOD_WRITE_WAIT`. @since 0.8.0
 */
export function holdTurn(modId: string): Result<() => void> {
  if (!modIsOn(modId, loopState.record)) return refused('MOD_WRITE_OFF', 'That mod is off.')
  const game = useGameStore.getState()
  if (!onScreen(game)) return refused('MOD_WRITE_NO_GAME', 'There is no scene to hold.')
  if (!game.awaitingInput || game.busy || game.pendingLines.length > 0) {
    return refused('MOD_WRITE_WAIT', 'The reader is not at his turn.')
  }
  const run = currentRun()
  useGameStore.setState({ busy: true })
  let held = true
  const release = (): void => {
    if (!held) return
    held = false
    if (!runStale(run)) useGameStore.setState({ busy: false })
  }
  return { ok: true, data: release }
}
