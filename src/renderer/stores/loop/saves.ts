import { appError, toAppError } from '@shared/errors'
import { modById } from '@shared/mods'
import { modSceneWith, savedModScene } from '@shared/modScene'
import { gameOverReasonOf, type GameOverReason } from '@shared/gameOver'
import { isGameOver, spentOf } from '@shared/money'
import { replayIdOf, type SlotReplay } from '@shared/replays'
import {
  READER_SPEAKER,
  type AppError,
  type Result,
  type SaveDraft,
  type SceneLine,
  type SceneState
} from '@shared/types'
import { bindModWrites, bindSceneFieldSaves, saveFields, writeModSlices as slicesWith } from '@vx/modkit/host/renderer'
import { isGraduationSlot } from '../../prompts/graduation'
import { useBunnyboardStore } from '../bunnyboardStore'
import { PORTRAIT_SLOTS, savedSceneRecords, useGameStore } from '../gameStore'
import { modIsOn } from '../modsStore'
import { lastReaderIndexOf } from '../stageStep'
import { sceneActiveOf, textingUnsettled } from '../textingLoop'
import { useUiStore } from '../uiStore'
import { currentRun, loopState, runStale } from './state'
import { sceneInProgress } from './stream'
import { composeStageThumbnail } from './thumbnail'

/**
 * Every write the slot loop makes, which scene each one records, and the ordering
 * discipline they share.
 */

/** Reports a failed save without undoing anything. */
function reportWriteFailure(error: AppError): void {
  useUiStore.getState().showError(error)
}

/** Save writes run strictly one after another. */
let writeChain: Promise<void> = Promise.resolve()

/** How many writes are queued or running behind {@link writeChain}. */
let pending = 0

/** A manual save, or a mod's write to its save data, is being written; a second one waits for it. */
let manualWriting = false

/** Who is told when {@link manualWriting} moves, which nothing else in the stores shows. */
const lockWatchers = new Set<() => void>()

/** Takes or releases the manual-save lock, telling whoever watches the save offer. */
function setManualWriting(next: boolean): void {
  if (manualWriting === next) return
  manualWriting = next
  for (const watcher of [...lockWatchers]) watcher()
}

/**
 * Runs `write` once every write queued before it has settled — and not at all when the stay it
 * was queued in has been left by then, so it never lands in the next game's files.
 */
function queueWrite(write: () => Promise<void>): Promise<void> {
  const run = currentRun()
  const guarded = async (): Promise<void> => {
    if (runStale(run)) return
    await write()
  }
  pending += 1
  writeChain = writeChain.then(guarded, guarded).finally(() => {
    pending -= 1
  })
  return writeChain
}

/** True while a save write is still queued or in flight. */
export function writesPending(): boolean {
  return pending > 0
}

/** Resolves once every write queued so far, and any queued behind them meanwhile, has settled. */
export async function writesSettled(): Promise<void> {
  while (pending > 0) {
    await writeChain.then(
      () => undefined,
      () => undefined
    )
  }
}

// Captures and ordinary autosaves get their order when requested. A later decision
// supersedes an older capture only after its write succeeds.
let nextAutosaveOrder = 0
let lastSavedOrder = 0

interface DeferredAutosave {
  game: ReturnType<typeof useGameStore.getState>
  run: object
  order: number
}

function superseded(point?: DeferredAutosave): boolean {
  if (!point) return false
  const live = useGameStore.getState()
  return (
    point.order <= lastSavedOrder ||
    runStale(point.run) ||
    point.game.loads !== live.loads ||
    point.game.playthroughId !== live.playthroughId
  )
}

/** Hold a decision point for a deferred write. Only the last retained turn is serialized. */
export function prepareAutosave(scene: SceneState | null): () => Promise<void> {
  const point = { game: useGameStore.getState(), run: currentRun(), order: ++nextAutosaveOrder }
  return () => writeAutosave(scene, undefined, point)
}

