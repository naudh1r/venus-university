import { mkdir, readdir, rm, stat } from 'fs/promises'
import { appError, messageOf, toAppError } from '@shared/errors'
import {
  idsMissingFrom,
  replayIdOf,
  replayIdsOf,
  replaysToDelete,
  type SlotReplay
} from '@shared/replays'
import {
  assertManualSlot,
  assertSafePlaythroughId,
  assertSafeSaveId,
  atLocation,
  ENROLLMENT_NOT_FOUND,
  ENROLLMENT_READ,
  ENROLLMENT_UNREADABLE,
  groupSaveIds,
  listedSaveIds,
  manualSaveId,
  mintId,
  playthroughLabel,
  prunedSlotIds,
  RECORD_NOT_FOUND,
  RECORD_READ,
  RECORD_UNREADABLE,
  renamedRecord,
  SAFE_NUMERIC_ID,
  SAVE_NOT_FOUND,
  SAVE_READ,
  SAVE_UNREADABLE,
  stampEnrollment,
  stampRecord,
  stampSave,
  summaryOf,
  withPlaythroughName,
  type SaveIdGroups
} from '@shared/saveRules'
import {
  AUTOSAVE_ID,
  FIRST_SLOT,
  type AppError,
  type CreatedEnrollment,
  type CreatedPlaythrough,
  type Enrollment,
  type EnrollmentDraft,
  type GameSave,
  type PlaythroughDraft,
  type PlaythroughListing,
  type PlaythroughRecord,
  type PlaythroughSummary,
  type SaveDraft,
  type SaveEntry,
  type SaveReadResult
} from '@shared/types'
import {
  getEnrollmentPath,
  getPlaythroughPath,
  getPlaythroughRecordPath,
  getSaveFilePath,
  getSavesPath
} from '../paths'
import { readValidatedJson, writeAtomicJson } from './jsonFile'
import { deleteReplay, listReplayIds, writeReplay } from './replayService'

/** Saves, playthrough records and enrollments on disk; what each one must be is a shared rule. */

export { assertSafePlaythroughId }

/** Reads and validates a playthrough's record; a missing field is refused by name. */
export async function readPlaythroughRecord(playthroughId: string): Promise<PlaythroughRecord> {
  assertSafePlaythroughId(playthroughId)
  const path = getPlaythroughRecordPath(playthroughId)

  return readValidatedJson<PlaythroughRecord>(path, {
    ...RECORD_READ,
    unreadable: RECORD_UNREADABLE,
    onMissing: () => {
      throw appError(RECORD_NOT_FOUND.code, RECORD_NOT_FOUND.message, path)
    }
  })
}

/** Writes the record, stamping the version this build owns. */
async function writePlaythroughRecord(
  playthroughId: string,
  draft: PlaythroughDraft
): Promise<PlaythroughRecord> {
  const record = stampRecord(draft)
  await writeAtomicJson(getPlaythroughRecordPath(playthroughId), record, {
    code: 'PLAYTHROUGH_UNWRITABLE',
    message: 'Could not write the playthrough record.'
  })
  return record
}

/** Reads and validates one folder's enrollment; a missing field is refused by name. */
export async function readEnrollment(playthroughId: string): Promise<Enrollment> {
  assertSafePlaythroughId(playthroughId)
  const path = getEnrollmentPath(playthroughId)

  return readValidatedJson<Enrollment>(path, {
    ...ENROLLMENT_READ,
    unreadable: ENROLLMENT_UNREADABLE,
    onMissing: () => {
      throw appError(ENROLLMENT_NOT_FOUND.code, ENROLLMENT_NOT_FOUND.message, path)
    }
  })
}

/** A parsed save, with the size and write time of the file it was read from or written to. */
interface ParsedSave {
  mtimeMs: number
  size: number
  save: GameSave
}

/** What the parse cache may hold, counted in the bytes of the files behind it. */
const PARSED_BUDGET_BYTES = 64 * 1024 * 1024

/**
 * Parsed saves by path, least recently used first. A save in it is handed to every reader as
 * the same object, so nothing may change one.
 */
