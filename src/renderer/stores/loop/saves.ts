import { payableShift } from './jobs'
import { TALENTS, buyTalent, transferSavings, normalizeTalents } from '@shared/campusTalents'
import { applyTalentChoice, type TalentChange } from '../talentActions'
import { buyTraining } from '@shared/talentTrading'
import { normalizeReckoning, type ReckoningState } from '@shared/reckoning'
import type { CharacterDynamics } from '@shared/characterDynamics'
import { assertEchoEdit, normalizeEcho, type EchoState } from '@shared/echo'
import { normalizeStoryMemory, type StoryMemory } from '@shared/storyMemory'
import { appError, toAppError } from '@shared/errors'
import { PLOT_TWIST_MOD, validatePlotTwist } from '@shared/plotTwists'
import { modIsOn } from '../modsStore'
import { normalizeWhisper, VENUS_WHISPER_MOD, type VenusWhisper } from '@shared/venusWhisper'
import { reconcileTalentBreakthrough } from '@shared/talentAbilities'
import { withMeanwhile, type MeanwhileScene } from '@shared/meanwhile'
import type { Conversation } from '@shared/types'
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
import { isGraduationSlot } from '../../prompts/graduation'
import { useBunnyboardStore } from '../bunnyboardStore'
import { PORTRAIT_SLOTS, useGameStore } from '../gameStore'
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

/** A manual save is being written; a second one waits for it. */
let manualWriting = false

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