/**
 * Overwrites the autosave, recording `scene` in place of what is on screen now. The save is taken
 * as the write's turn comes, and the stage picture is drawn off `scene` after it. `onWritten` is
 * told how the write went, and not at all where it was skipped.
 */
export function writeAutosave(
  scene: SceneState | null,
  onWritten?: (result: Result<null>) => void,
  point?: DeferredAutosave
): Promise<void> {
  const order = point?.order ?? ++nextAutosaveOrder
  return queueWrite(async () => {
    if (superseded(point)) return
    const game = point?.game ?? useGameStore.getState()
    const playthroughId = game.playthroughId
    if (!playthroughId) return
    const draft: SaveDraft = { ...game.toGameSave(game), scene }

    const thumbnail = scene ? await composeStageThumbnail(scene) : null
    if (superseded(point)) return
    const result = await window.api.saves.autosave(
      playthroughId,
      thumbnail ? { ...draft, thumbnail } : draft
    )
    if (result.ok) lastSavedOrder = Math.max(lastSavedOrder, order)
    else reportWriteFailure(result.error)
    onWritten?.(result.ok ? { ok: true, data: null } : { ok: false, error: result.error })
  })
}

/**
 * Mints the slot-boundary save; the autosave beside it stands. A `replay` is named on the save
 * and kept beside it in the same write, and named only once the write's turn has come, so no
 * write queued ahead of it names a replay not yet kept; a failed write forgets it again.
 */
export function writeSlotSave(replay?: SlotReplay): Promise<void> {
  return queueWrite(async () => {
    const run = currentRun()
    const game = useGameStore.getState()
    const playthroughId = game.playthroughId
    if (!playthroughId) return
    const before = replay ? game.replays[replay.date]?.[replay.time] : undefined
    if (replay) game.setReplay(replay.date, replay.time, replayIdOf(replay))
    const draft = useGameStore.getState().toGameSave()

    // Unknown until this write answers: a failed one leaves nothing for the opening to fold into.
    loopState.slotSaveId = null
    const result = await window.api.saves.slot(playthroughId, draft, replay)
    if (!result.ok) {
      reportWriteFailure(result.error)
      // The slot names what it named before, which is what is on disk.
      if (replay && !runStale(run)) {
        if (before) useGameStore.getState().setReplay(replay.date, replay.time, before)
        else useGameStore.getState().dropReplay(replay.date, replay.time)
      }
    }
    // The file the opening narration is folded back into once it arrives.
    else loopState.slotSaveId = result.data.saveId
  })
}

/**
 * Records where the graduation epilogue stands: the narration having played, and every
 * goodbye said so far. The scene is `null`: the menu is between scenes.
 */
export function writeEpilogueSave(): Promise<void> {
  return writeAutosave(null)
}

/**
 * Folds the slot opening's narration into the slot-save minted before the call went out, so
 * reloading it replays the opening.
 */
export function foldOpeningIntoSlotSave(lines: SceneLine[]): Promise<void> {
  return queueWrite(async () => {
    const game = useGameStore.getState()
    const saveId = loopState.slotSaveId
    const playthroughId = game.playthroughId
    if (!playthroughId || !saveId) return
    const draft: SaveDraft = { ...game.toGameSave(), scene: openingScene(lines) }

    const result = await window.api.saves.overwrite(playthroughId, saveId, draft)
    if (!result.ok) reportWriteFailure(result.error)
  })
}

/**
 * The slot opening as a resumable scene: narration queued, nothing else. The empty transcript
 * is load-bearing — the classifier turn reads it as "no scene has started".
 */
export function openingScene(lines: SceneLine[]): SceneState {
  return {
    cast: [],
    transcript: [],
    summary: null,
    bg: null,
    slots: Array<string | null>(PORTRAIT_SLOTS).fill(null),
    emotions: {},
    flipped: {},
    departed: [],
    offStage: {},
    sceneLog: [],
    currentLine: null,
    pendingLines: lines
  }
}