const parsed = new Map<string, ParsedSave>()
let parsedBytes = 0

/** Save writes begun since launch, and the writes running now by path. */
let writesBegun = 0
const writesRunning = new Map<string, number>()

/** A file's size and write time, or `null` where it cannot be read. */
async function stampOf(path: string): Promise<{ mtimeMs: number; size: number } | null> {
  return stat(path)
    .then(({ mtimeMs, size }) => ({ mtimeMs, size }))
    .catch(() => null)
}

/** Drops the parsed save kept for one path. */
function forgetParsed(path: string): void {
  const entry = parsed.get(path)
  if (!entry) return
  parsed.delete(path)
  parsedBytes -= entry.size
}

/** Empties the parse cache, for when the saves folder is replaced under it. */
export function forgetParsedSaves(): void {
  parsed.clear()
  parsedBytes = 0
}

/** Keeps one parsed save as the most recent, dropping the least recent past the budget. */
function rememberParsed(path: string, entry: ParsedSave): void {
  forgetParsed(path)
  if (entry.size > PARSED_BUDGET_BYTES) return
  parsed.set(path, entry)
  parsedBytes += entry.size
  for (const [oldest, { size }] of parsed) {
    if (parsedBytes <= PARSED_BUDGET_BYTES) break
    parsed.delete(oldest)
    parsedBytes -= size
  }
}

/**
 * Marks a write to `path` begun and drops its parsed save; answers the mark the write checks
 * before priming the cache, or `null` when another write to the same file is already running.
 */
function beginWrite(path: string): number | null {
  const alone = !writesRunning.has(path)
  writesBegun += 1
  writesRunning.set(path, (writesRunning.get(path) ?? 0) + 1)
  forgetParsed(path)
  return alone ? writesBegun : null
}

/** Marks a write to `path` finished. */
function endWrite(path: string): void {
  const left = (writesRunning.get(path) ?? 1) - 1
  if (left > 0) writesRunning.set(path, left)
  else writesRunning.delete(path)
}

/**
 * Whether no save write has begun since `mark` and only `own` writes to `path` are running —
 * the condition for keeping what a read or write of it parsed.
 */
function unchallenged(path: string, mark: number | null, own: number): boolean {
  return mark === writesBegun && (writesRunning.get(path) ?? 0) === own
}

/**
 * Reads and validates one save file; a missing field is refused by name. A file whose size and
 * write time are what they were when it was last parsed here is not read again.
 */
export async function loadSave(playthroughId: string, saveId: string): Promise<GameSave> {
  assertSafePlaythroughId(playthroughId)
  assertSafeSaveId(saveId)
  const path = getSaveFilePath(playthroughId, saveId)

  const mark = writesRunning.has(path) ? null : writesBegun
  const stamp = await stampOf(path)
  const cached = parsed.get(path)
  if (stamp && cached && cached.mtimeMs === stamp.mtimeMs && cached.size === stamp.size) {
    rememberParsed(path, cached)
    return cached.save
  }
  forgetParsed(path)

  const candidate = await readValidatedJson<GameSave>(path, {
    ...SAVE_READ,
    unreadable: SAVE_UNREADABLE,
    onMissing: () => {
      throw appError(SAVE_NOT_FOUND.code, SAVE_NOT_FOUND.message, path)
    }
  })

  // Location on disk wins over what the file carries.
  const save = atLocation(candidate, playthroughId, saveId)
  if (stamp && unchallenged(path, mark, 0)) rememberParsed(path, { ...stamp, save })
  return save
}

/** A file's modification time — what stands in for `saveDate` when the file cannot be read. */
async function mtimeOf(path: string): Promise<number> {
  return stat(path).then((info) => info.mtimeMs).catch(() => 0)
}

/** Save ids ordered by when each file was last written, newest first; a tie keeps their order. */
async function newestWrittenFirst(playthroughId: string, saveIds: string[]): Promise<string[]> {
  const written = await Promise.all(
    saveIds.map(async (saveId) => ({
      saveId,
      at: await mtimeOf(getSaveFilePath(playthroughId, saveId))
    }))
  )
  return written.sort((a, b) => b.at - a.at).map(({ saveId }) => saveId)
}

