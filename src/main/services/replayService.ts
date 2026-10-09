import { access, mkdir, readdir, rm } from 'fs/promises'
import { appError, messageOf } from '@shared/errors'
import {
  assertReplayId,
  REPLAY_ID,
  REPLAY_NOT_FOUND,
  replayIdOf,
  validateReplay,
  type SlotReplay
} from '@shared/replays'
import { assertSafePlaythroughId } from '@shared/saveRules'
import { getReplayPath, getReplaysPath } from '../paths'
import { readJsonFile, writeAtomicJson } from './jsonFile'

/** The calendar's replays, one `{id}.json` each under a playthrough's `replays` folder. */

/** What a replay read or listing raises when the disk refuses it. */
const UNREADABLE = { code: 'REPLAY_UNREADABLE', message: 'Could not read the replays.' }

/** What a replay write or delete raises when the disk refuses it. */
const UNWRITABLE = { code: 'REPLAY_UNWRITABLE', message: 'Could not save the replay.' }

/** `replays:read` — the replay one playthrough keeps under `replayId`, checked. */
export async function readReplay(playthroughId: string, replayId: string): Promise<SlotReplay> {
  assertSafePlaythroughId(playthroughId)
  assertReplayId(replayId)
  const path = getReplayPath(playthroughId, replayId)
  const read = await readJsonFile<null>(path, {
    malformed: { code: 'REPLAY_MALFORMED', message: 'A replay is damaged.' },
    unreadable: UNREADABLE,
    onMissing: () => null
  })
  if (read.kind === 'missing') {
    throw appError(REPLAY_NOT_FOUND.code, REPLAY_NOT_FOUND.message, path)
  }
  return validateReplay(read.parsed, path)
}

/** `replays:list` — the id of every replay file one playthrough keeps; a stray temp file is none. */
export async function listReplayIds(playthroughId: string): Promise<string[]> {
  assertSafePlaythroughId(playthroughId)
  let names: string[]
  try {
    names = await readdir(getReplaysPath(playthroughId))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw appError(UNREADABLE.code, UNREADABLE.message, messageOf(err))
  }
  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter((id) => REPLAY_ID.test(id))
    .sort()
}

/** `replays:delete` — removes one replay file; an id nothing is kept under is success. */
export async function deleteReplay(playthroughId: string, replayId: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertReplayId(replayId)
  try {
    await rm(getReplayPath(playthroughId, replayId), { force: true })
  } catch (err) {
    throw appError(UNWRITABLE.code, UNWRITABLE.message, messageOf(err))
  }
}

/**
 * Keeps one replay under the id its content hashes to and answers that id; a file already under
 * it holds the same record, so it is left as it is.
 */
export async function writeReplay(playthroughId: string, replay: SlotReplay): Promise<string> {
  assertSafePlaythroughId(playthroughId)
  const checked = validateReplay(replay, 'replay')
  const replayId = replayIdOf(checked)
  assertReplayId(replayId)
  const path = getReplayPath(playthroughId, replayId)

  const present = await access(path).then(
    () => true,
    () => false
  )
  if (present) return replayId

  try {
    await mkdir(getReplaysPath(playthroughId), { recursive: true })
  } catch (err) {
    throw appError(UNWRITABLE.code, UNWRITABLE.message, `${path}: ${messageOf(err)}`)
  }
  await writeAtomicJson(path, checked, UNWRITABLE)
  return replayId
}