/**
 * `log` with the reader's newest action in `transcript` read onto its end, unless the log already
 * holds as many of his actions as the transcript does.
 */
function withReaderAction(log: readonly SceneLine[], transcript: readonly SceneLine[]): SceneLine[] {
  const action = transcript[lastReaderIndexOf(transcript)]
  const actions = (lines: readonly SceneLine[]): number =>
    lines.filter((line) => line.speaker === READER_SPEAKER).length
  if (!action || actions(log) >= actions(transcript)) return [...log]
  return [...log, action]
}

/**
 * The scene as it stood *before* `lines` played, with them queued. The turn's own action is read
 * onto the log: `base` was captured before it was logged. The transcript and its marks are the
 * store's as a capture takes them, so they count the same lines as `base`'s log and gifts.
 */
export function queuedScene(
  base: SceneState | null,
  lines: SceneLine[],
  extra: Partial<SceneState> = {}
): SceneState {
  const game = useGameStore.getState()
  const records = savedSceneRecords(game)
  const from = base ?? openingScene([])
  const scene: SceneState = {
    ...from,
    cast: [...game.cast],
    transcript: [...records.currentSceneTranscript],
    summary: game.sceneSummary,
    sceneLog: withReaderAction(from.sceneLog, records.currentSceneTranscript),
    pendingLines: lines,
    ...extra
  }
  // Set-or-delete, like the kinds below: the marks are the store's, never the base's.
  if (records.sceneSummaries.length > 0) {
    scene.summaries = records.sceneSummaries.map((mark) => ({ ...mark }))
  } else delete scene.summaries
  const mods = savedModScene(game.sceneMods)
  if (mods) scene.mods = mods
  else delete scene.mods
  // Set-or-delete: a scene that is not one of these kinds must carry no key at all.
  if (game.sceneActivity) scene.activity = { ...game.sceneActivity }
  else delete scene.activity
  if (game.sceneClass) scene.classCode = game.sceneClass
  else delete scene.classCode
  if (game.sceneProject) scene.projectClass = game.sceneProject
  else delete scene.projectClass
  if (game.sceneJob) scene.jobId = game.sceneJob
  else delete scene.jobId
  if (game.sceneJobStats.length > 0) scene.jobStats = [...game.sceneJobStats]
  else delete scene.jobStats
  if (game.sceneVisitJob) scene.visitJobId = game.sceneVisitJob
  else delete scene.visitJobId
  if (game.sceneTextLedgerSkip) scene.textLedgerSkip = game.sceneTextLedgerSkip
  else delete scene.textLedgerSkip
  if (game.sceneTextLedger) scene.textLedger = { ...game.sceneTextLedger }
  else delete scene.textLedger
  if (game.sceneIgnoredInvites.length > 0) scene.ignoredInvites = [...game.sceneIgnoredInvites]
  else delete scene.ignoredInvites
  if (game.sceneTurnedDown.length > 0) scene.turnedDownInvites = [...game.sceneTurnedDown]
  else delete scene.turnedDownInvites
  if (game.sceneFarewell) scene.farewell = game.sceneFarewell
  else delete scene.farewell
  // `base` predates the casting turn, so these are only in the store.
  if (game.sceneMentions.length > 0) scene.mentions = [...game.sceneMentions]
  else delete scene.mentions
  if (game.sceneLocation) scene.location = game.sceneLocation
  else delete scene.location
  // Set-or-delete on the same terms, and only ever *false*: absent is public.
  if (game.sceneInPublic) delete scene.inPublic
  else scene.inPublic = false
  if (game.sceneSecret) scene.secret = game.sceneSecret
  else delete scene.secret
  if (game.sceneEvent) scene.event = { ...game.sceneEvent }
  else delete scene.event
  if (game.sceneReceivedGift) scene.receivedGift = { ...game.sceneReceivedGift }
  else delete scene.receivedGift
  return scene
}