/** Persist a replacement before exposing it to scene prompts, in the native save write lane. */
export async function persistRegeneratedConversation(
  charId: string, conversation: Conversation, isCurrent: () => boolean
): Promise<Result<null>> {
  let outcome: Result<null> = { ok: false, error: appError('TEXT_REGEN_STALE', 'The game changed. Your original reply was kept.') }
  try {
    await queueWrite(async () => {
      if (!isCurrent()) return
      const game = useGameStore.getState()
      if (!game.playthroughId || sceneActiveOf(game)) return
      const next = { ...conversation, unread: game.bunnyboard.conversations[charId].unread }
      const draft = { ...game.toGameSave(), scene: null,
        bunnyboard: { ...game.bunnyboard, conversations: { ...game.bunnyboard.conversations, [charId]: next } }
      }
      const result = await window.api.saves.autosave(game.playthroughId, draft)
      if (!isCurrent()) return
      if (!result.ok) { outcome = result; return }
      useGameStore.setState(s => ({ bunnyboard: { ...s.bunnyboard, conversations: {
        ...s.bunnyboard.conversations, [charId]: { ...next, unread: s.bunnyboard.conversations[charId].unread }
      } } }))
      outcome = { ok: true, data: null }
    })
  } catch (error) { outcome = { ok: false, error: toAppError(error, 'SAVE_WRITE_FAILED') } }
  return outcome
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

/**
 * Overwrites the autosave, recording `scene` in place of what is on screen now. The save is taken
 * as the write's turn comes, and the stage picture is drawn off `scene` after it.
 */
export function writeAutosave(scene: SceneState | null): Promise<void> {
  return queueWrite(async () => {
    const game = useGameStore.getState()
    const playthroughId = game.playthroughId
    if (!playthroughId) return
    const draft: SaveDraft = { ...game.toGameSave(), scene,
      // Project discarded outcomes and their recorded charges onto the same decision point.
      ...reconcileTalentBreakthrough(game, scene?.transcript ?? [],
        scene && !game.replaying && !game.createdScene ? game.currentSceneTranscript : undefined)
    }

    const thumbnail = scene ? await composeStageThumbnail(scene) : null
    const result = await window.api.saves.autosave(
      playthroughId,
      thumbnail ? { ...draft, thumbnail } : draft
    )
    if (!result.ok) reportWriteFailure(result.error)
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
 * onto the log: `base` was captured before it was logged.
 */
export function queuedScene(
  base: SceneState | null,
  lines: SceneLine[],
  extra: Partial<SceneState> = {}
): SceneState {
  const game = useGameStore.getState()
  const from = base ?? openingScene([])
  const scene: SceneState = {
    ...from,
    cast: [...game.cast],
    transcript: [...game.currentSceneTranscript],
    summary: game.sceneSummary,
    sceneLog: withReaderAction(from.sceneLog, game.currentSceneTranscript),
    pendingLines: lines,
    ...extra
  }
  // Set-or-delete, like the kinds below: the marks are the store's, never the base's.
  if (game.sceneSummaries.length > 0) {
    scene.summaries = game.sceneSummaries.map((mark) => ({ ...mark }))
  } else delete scene.summaries
  if (game.scenePresetVars.length > 0) {
    scene.presetVarMarks = game.scenePresetVars.map((mark) => ({ at: mark.at, before: { ...mark.before } }))
  } else delete scene.presetVarMarks
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
  const shift = payableShift(loopState.jobShift)
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

/** Rechecked by an editor at its write turn, excluding only its own write lock. */
function saveOffer(manualInProgress: boolean): ManualSaveOffer {
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

  manualWriting = true
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
    manualWriting = false
  }
  return saved
}

/**
 * Save a twist and a native, resumable checkpoint in the same write lane as the loop.
 * The live value changes only after a successful disk/IndexedDB write. In particular, a
 * failed write must not leak an unsaved twist into a later scene request or autosave.
 */
export async function writePlotTwist(value: string): Promise<Result<null>> {
  const validated = validatePlotTwist(value)
  if (!validated.ok) return validated
  const unavailable = (): Result<null> => ({
    ok: false,
    error: appError('PLOT_TWIST_WAIT', 'Wait for the scene to settle and enable Plot Twist before applying it.')
  })
  if (!modIsOn(PLOT_TWIST_MOD) || manualSaveOffer() !== 'open') return unavailable()
  const game = useGameStore.getState()
  const playthroughId = game.playthroughId
  const run = currentRun()
  const sameGame = (): boolean => {
    const now = useGameStore.getState()
    return !runStale(run) && now.playthroughId === playthroughId && now.loads === game.loads
  }
  let outcome: Result<null> = {
    ok: false,
    error: appError('PLOT_TWIST_STALE', 'The loaded game changed. Reopen Plot Twist before trying again.')
  }
  manualWriting = true
  try {
    await queueWrite(async () => {
      if (!sameGame()) return
      if (!modIsOn(PLOT_TWIST_MOD) || saveOffer(false) !== 'open') {
        outcome = unavailable()
        return
      }
      const now = useGameStore.getState()
      // Use the ending/status checkpoint when there is one. Only a true landing may
      // fall back to a scene-less save; never manufacture a mid-scene checkpoint.
      const base = manualSaveDraft() ?? (!sceneActiveOf(now) ? { ...now.toGameSave(), scene: null } : null)
      if (!playthroughId || !base) {
        outcome = unavailable()
        return
      }
      const result = await window.api.saves.autosave(playthroughId, {
        ...base,
        exPlotTwist: validated.data
      })
      if (!sameGame()) return
      if (!result.ok) {
        outcome = result
        return
      }
      // Status playback can save from a frozen pre-status draft. Carry this edit there
      // too, without advancing or replaying any of its stats, ledger, or pending lines.
      if (loopState.statusBase) {
        loopState.statusBase = { ...loopState.statusBase, exPlotTwist: validated.data }
      }
      useGameStore.setState({ exPlotTwist: validated.data })
      outcome = { ok: true, data: null }
    })
  } catch (error) {
    if (sameGame()) outcome = { ok: false, error: toAppError(error, 'SAVE_WRITE_FAILED') }
  } finally {
    manualWriting = false
  }
  return outcome
}

/** Newsletter edits join the native save lane, preserving the current scene checkpoint. */
export async function writeWhisper(next: VenusWhisper, previous: VenusWhisper, active: () => boolean): Promise<void> {
  const start = useGameStore.getState()
  const current = (): boolean => {
    const now = useGameStore.getState()
    return active() && modIsOn(VENUS_WHISPER_MOD) && now.playthroughId === start.playthroughId && now.loads === start.loads &&
      now.exVenusWhisper === previous && now.date === start.date && now.time === start.time && !now.sceneEnding
  }
  if (!current() || manualSaveOffer() !== 'open') throw Error('Wait for a safe save point.')
  let written = false
  manualWriting = true
  try {
    await queueWrite(async () => {
      if (!current() || saveOffer(false) !== 'open') return
      const now = useGameStore.getState()
      const draft = manualSaveDraft() ?? (!sceneActiveOf(now) ? { ...now.toGameSave(), scene: null } : null)
      if (!draft || !now.playthroughId) throw Error('No safe save point is available.')
      const saved = normalizeWhisper(next)
      const result = await window.api.saves.autosave(now.playthroughId, { ...draft, exVenusWhisper: saved })
      if (!result.ok) throw Error(result.error.message)
      if (!current()) return
      if (loopState.statusBase) loopState.statusBase = { ...loopState.statusBase, exVenusWhisper: saved }
      useGameStore.setState({ exVenusWhisper: saved })
      written = true
    })
    if (!written) throw Error('The game changed. Reopen the newsletter.')
  } finally { manualWriting = false }
}

/** The edit joins the game's write lane; disk succeeds before visible state is changed. */
export async function writeStoryMemory(next: StoryMemory, expected: { playthroughId: string; loads: number; previous: StoryMemory }): Promise<void> {
  const game = useGameStore.getState()
  const fresh = (): boolean => {
    const live = useGameStore.getState()
    return live.playthroughId === expected.playthroughId && live.loads === expected.loads && live.exStoryMemory === expected.previous && modIsOn('story-memory')
  }
  if (!fresh() || manualSaveOffer() !== 'open' || game.sceneEnding) throw Error('Wait until narration and messages have finished before editing memory.')
  const draft = manualSaveDraft() ?? { ...game.toGameSave(), scene: null }
  const memory = normalizeStoryMemory(next)
  let written = false
  manualWriting = true
  try {
    await queueWrite(async () => {
      if (!fresh()) return
      const result = await window.api.saves.autosave(expected.playthroughId, { ...draft, exStoryMemory: memory })
      if (!result.ok) throw Error(result.error.message)
      written = true
      if (fresh()) useGameStore.setState({ exStoryMemory: memory })
    })
    if (!written) throw Error('The playthrough changed. Reopen Story Memory to edit this save.')
  } finally { manualWriting = false }
}

/** Cache a spectator scene without ever inserting it into canonical history or memories. */
export async function persistMeanwhileScene(scene: MeanwhileScene, isCurrent: () => boolean): Promise<void> {
  let completed = false
  await queueWrite(async () => {
    if (!isCurrent() || manualSaveOffer() !== 'open') return
    const game = useGameStore.getState()
    const draft = manualSaveDraft() ?? (!sceneActiveOf(game) ? { ...game.toGameSave(), scene: null } : null)
    if (!draft || !game.playthroughId) throw Error('No safe save point is available yet.')
    const next = withMeanwhile(game.exNpcWatch,scene)
    const result = await window.api.saves.autosave(game.playthroughId,{ ...draft, exNpcWatch: next })
    if (!result.ok) throw Error(result.error.message)
    if (!isCurrent()) return
    useGameStore.setState({ exNpcWatch: next })
    completed = true
  })
  if (!completed) throw Error('The game changed. Reopen Meanwhile to view saved conversations.')
}

/** Echo edits share the native save queue and reject stale playthroughs. */
export async function writeEcho(next: EchoState, previous: EchoState, active: () => boolean): Promise<void> {
  const start = useGameStore.getState()
  const ownsGame = (): boolean => {
    const now = useGameStore.getState()
    return now.playthroughId === start.playthroughId && now.loads === start.loads &&
      now.exEcho === previous && now.date === start.date && now.time === start.time && !now.sceneEnding
  }
  const current = (): boolean => active() && modIsOn('echo') && ownsGame()
  if (!current() || manualSaveOffer() !== 'open') throw Error('Wait for a safe save point.')
  const saved = normalizeEcho(next)
  assertEchoEdit(previous, saved)
  let written = false
  manualWriting = true
  try {
    await queueWrite(async () => {
      if (!current() || saveOffer(false) !== 'open') return
      const now = useGameStore.getState()
      const draft = manualSaveDraft() ?? (!sceneActiveOf(now) ? { ...now.toGameSave(), scene: null } : null)
      if (!draft || !now.playthroughId) throw Error('No safe save point is available.')
      assertEchoEdit(now.exEcho, saved)
      const result = await window.api.saves.autosave(now.playthroughId, { ...draft, exEcho: saved })
      if (!result.ok) throw Error(result.error.message)
      // Closing the editor cannot undo an acknowledged write. A different loaded game still wins.
      if (!ownsGame()) return
      if (loopState.statusBase) loopState.statusBase = { ...loopState.statusBase, exEcho: saved }
      useGameStore.setState({ exEcho: saved })
      written = true
    })
    if (!written) throw Error('The game changed. Reopen the Echo.')
  } finally {
    manualWriting = false
  }
}

/** Purchases and savings join the native queue; a failed write spends nothing. */
export async function writeTalentChange(action: TalentChange): Promise<void> {
  const start=useGameStore.getState()
  const owns=():boolean=>{
    const now=useGameStore.getState()
    return now.playthroughId===start.playthroughId && now.loads===start.loads && now.date===start.date && now.time===start.time && now.semesterIndex===start.semesterIndex && now.stats===start.stats && now.exTalents===start.exTalents && now.money===start.money && now.charInfo===start.charInfo && now.classRecords===start.classRecords && now.currentSceneTranscript===start.currentSceneTranscript
  }
  const available=():boolean=>owns() && modIsOn('campus-talents') && !start.replaying && !start.createdScene && !start.sceneEnding && !start.statusShown
  if (!available() || manualSaveOffer()!=='open') throw Error('Wait until the scene or messages have finished before spending points.')
  let written=false
  manualWriting=true
  try {
    await queueWrite(async()=>{
      if (!available() || saveOffer(false)!=='open') return
      const now=useGameStore.getState()
      const draft=manualSaveDraft() ?? (!sceneActiveOf(now)?{...now.toGameSave(),scene:null}:null)
      if (!draft || !now.playthroughId) throw Error('No safe save point is available.')
      let exTalents=normalizeTalents(now.exTalents), money=now.money, stats=now.stats
      if ('skill' in action) {
        exTalents=buyTalent(exTalents,action.skill,modIsOn)
        if ((TALENTS.find(d=>d.id===action.skill)?.effects?.savingsRate?.length??0)>0) exTalents={...exTalents,savingsDay:now.date,savingsSeen:now.date,savingsTerm:now.semesterIndex,reserveFloor:exTalents.reserve}
      } else if ('transfer' in action) {
        const moved=transferSavings(exTalents,money,action.transfer)
        exTalents=moved.talents; money=moved.money
        if (now.exTalents.reserve===0) exTalents={...exTalents,savingsDay:now.date,savingsSeen:now.date,savingsTerm:now.semesterIndex,reserveFloor:exTalents.reserve}
      } else if ('train' in action) {
        if (now.sceneQuiz || now.sceneClass!==null || now.sceneProject!==null || now.sceneJob!==null) throw Error('Finish the class, project or work scene before training.')
        const trained=buyTraining(exTalents,stats,action.train,now.semesterIndex,now.date)
        exTalents=trained.talents; stats=trained.stats
      } else exTalents=applyTalentChoice(now,exTalents,action)
      const result=await window.api.saves.autosave(now.playthroughId,{...draft,exTalents,money,stats})
      if (!result.ok) throw Error(result.error.message)
      if (!available()) return
      if (loopState.statusBase) loopState.statusBase={...loopState.statusBase,exTalents,money,stats}
      useGameStore.setState({exTalents,money,stats})
      written=true
    })
    if (!written) throw Error('The game changed. Reopen Skill trees and try again.')
  } finally { manualWriting=false }
}

/** One atomic save holds the spirit charge, round progress and earned Character Dynamics tag. */
export async function writeReckoningChange(
  next: ReckoningState,
  previous: ReckoningState,
  charge: 0 | 100,
  charId: string,
  dynamics: CharacterDynamics | undefined,
  active: () => boolean,
  sceneBeat?: SceneLine[]
): Promise<void> {
  const start = useGameStore.getState()
  const meterBefore = start.exBreakthrough
  const current = (): boolean => {
    const now = useGameStore.getState()
    return active() && now.exReckoning === previous && now.exBreakthrough === meterBefore &&
      now.exCharacterDynamics === start.exCharacterDynamics && now.playthroughId === start.playthroughId &&
      now.loads === start.loads && !now.sceneEnding
  }
  if (!current() || manualSaveOffer() !== 'open') throw Error('Wait for a safe save point.')
  const saved = normalizeReckoning(next)
  if (next.active && !saved.active) throw Error('The encounter could not be saved.')
  if (next.dungeon && !saved.dungeon) throw Error('The dungeon could not be saved.')
  const meter = meterBefore.meters[charId] ?? 0
  if (charge && meter < charge) throw Error('This encounter needs 100 spirit.')
  const breakthrough = charge
    ? { ...meterBefore, meters: { ...meterBefore.meters, [charId]: meter - charge } }
    : meterBefore
  const patch = {
    exReckoning: saved,
    exBreakthrough: breakthrough,
    ...(dynamics ? { exCharacterDynamics: dynamics } : {})
  }
  let written = false
  manualWriting = true
  try {
    await queueWrite(async () => {
      if (!current() || saveOffer(false) !== 'open') return
      const now = useGameStore.getState()
      const draft = manualSaveDraft() ?? (!sceneActiveOf(now) ? { ...now.toGameSave(), scene: null } : null)
      if (!draft || !now.playthroughId) throw Error('No safe save point is available.')
      const scene = sceneBeat?.length && draft.scene
        ? {
            ...draft.scene,
            transcript: [...now.currentSceneTranscript, ...sceneBeat],
            sceneLog: [...now.sceneLog, sceneBeat[0]],
            currentLine: sceneBeat[0],
            pendingLines: sceneBeat.slice(1),
            resumeOnLine: true as const
          }
        : draft.scene
      const result = await window.api.saves.autosave(now.playthroughId, { ...draft, ...patch, scene })
      if (!result.ok) throw Error(result.error.message)
      if (!current()) return
      if (loopState.statusBase) loopState.statusBase = { ...loopState.statusBase, ...patch }
      // Quit/switch-save writes this held checkpoint. Preserve the paid link's
      // unread lines there too, without marking them as already advanced.
      if (sceneBeat?.length && scene) loopState.decisionSave = scene
      useGameStore.setState({
        ...patch,
        ...(sceneBeat?.length && scene
          ? {
              currentSceneTranscript: scene.transcript,
              sceneLog: scene.sceneLog,
              currentLine: scene.currentLine,
              pendingLines: scene.pendingLines,
              awaitingInput: false,
              reread: 0
            }
          : {})
      })
      written = true
    })
    if (!written) throw Error('The game changed; reopen the encounter.')
  } finally {
    manualWriting = false
  }
}
