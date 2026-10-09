import { appError } from '@shared/errors'
import {
  assertReplayId,
  REPLAY_ID,
  REPLAY_NOT_FOUND,
  validateReplay,
  type SlotReplay
} from '@shared/replays'
import { assertSafePlaythroughId } from '@shared/saveRules'
import { database, partRange, storage } from './open'

/** The calendar's replays: one row each, under a `[playthroughId, replayId]` key. */

/** The id of every replay one playthrough keeps. */
export async function listReplayIds(playthroughId: string): Promise<string[]> {
  assertSafePlaythroughId(playthroughId)
  const keys = await storage('read the replays', async () =>
    (await database()).getAllKeys('replays', partRange(playthroughId))
  )
  return keys
    .map(([, replayId]) => replayId)
    .filter((replayId) => REPLAY_ID.test(replayId))
    .sort()
}

/** One replay whole; an id nothing is kept under is `REPLAY_NOT_FOUND`. */
export async function readReplay(playthroughId: string, replayId: string): Promise<SlotReplay> {
  assertSafePlaythroughId(playthroughId)
  assertReplayId(replayId)
  const where = `${playthroughId}/${replayId}`
  const row = await storage('read the replay', async () =>
    (await database()).get('replays', [playthroughId, replayId])
  )
  if (row === undefined) throw appError(REPLAY_NOT_FOUND.code, REPLAY_NOT_FOUND.message, where)
  return validateReplay(row, where)
}

/** Removes one replay, whatever saves still name it; an id nothing is kept under is success. */
export async function deleteReplay(playthroughId: string, replayId: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertReplayId(replayId)
  await storage('delete the replay', async () =>
    (await database()).delete('replays', [playthroughId, replayId])
  )
}