/**
 * The decision point: what is on disk becomes the drained scene, so a reload lands on
 * this line with the input open. An exam is the exception — its decision point is the paper's
 * start, written and held when the questions landed, so no question is one of its own.
 */
export function markDecisionPoint(): void {
  if (!sceneInProgress()) return
  if (useGameStore.getState().sceneQuiz) return
  loopState.decisionSave = useGameStore.getState().captureScene()
  void writeAutosave(loopState.decisionSave)
}

/**
 * `scene` marked to resume on the line on screen when the reader is reading one rather than
 * standing at a decision point; unchanged otherwise.
 */
function onLine(scene: SceneState): SceneState {
  const game = useGameStore.getState()
  if (game.awaitingInput || game.currentLine === null) return scene
  return { ...scene, resumeOnLine: true }
}

/** `scene` as a resolved scene still playing out its ending, with whatever the ending banked. */
function asEnding(scene: SceneState): SceneState {
  const ledger = loopState.pendingLedgerResult
  const opening = loopState.bankedOpening
  return {
    ...scene,
    endPending: true,
    ...(ledger ? { ledger } : {}),
    ...(opening ? { opening } : {})
  }
}

/** The save a scene's ending stands at right now, on its line; null with no scene on screen. */
export function endingSave(): SaveDraft | null {
  const draft = useGameStore.getState().toGameSave()
  if (!draft.scene) return null
  return { ...draft, scene: asEnding(onLine(draft.scene)) }
}

/**
 * The losing ending the finished scene's boundary opens onto, if any, read before the boundary
 * lands it: the ledger's expulsion, and the balance once the shift's pay or the scene's spend
 * has moved — which the status sequence does as it opens, so after it the store already holds it.
 */
export function endingGameOver(): GameOverReason | null {
  const game = useGameStore.getState()
  const ledger = loopState.pendingLedgerResult
  if (!ledger) return null
  const shift = loopState.jobShift
  const money = game.statusShown
    ? game.money
    : shift
      ? game.money + shift.pay
      : game.money - spentOf(ledger.spent)
  return gameOverReasonOf({ money, expelled: game.expelled || ledger.expelled === true })
}

/** Whether a manual save can be taken now, has to wait for the loop to settle, or never can. */
export type ManualSaveOffer = 'open' | 'waiting' | 'none'

/** What the Save Game button offers at this moment. */
export function manualSaveOffer(): ManualSaveOffer {
  return saveOffer(manualWriting)
}

/**
 * The save offer, with `manualInProgress` standing for the manual-save lock: a write holding the
 * lock itself asks with false, so its own hold does not make it wait.
 */
export function saveOffer(manualInProgress: boolean): ManualSaveOffer {
  const game = useGameStore.getState()
  if (!game.playthroughId || game.activeGameOver !== null) return 'none'
  // The goodbye menu past the floor: the next press meets the collectors, and the goodbyes
  // save already on disk is the one that stands.
  if (isGraduationSlot(game.date, game.time) && game.graduationSeen && isGameOver(game.money)) {
    return 'none'
  }
  // A losing ending, its goodbye and status lines included: the next press meets the collectors
  // or the Dean, and the save before it is the one that stands.
  if (game.sceneEnding && endingGameOver() !== null) return 'none'
  const unsettled =
    game.busy ||
    game.streaming ||
    game.waitingForLine ||
    game.turnError !== null ||
    game.introError !== null ||
    game.classifierError !== null ||
    game.closingError !== null ||
    game.ledgerError !== null ||
    game.textLedgerError !== null ||
    game.statusModal !== null ||
    game.memoryEdit !== null ||
    game.endingInFlight ||
    loopState.openingWait ||
    loopState.hangoutPrefetch !== null ||
    useBunnyboardStore.getState().armedHangout !== null ||
    textingUnsettled() ||
    manualInProgress
  return unsettled ? 'waiting' : 'open'
}