/** The save ids in one playthrough folder by kind; a file no save is written under is skipped. */
export async function saveIdsOf(playthroughId: string): Promise<SaveIdGroups> {
  let entries: string[]
  try {
    entries = await readdir(getPlaythroughPath(playthroughId))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { autosave: false, slots: [], manual: [] }
    }
    throw appError('SAVES_UNREADABLE', 'Could not read the playthrough folder.', messageOf(err))
  }

  return groupSaveIds(
    entries
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .map((entry) => entry.slice(0, -5))
  )
}

/** Every playthrough folder's id in creation order; with no saves folder there are none. */
export async function playthroughIds(): Promise<string[]> {
  let entries: Array<{ name: string; isDirectory: () => boolean }>
  try {
    entries = await readdir(getSavesPath(), { withFileTypes: true })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw appError('SAVES_UNREADABLE', 'Could not read the saves folder.', messageOf(err))
  }

  return entries
    .filter((entry) => entry.isDirectory() && SAFE_NUMERIC_ID.test(entry.name))
    .map((entry) => entry.name)
    // Folder names are mint timestamps, so numeric order is creation order.
    .sort((a, b) => Number(a) - Number(b))
}

/**
 * Lists every playthrough in creation order, each summarised from its newest readable save of
 * any kind; one with no readable save is listed with the reason instead, and one with no save
 * at all from the enrollment waiting in it. A folder holding neither is skipped.
 */
export async function listPlaythroughs(): Promise<PlaythroughSummary[]> {
  const ids = await playthroughIds()

  const summaries: PlaythroughSummary[] = []
  for (const playthroughId of ids) {
    const groups = await saveIdsOf(playthroughId)
    const saveIds = listedSaveIds(groups)

    const position = summaries.length + 1
    const base = {
      playthroughId,
      label: playthroughLabel(null, position),
      position,
      saveCount: groups.slots.length,
      manualCount: groups.manual.length,
      hasAutosave: groups.autosave
    }

    // Nothing has been played yet: the folder stands for the semester still at the registrar,
    // opening where every playthrough does, or for nothing at all.
    if (saveIds.length === 0) {
      try {
        const enrollment = await readEnrollment(playthroughId)
        summaries.push({
          ...base,
          enrolling: true,
          chars: enrollment.chars,
          date: FIRST_SLOT.date,
          time: FIRST_SLOT.time,
          savedAt: enrollment.savedAt,
          unloadable: null
        })
      } catch (err) {
        if ((err as AppError).code === 'ENROLLMENT_NOT_FOUND') continue
        summaries.push({
          ...base,
          enrolling: true,
          chars: [],
          date: FIRST_SLOT.date,
          time: FIRST_SLOT.time,
          savedAt: await mtimeOf(getPlaythroughPath(playthroughId)),
          unloadable: (err as AppError).message
        })
      }
      continue
    }

    // Everything the folder settled once; refused, nothing in it can be loaded.
    let record: PlaythroughRecord | null = null
    let reason = ''
    try {
      record = await readPlaythroughRecord(playthroughId)
    } catch (err) {
      reason = (err as AppError).message
    }
    const named = withPlaythroughName(base, record)

    let summary: PlaythroughSummary | null = null
    // Whichever file was written last stands for the playthrough, a manual save included.
    for (const saveId of await newestWrittenFirst(playthroughId, saveIds)) {
      try {
        const save = await loadSave(playthroughId, saveId)
        summary = {
          ...named,
          chars: record?.chars ?? [],
          date: save.date,
          time: save.time,
          savedAt: save.saveDate,
          // A refused record outranks a readable save: without it nothing resolves.
          unloadable: record ? null : reason
        }
        break
      } catch (err) {
        if (!reason) reason = (err as AppError).message
      }
    }
    summaries.push(
      summary ?? {
        ...named,
        chars: [],
        date: 0,
        time: 0,
        savedAt: await mtimeOf(getPlaythroughPath(playthroughId)),
        unloadable: reason
      }
    )
  }

  return summaries
}

