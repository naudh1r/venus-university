import { appError } from './errors'
import { assertSafeId, validateRecord, type ValidateRecordOptions } from './jsonValidate'
import { sha256Hex } from './sha256'
import type { SceneLine, TimeSlot } from './types'

/**
 * A finished scene kept for the calendar to replay: the record, the id it is kept under, the
 * reference a save carries to it, and the rule that says when one is no longer wanted.
 */

/** On-disk replay — `/data/saves/{playthroughId}/replays/{id}.json`. */
export interface SlotReplay {
  schemaVersion: 1
  /** The slot the scene ran in. */
  date: number
  time: TimeSlot
  /** Cast charIds, as the scene fixed them. */
  cast: string[]
  /** charKey → charId for the cast as the scene was played, so a later rename still resolves. */
  keys: Record<string, string>
  /** The scene as delivered: the reader's actions and every reply line, in order. */
  transcript: SceneLine[]
}

export const REPLAY_SCHEMA_VERSION = 1

/** The folder beside a playthrough's saves that holds its replays. */
export const REPLAYS_DIR = 'replays'

/** A save's replays, keyed by day and half — the shape of its history. */
export type GameReplays = Record<number, Partial<Record<TimeSlot, string>>>

/** A replay's id: the first 32 hex characters of its record's SHA-256. */
export const REPLAY_ID = /^[0-9a-f]{32}$/

/** Refuses an id that is not one a replay could have been written under. */
export function assertReplayId(id: string): void {
  assertSafeId(id, REPLAY_ID, 'REPLAY_ID_INVALID', 'That is not a replay id.')
}

/** Raised when no replay is kept under the id asked for. */
export const REPLAY_NOT_FOUND = { code: 'REPLAY_NOT_FOUND', message: 'That replay no longer exists.' }

/** How a replay is checked once it has been read. */
const REPLAY_READ: ValidateRecordOptions<SlotReplay> = {
  label: 'That replay',
  malformed: { code: 'REPLAY_MALFORMED', message: 'A replay is damaged.' },
  schemaVersion: { code: 'REPLAY_SCHEMA_VERSION' },
  expects: REPLAY_SCHEMA_VERSION,
  required: { schemaVersion: true, date: true, time: true, cast: true, keys: true, transcript: true }
}

/** Checks one parsed replay and hands it back typed; `where` is the path or key it came from. */
export function validateReplay(parsed: unknown, where: string): SlotReplay {
  const replay = validateRecord<SlotReplay>(parsed, where, REPLAY_READ)
  const keys = replay.keys as unknown
  const shaped =
    typeof replay.date === 'number' &&
    (replay.time === 0 || replay.time === 1) &&
    Array.isArray(replay.cast) &&
    replay.cast.every((charId) => typeof charId === 'string') &&
    typeof keys === 'object' &&
    keys !== null &&
    Object.values(keys).every((charId) => typeof charId === 'string') &&
    Array.isArray(replay.transcript) &&
    replay.transcript.every(
      (line: unknown) =>
        typeof line === 'object' &&
        line !== null &&
        typeof (line as SceneLine).speaker === 'string' &&
        typeof (line as SceneLine).text === 'string'
    )
  if (!shaped) throw appError(REPLAY_READ.malformed.code, REPLAY_READ.malformed.message, where)
  return replay
}

/** The id a replay is kept under: the same record always yields the same id. */
export function replayIdOf(replay: SlotReplay): string {
  return sha256Hex(JSON.stringify(replay)).slice(0, 32)
}

/** Every replay id a save's map names; anything that is not an id is passed over. */
export function replayIdsOf(replays: GameReplays | undefined): Set<string> {
  const ids = new Set<string>()
  for (const halves of Object.values(replays ?? {})) {
    for (const id of Object.values(halves ?? {})) {
      if (typeof id === 'string' && REPLAY_ID.test(id)) ids.add(id)
    }
  }
  return ids
}

/** The replay ids in a `keep` list handed across the bridge; anything else in it is passed over. */
export function keptReplayIds(keep: unknown): string[] {
  if (!Array.isArray(keep)) return []
  return keep.filter((id): id is string => typeof id === 'string' && REPLAY_ID.test(id))
}

/** The ids in `ids` that `other` does not hold. */
export function idsMissingFrom(ids: Iterable<string>, other: ReadonlySet<string>): string[] {
  return [...ids].filter((id) => !other.has(id))
}

/**
 * Which of `candidates` are no longer wanted: those no save left in the playthrough names and
 * `keep` — what the game being played will write next — does not hold.
 */
export function replaysToDelete(
  candidates: Iterable<string>,
  named: Iterable<ReadonlySet<string>>,
  keep: Iterable<string> = []
): string[] {
  const wanted = new Set(keep)
  for (const ids of named) for (const id of ids) wanted.add(id)
  return [...new Set(candidates)].filter((id) => !wanted.has(id))
}