/** What the calendar's Replay offers: Save Game's offers, or dead for as long as a scene is on. */
export type ReplayOffer = ManualSaveOffer | 'scene'

/**
 * What the calendar's Replay offers, given the Save Game offer, whether a scene is on and whether
 * a call is still out that the replay's round trip would cancel and the game's return would send
 * again: Replay is left from the landing alone, and there waits for that call as it waits for
 * whatever Save Game waits for.
 */
export function replayOfferOf(
  saveOffer: ManualSaveOffer,
  inScene: boolean,
  callsOut: boolean
): ReplayOffer {
  if (saveOffer === 'none') return 'none'
  if (inScene) return 'scene'
  if (saveOffer !== 'open') return saveOffer
  return callsOut ? 'waiting' : 'open'
}

/**
 * What a manual save taken now records, read in one go: the status sequence's base inside it,
 * the goodbye menu as between scenes, and otherwise the scene on screen on its line. Null when
 * there is nothing a load could be put back onto.
 */
export function manualSaveDraft(): SaveDraft | null {
  const game = useGameStore.getState()
  if (game.sceneEnding && game.statusShown) return loopState.statusBase
  if (isGraduationSlot(game.date, game.time) && game.graduationSeen && !sceneActiveOf(game)) {
    return { ...game.toGameSave(), scene: null }
  }
  const draft = game.toGameSave()
  if (!draft.scene) return null
  const scene = onLine(draft.scene)
  return { ...draft, scene: game.sceneEnding ? asEnding(scene) : scene }
}

/**
 * Writes the game as it stands at the click into manual slot `slot`, behind every write already
 * queued. True once it is on disk; false, writing nothing, when the offer is not open.
 */
export async function writeManualSave(slot: number): Promise<boolean> {
  if (manualSaveOffer() !== 'open') return false
  const playthroughId = useGameStore.getState().playthroughId
  const draft = manualSaveDraft()
  if (!playthroughId || !draft) return false

  setManualWriting(true)
  let saved = false
  try {
    await queueWrite(async () => {
      const thumbnail = draft.scene ? await composeStageThumbnail(draft.scene) : null
      const result = await window.api.saves.manual(
        playthroughId,
        slot,
        thumbnail ? { ...draft, thumbnail } : draft
      )
      if (!result.ok) reportWriteFailure(result.error)
      else saved = true
    })
  } catch (err) {
    reportWriteFailure(toAppError(err, 'SAVE_WRITE_FAILED'))
  } finally {
    setManualWriting(false)
  }
  return saved
}

/** What a mod writing its save data said it edited from, by id. */
export interface ModWriteOptions {
  /** Per id, the value the caller edited from; the write is refused as stale once it is not the live one (`===`). */
  expect?: Readonly<Record<string, unknown>>
}

const WAIT_MESSAGE = 'Wait for the scene to settle.'
const STALE_MESSAGE = 'The game changed. Reopen this and try again.'

/** A refused mod write. */
function refused<T = null>(code: string, message: string): Result<T> {
  return { ok: false, error: appError(code, message) }
}

/** The live value of `modId`'s save field, as its handle reads it: the stored value, or the field's `empty`. */
function liveValueOf(modId: string): unknown {
  const values = useGameStore.getState().modValues
  return Object.hasOwn(values, modId) ? values[modId] : saveFields().get(modId)?.empty
}

/** The first id whose live value is no longer the one `expect` names, or undefined. */
function staleIn(expect: Readonly<Record<string, unknown>> | undefined): string | undefined {
  return Object.keys(expect ?? {}).find((id) => liveValueOf(id) !== expect?.[id])
}

/** `draft` with `next` written into its mods' data as the store writes it, every other slice kept. */
function withModValues(draft: SaveDraft, next: Readonly<Record<string, unknown>>): SaveDraft {
  return { ...draft, ex: slicesWith(draft.ex ?? {}, next) }
}