/**
 * Lists one playthrough's saves — the autosave, the boundary saves newest-first, then the
 * manual saves by slot — with the record they are read against, each summarised, or carrying
 * its error where the file was refused.
 */
export async function listSaves(playthroughId: string): Promise<PlaythroughListing> {
  assertSafePlaythroughId(playthroughId)
  const saveIds = listedSaveIds(await saveIdsOf(playthroughId))

  let record: PlaythroughRecord | null = null
  let error: AppError | null = null
  try {
    record = await readPlaythroughRecord(playthroughId)
  } catch (err) {
    error = err as AppError
  }

  const saves: SaveEntry[] = []
  for (const saveId of saveIds) {
    try {
      const save = await loadSave(playthroughId, saveId)
      saves.push({ saveId, savedAt: save.saveDate, summary: summaryOf(save), error: null })
    } catch (err) {
      saves.push({
        saveId,
        savedAt: await mtimeOf(getSaveFilePath(playthroughId, saveId)),
        summary: null,
        error: err as AppError
      })
    }
  }

  return { record, error, saves }
}

/** One save with the record it is read against: everything loading it needs. */
export async function readSave(playthroughId: string, saveId: string): Promise<SaveReadResult> {
  const record = await readPlaythroughRecord(playthroughId)
  const save = await loadSave(playthroughId, saveId)
  return { record, save }
}

/** Creates the folder for a write, turning a failure into one clear error. */
async function ensureFolder(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch (err) {
    throw appError(
      'SAVE_UNWRITABLE',
      'Could not create the saves folder.',
      `${dir}: ${messageOf(err)}`
    )
  }
}

/** Writes one save atomically, stamping the fields this service owns. */
async function writeSaveFile(
  playthroughId: string,
  saveId: string,
  draft: SaveDraft
): Promise<GameSave> {
  const next = stampSave(draft, playthroughId, saveId, Date.now())
  const path = getSaveFilePath(playthroughId, saveId)

  const mark = beginWrite(path)
  try {
    // The minting paths call `ensureFolder`; the write itself never makes the folder.
    await writeAtomicJson(path, next, {
      code: 'SAVE_UNWRITABLE',
      message: 'Could not write the save file.'
    })
    // Primed here rather than left to the next read: two writes of one file inside a
    // millisecond at the same length leave a stamp a read alone could not tell apart.
    const stamp = await stampOf(path)
    if (stamp && unchallenged(path, mark, 1)) rememberParsed(path, { ...stamp, save: next })
  } finally {
    endWrite(path)
  }

  return next
}

/** Mints the next free playthrough id and creates the empty folder it names. */
async function mintPlaythroughFolder(): Promise<string> {
  const root = getSavesPath()
  await ensureFolder(root)

  const existing = new Set(await readdir(root).catch(() => [] as string[]))
  const playthroughId = mintId(existing)
  await ensureFolder(getPlaythroughPath(playthroughId))
  return playthroughId
}

/**
 * Writes a semester that has no timetable yet into a folder of its own, so the registrar
 * offering it can be left and come back to.
 */
export async function writeEnrollment(draft: EnrollmentDraft): Promise<CreatedEnrollment> {
  const playthroughId = await mintPlaythroughFolder()
  const enrollment = stampEnrollment(draft, Date.now())
  await writeAtomicJson(getEnrollmentPath(playthroughId), enrollment, {
    code: 'ENROLLMENT_UNWRITABLE',
    message: 'Could not write the class registration.'
  })
  return { playthroughId, enrollment }
}

/**
 * The record is written before the save: a save without a record can't be loaded, while a
 * record without a save sits in a folder the listing skips.
 */
export async function createPlaythrough(
  playthrough: PlaythroughDraft,
  draft: SaveDraft,
  playthroughId?: string
): Promise<CreatedPlaythrough> {
  let folder: string
  if (playthroughId === undefined) {
    folder = await mintPlaythroughFolder()
  } else {
    assertSafePlaythroughId(playthroughId)
    folder = playthroughId
    // Load Game may have deleted the folder while the registrar stood open.
    await ensureFolder(getPlaythroughPath(folder))
  }

  const record = await writePlaythroughRecord(folder, playthrough)
  const save = await writeSaveFile(folder, folder, draft)
  // The playthrough is complete either way, and the listing reads an enrollment only in a
  // folder with no save in it.
  await rm(getEnrollmentPath(folder), { force: true }).catch((err: unknown) => {
    console.warn('[saves] the class registration could not be removed', err)
  })
  return { record, save }
}

/** Each playthrough's save writes and deletes still to settle, as the tail of one chain. */
const turns = new Map<string, Promise<void>>()

/**
 * Runs `run` once every save write or delete queued before it on the same playthrough has
 * settled, so no replay scan reads a folder another of them is changing.
 */
function inTurn<T>(playthroughId: string, run: () => Promise<T>): Promise<T> {
  const result = (turns.get(playthroughId) ?? Promise.resolve()).then(run)
  const settled = result.then(
    () => undefined,
    () => undefined
  )
  turns.set(playthroughId, settled)
  void settled.then(() => {
    if (turns.get(playthroughId) === settled) turns.delete(playthroughId)
  })
  return result
}

/** The replay ids one save names; a save that is gone or cannot be read names none. */
async function replayIdsIn(playthroughId: string, saveId: string): Promise<Set<string>> {
  try {
    return replayIdsOf((await loadSave(playthroughId, saveId)).replays)
  } catch {
    return new Set()
  }
}

/**
 * Deletes each of `dropped` that no save left in the playthrough names and `keep` does not hold,
 * and with them any other replay file no save names. A save that cannot be read might name any
 * of them, so then nothing is deleted; a failure here costs a stray file, never the write before.
 */
async function dropReplays(
  playthroughId: string,
  dropped: readonly string[],
  keep: readonly string[] = []
): Promise<void> {
  if (dropped.length === 0) return
  try {
    const files = await listReplayIds(playthroughId)
    const onDisk = new Set(files)
    if (!dropped.some((id) => onDisk.has(id) && !keep.includes(id))) return

    const named: Set<string>[] = []
    for (const saveId of listedSaveIds(await saveIdsOf(playthroughId))) {
      try {
        named.push(replayIdsOf((await loadSave(playthroughId, saveId)).replays))
      } catch (err) {
        const error = toAppError(err)
        if (error.code === SAVE_NOT_FOUND.code) continue
        console.warn(
          `[saves] ${playthroughId}/${saveId} could not be read, so no replay is deleted:`,
          error.message
        )
        return
      }
    }
    for (const replayId of replaysToDelete(files, named, keep)) {
      await deleteReplay(playthroughId, replayId)
    }
  } catch (err) {
    console.warn(
      `[saves] the replays of ${playthroughId} could not be tidied:`,
      toAppError(err).message
    )
  }
}

/**
 * Writes the slot-boundary save: mints a new id and prunes the slot saves back to their window.
 * A `replay` the draft names is written first, and a replay only the pruned saves named goes.
 * The autosave stands: it is the last decision point reached, and only the next one replaces it.
 */
export async function writeSlotSave(
  playthroughId: string,
  draft: SaveDraft,
  replay?: SlotReplay
): Promise<GameSave> {
  assertSafePlaythroughId(playthroughId)
  return inTurn(playthroughId, async () => {
    await ensureFolder(getPlaythroughPath(playthroughId))
    const named = replayIdsOf(draft.replays)

    let written: string | null = null
    if (replay) {
      const replayId = replayIdOf(replay)
      if (named.has(replayId)) {
        written = await writeReplay(playthroughId, replay)
      } else {
        console.warn(`[saves] a replay the save does not name was left unwritten: ${replayId}`)
      }
    }

    const { slots } = await saveIdsOf(playthroughId)
    let saved: GameSave
    try {
      saved = await writeSaveFile(playthroughId, mintId(new Set(slots)), draft)
    } catch (err) {
      if (written) await dropReplays(playthroughId, [written])
      throw err
    }

    // `slots` was read before this write, so the window is what the new save pushes out of it.
    const dropped: string[] = []
    for (const stale of prunedSlotIds(slots)) {
      dropped.push(...(await replayIdsIn(playthroughId, stale)))
      const path = getSaveFilePath(playthroughId, stale)
      await rm(path, { force: true })
      forgetParsed(path)
    }
    await dropReplays(playthroughId, idsMissingFrom(dropped, named))

    return saved
  })
}