/**
 * A mod's edit to its own save data, and to that of the mods it requires: written over the
 * autosave at a safe point, behind every write already queued, and taken into the live game only
 * once it is on disk. Refused, writing nothing, when an id is another mod's, the mod is off, no
 * game is loaded, a value it edited from has moved, or the loop is not at a point a save can be
 * taken at. Never throws.
 */
export async function writeModSlices(
  modId: string,
  next: Readonly<Record<string, unknown>>,
  options: ModWriteOptions = {}
): Promise<Result<null>> {
  try {
    const allowed = new Set([modId, ...(modById(modId)?.requires ?? [])])
    const foreign = Object.keys(next).find((id) => !allowed.has(id))
    if (foreign !== undefined) {
      return refused('MOD_WRITE_FOREIGN', `${modId} cannot write the save data of ${foreign}.`)
    }
    if (!modIsOn(modId, loopState.record)) return refused('MOD_WRITE_OFF', 'That mod is off.')
    const start = useGameStore.getState()
    const playthroughId = start.playthroughId
    if (!playthroughId) return refused('MOD_WRITE_NO_GAME', 'There is no game to save into.')
    if (staleIn(options.expect) !== undefined) return refused('MOD_WRITE_STALE', STALE_MESSAGE)
    if (manualSaveOffer() !== 'open') return refused('MOD_WRITE_WAIT', WAIT_MESSAGE)
    const loads = start.loads
    const run = currentRun()
    const sameGame = (): boolean => {
      const game = useGameStore.getState()
      return !runStale(run) && game.playthroughId === playthroughId && game.loads === loads
    }

    setManualWriting(true)
    try {
      // A stay left before the write's turn skips it, which leaves this as the answer.
      let outcome: Result<null> = refused('MOD_WRITE_STALE', STALE_MESSAGE)
      await queueWrite(async () => {
        if (!sameGame() || staleIn(options.expect) !== undefined) return
        if (!modIsOn(modId, loopState.record)) {
          outcome = refused('MOD_WRITE_OFF', 'That mod is off.')
          return
        }
        if (saveOffer(false) !== 'open') {
          outcome = refused('MOD_WRITE_WAIT', WAIT_MESSAGE)
          return
        }
        const game = useGameStore.getState()
        const base = manualSaveDraft() ?? (sceneActiveOf(game) ? null : { ...game.toGameSave(), scene: null })
        if (!base) {
          outcome = refused('MOD_WRITE_WAIT', WAIT_MESSAGE)
          return
        }
        const result = await window.api.saves.autosave(playthroughId, withModValues(base, next))
        if (!result.ok) {
          outcome = { ok: false, error: result.error }
          return
        }
        outcome = { ok: true, data: null }
        if (!sameGame()) return
        // A capture taken before this transaction committed still has the old mod values.
        lastSavedOrder = ++nextAutosaveOrder
        useGameStore.setState((state) => ({ modValues: { ...state.modValues, ...next } }))
        if (loopState.statusBase) loopState.statusBase = withModValues(loopState.statusBase, next)
      })
      return outcome
    } finally {
      setManualWriting(false)
    }
  } catch (err) {
    return { ok: false, error: toAppError(err, 'SAVE_WRITE_FAILED') }
  }
}

/**
 * A scene field's `save`: refused, changing nothing, where there is no game, the mod is off, or
 * there is no scene to save into (none, or its ending being written, which writes its own save).
 * Otherwise the value goes on the store, and the field's keys are copied into the decision point,
 * the save a reload lands on, which is written behind every write queued before it. Core's later
 * writes of that point then carry the value too. Before the scene's first decision point, the
 * scene is written as it stands. Never throws.
 */