/** Writes one save over whatever its file held, then drops the replays only the old one named. */
async function rewriteSave(
  playthroughId: string,
  saveId: string,
  draft: SaveDraft
): Promise<GameSave> {
  const before = await replayIdsIn(playthroughId, saveId)
  const saved = await writeSaveFile(playthroughId, saveId, draft)
  await dropReplays(playthroughId, idsMissingFrom(before, replayIdsOf(saved.replays)))
  return saved
}

/** Rewrites an existing slot-save in place. */
export async function overwriteSlotSave(
  playthroughId: string,
  saveId: string,
  draft: SaveDraft
): Promise<GameSave> {
  assertSafePlaythroughId(playthroughId)
  assertSafeSaveId(saveId)
  return inTurn(playthroughId, async () => {
    const { slots } = await saveIdsOf(playthroughId)
    if (!slots.includes(saveId)) {
      throw appError('SAVE_NOT_FOUND', 'That save no longer exists.', `${playthroughId}/${saveId}`)
    }
    return rewriteSave(playthroughId, saveId, draft)
  })
}

/** Overwrites the scene-in-progress save. Never pruned, never counted against the window. */
export async function writeAutosave(playthroughId: string, draft: SaveDraft): Promise<GameSave> {
  assertSafePlaythroughId(playthroughId)
  return inTurn(playthroughId, async () => {
    await ensureFolder(getPlaythroughPath(playthroughId))
    return rewriteSave(playthroughId, AUTOSAVE_ID, draft)
  })
}

/**
 * Writes the player's own save into one manual slot, replacing whatever it held. Mints
 * nothing, prunes nothing and leaves the autosave alone.
 */
export async function writeManualSave(
  playthroughId: string,
  slot: number,
  draft: SaveDraft
): Promise<GameSave> {
  assertSafePlaythroughId(playthroughId)
  assertManualSlot(slot)
  return inTurn(playthroughId, async () => {
    await ensureFolder(getPlaythroughPath(playthroughId))
    return rewriteSave(playthroughId, manualSaveId(slot), draft)
  })
}

/**
 * Deletes one save file, and every replay it named that no other save names and `keep` does not
 * hold. Already-gone is success, not an error.
 */
export async function deleteSave(
  playthroughId: string,
  saveId: string,
  keep: readonly string[] = []
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafeSaveId(saveId)
  return inTurn(playthroughId, async () => {
    const before = await replayIdsIn(playthroughId, saveId)
    const path = getSaveFilePath(playthroughId, saveId)
    try {
      await rm(path, { force: true })
      forgetParsed(path)
    } catch (err) {
      throw appError('SAVE_UNDELETABLE', 'Could not delete the save file.', messageOf(err))
    }
    await dropReplays(playthroughId, [...before], keep)
  })
}

/**
 * Gives a playthrough the player's own name, or takes it away where the name is blank: the
 * record is read and checked, then written back with that one field changed.
 */
export async function renamePlaythrough(playthroughId: string, name: string): Promise<void> {
  const { schemaVersion: _stamped, ...draft } = renamedRecord(
    await readPlaythroughRecord(playthroughId),
    name
  )
  await writePlaythroughRecord(playthroughId, draft)
}

/** Deletes a whole playthrough folder and every save in it. */
export async function deletePlaythrough(playthroughId: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  try {
    await rm(getPlaythroughPath(playthroughId), { recursive: true, force: true })
  } catch (err) {
    throw appError('PLAYTHROUGH_UNDELETABLE', 'Could not delete the playthrough.', messageOf(err))
  }
}