async function saveSceneField(modId: string, keys: readonly string[], apply: () => void): Promise<Result<null>> {
  try {
    const game = useGameStore.getState()
    if (!game.playthroughId) return refused('MOD_WRITE_NO_GAME', 'There is no game to save into.')
    if (!modIsOn(modId, loopState.record)) return refused('MOD_WRITE_OFF', 'That mod is off.')
    const ended = game.activeGameOver !== null || game.sceneEnding || game.endingInFlight
    if (ended || !sceneInProgress()) return refused('MOD_WRITE_NO_SCENE', 'There is no scene to save into.')
    apply()
    const point = loopState.decisionSave
    let scene: SceneState | null
    if (point) {
      const mods = modSceneWith(point.mods, keys, useGameStore.getState().sceneMods)
      const { mods: _old, ...rest } = point
      scene = mods ? { ...rest, mods } : rest
      loopState.decisionSave = scene
    } else scene = useGameStore.getState().captureScene()
    // Never null with a scene in progress; a null here would write the scene out of the save.
    if (!scene) return refused('MOD_WRITE_NO_SCENE', 'There is no scene to save into.')
    // Left as the answer where the write is skipped: the game was left before its turn.
    let outcome: Result<null> = refused('MOD_WRITE_STALE', STALE_MESSAGE)
    await writeAutosave(scene, (result) => {
      outcome = result
    })
    return outcome
  } catch (err) {
    return { ok: false, error: toAppError(err, 'SAVE_WRITE_FAILED') }
  }
}

bindSceneFieldSaves({ save: saveSceneField })

/**
 * Writes what a mod changed in the game (its slices, its records, the comments and memories it
 * added) to disk now, rather than with the loop's next save: over the autosave, behind every write
 * already queued, at the last decision point of a scene in progress or with no scene outside one.
 * While a scene is not at a decision point (a line playing, a reply streaming, its ending being
 * written) nothing is written now, and the answer is `deferred`: the loop's own next save carries
 * the change, since every save is taken from the live game. `written` once the save is on disk.
 * Refused, writing nothing, with `MOD_WRITE_OFF`, `MOD_WRITE_NO_GAME` (none, or one that is over),
 * `MOD_WRITE_STALE` (`run` left, or the game left before the write's turn), or the disk's own
 * error. Never throws.
 */
export async function saveChanges(
  modId: string,
  options: { run?: object } = {}
): Promise<Result<'written' | 'deferred'>> {
  try {
    if (!modIsOn(modId, loopState.record)) return refused('MOD_WRITE_OFF', 'That mod is off.')
    const game = useGameStore.getState()
    if (!game.playthroughId || game.activeGameOver !== null) {
      return refused('MOD_WRITE_NO_GAME', 'There is no game to save into.')
    }
    if (options.run !== undefined && runStale(options.run)) return refused('MOD_WRITE_STALE', STALE_MESSAGE)
    let scene: SceneState | null = null
    if (sceneInProgress()) {
      const atDecision = game.awaitingInput && !game.sceneEnding && !game.endingInFlight
      if (!atDecision || !loopState.decisionSave) return { ok: true, data: 'deferred' }
      scene = loopState.decisionSave
    }
    // Left as the answer where the write is skipped: the game was left before its turn.
    let outcome: Result<'written' | 'deferred'> = refused('MOD_WRITE_STALE', STALE_MESSAGE)
    await writeAutosave(scene, (result) => {
      outcome = result.ok ? { ok: true, data: 'written' } : result
    })
    return outcome
  } catch (err) {
    return { ok: false, error: toAppError(err, 'SAVE_WRITE_FAILED') }
  }
}

// What a mod's `writeModField` and `safePoint` reach.
bindModWrites({
  write: (modId, next, options) => writeModSlices(modId, next, options),
  safePoint: manualSaveOffer,
  subscribe: (onChange) => {
    const stores = [useGameStore.subscribe(onChange), useBunnyboardStore.subscribe(onChange)]
    lockWatchers.add(onChange)
    return () => {
      for (const unsubscribe of stores) unsubscribe()
      lockWatchers.delete(onChange)
    }
  }
})
